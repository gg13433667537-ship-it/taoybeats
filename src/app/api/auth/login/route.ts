/**
 * POST /api/auth/login
 * @version v1
 * @description 用户登录验证，成功后创建7天有效的session cookie
 * @param {string} email - 用户邮箱（必需）
 * @param {string} password - 密码（必需）
 * @returns {object} { success: true, user: { id, email, name, role } }
 * @errors 400 - 参数缺失 | 401 - 用户不存在或密码错误 | 403 - 账号已禁用 | 500 - 服务器错误
 * @rateLimit 5 requests per minute per IP
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { createSessionToken } from "@/lib/auth-utils"
import {
  rateLimitMiddleware,
  sanitizeEmail,
  sanitizeString,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
  validateCSRFDoubleSubmit,
} from "@/lib/security"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"


export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/login"

  logger.api.request("POST", endpoint, { requestId })

  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "login")
  if (rateLimitResponse) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 429, duration, { requestId })
    return applySecurityHeaders(rateLimitResponse)
  }

  // Validate CSRF token (Double Submit Cookie pattern)
  if (!validateCSRFDoubleSubmit(request)) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 403, duration, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      )
    )
  }

  try {
    const body = await request.json()
    const { email, password } = body

    // Input validation and sanitization
    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(password)

    if (!sanitizedEmail || !sanitizedPassword) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请输入邮箱和密码" },
          { status: 400 }
        )
      )
    }

    // Find user by email using Prisma only
    logger.debug(`Login attempt for email: ${sanitizedEmail}`, { requestId })

    let dbUser = null
    try {
      dbUser = await prisma.user.findFirst({
        where: { email: sanitizedEmail.toLowerCase() },
      })

      if (!dbUser) {
        dbUser = await prisma.user.findFirst({
          where: {
            email: { equals: sanitizedEmail, mode: 'insensitive' },
          },
        })
      }
    } catch (prismaError) {
      logger.error(`Prisma login lookup failed: ${prismaError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json({ error: "服务器繁忙，请稍后重试" }, { status: 503 })
      )
    }

    logger.debug(`Prisma result: ${dbUser ? `found user ${dbUser.id}` : 'not found'}`, { requestId })

    if (!dbUser) {
      const duration = Date.now() - startTime
      logger.warn(`User not found for email: ${sanitizedEmail}`, { requestId })

      logger.api.response("POST", endpoint, 401, duration, { requestId })
      logger.auth.login(sanitizedEmail, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱尚未注册，请先注册" },
          { status: 401 }
        )
      )
    }

    // Check if user has a password
    if (!dbUser.password) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 401, duration, { requestId, userId: dbUser.id })
      logger.auth.login(dbUser.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该账号尚未设置密码，请使用验证码登录" },
          { status: 401 }
        )
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(sanitizedPassword, dbUser.password)
    if (!isValid) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 401, duration, { requestId, userId: dbUser.id })
      logger.auth.login(dbUser.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码错误，请重试" },
          { status: 401 }
        )
      )
    }

    // Check if user is active
    if (!dbUser.isActive) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 403, duration, { requestId, userId: dbUser.id })
      logger.auth.login(dbUser.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "账号已被禁用，请联系管理员" },
          { status: 403 }
        )
      )
    }

    // Create session token
    const userForSession = {
      id: dbUser.id,
      email: dbUser.email || sanitizedEmail,
      name: dbUser.name || undefined,
      role: dbUser.role as "USER" | "PRO" | "ADMIN",
      isActive: dbUser.isActive,
      tier: dbUser.tier as "FREE" | "PRO",
      dailyUsage: dbUser.dailyUsage,
      monthlyUsage: dbUser.monthlyUsage,
      dailyResetAt: dbUser.dailyResetAt || getDateKey(),
      monthlyResetAt: dbUser.monthlyResetAt || getMonthKey(),
      createdAt: dbUser.createdAt.toISOString(),
    }
    const sessionToken = createSessionToken(userForSession)

    const response = NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      },
    })

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 200, duration, { requestId, userId: dbUser.id })
    logger.auth.login(dbUser.id, true, { requestId })

    return applySecurityHeaders(response)
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "登录失败，请稍后重试" },
        { status: 500 }
      )
    )
  }
}

function getDateKey(): string {
  return new Date().toISOString().split("T")[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
