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
} from "@/lib/security"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"


if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

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

    // Find user by email - first check memory, then fall back to Prisma
    let user = users.get(sanitizedEmail)

    // If not in memory, try Prisma (for serverless cold starts)
    if (!user) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
      })
      if (dbUser) {
        // Rehydrate user into memory
        user = {
          id: dbUser.id,
          email: dbUser.email || sanitizedEmail,
          name: dbUser.name || undefined,
          password: dbUser.password || undefined,
          role: dbUser.role as "USER" | "PRO" | "ADMIN",
          isActive: dbUser.isActive,
          tier: dbUser.tier as "FREE" | "PRO",
          dailyUsage: dbUser.dailyUsage,
          monthlyUsage: dbUser.monthlyUsage,
          dailyResetAt: dbUser.dailyResetAt || getDateKey(),
          monthlyResetAt: dbUser.monthlyResetAt || getMonthKey(),
          createdAt: dbUser.createdAt.toISOString(),
        }
        users.set(sanitizedEmail, user)
        users.set(user.id, user)
      }
    }

    if (!user) {
      const duration = Date.now() - startTime
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
    if (!user.password) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 401, duration, { requestId, userId: user.id })
      logger.auth.login(user.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该账号尚未设置密码，请使用验证码登录" },
          { status: 401 }
        )
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(sanitizedPassword, user.password)
    if (!isValid) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 401, duration, { requestId, userId: user.id })
      logger.auth.login(user.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码错误，请重试" },
          { status: 401 }
        )
      )
    }

    // Check if user is active
    if (!user.isActive) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 403, duration, { requestId, userId: user.id })
      logger.auth.login(user.id, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "账号已被禁用，请联系管理员" },
          { status: 403 }
        )
      )
    }

    // Create session token
    const sessionToken = createSessionToken(user)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
    logger.api.response("POST", endpoint, 200, duration, { requestId, userId: user.id })
    logger.auth.login(user.id, true, { requestId })

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
