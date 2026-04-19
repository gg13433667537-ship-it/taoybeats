/**
 * POST /api/auth/register
 * @version v1
 * @description 注册新用户，自动创建会话并设置7天有效的session cookie
 * @param {string} email - 用户邮箱（必需，已消毒处理）
 * @param {string} password - 密码（最少6字符，已加密存储）
 * @param {string} [name] - 用户昵称（可选，默认使用邮箱前缀）
 * @returns {object} { success: true, user: { id, email, name, role } }
 * @errors 400 - 参数缺失或密码太短 | 409 - 邮箱已被注册 | 500 - 服务器错误
 * @rateLimit 5 requests per minute per IP
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import type { User } from "@/lib/types"
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
  const endpoint = "/api/auth/register"

  logger.api.request("POST", endpoint, { requestId })

  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "register")
  if (rateLimitResponse) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 429, duration, { requestId })
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const body = await request.json()
    const { email, password, name } = body

    // Input validation and sanitization
    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(password)
    const sanitizedName = name ? sanitizeString(name) : undefined

    if (!sanitizedEmail || !sanitizedPassword) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供邮箱和密码" },
          { status: 400 }
        )
      )
    }

    // Validate password length
    if (sanitizedPassword.length < 6) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码长度至少为6个字符" },
          { status: 400 }
        )
      )
    }

    // Hash password first
    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10)

    // Check if user already exists in Prisma database
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    })
    if (existingUser) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 409, duration, { requestId, userId: existingUser.id })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱已被注册" },
          { status: 409 }
        )
      )
    }

    // Check if this is the first user (make them ADMIN)
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // Create user object
    const user: User = {
      id: crypto.randomUUID(),
      email: sanitizedEmail,
      name: sanitizedName || sanitizedEmail.split("@")[0],
      password: hashedPassword,
      role: isFirstUser ? "ADMIN" : "USER",
      isActive: true,
      tier: "FREE",
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: getDateKey(),
      monthlyResetAt: getMonthKey(),
      createdAt: new Date().toISOString(),
    }

    // Persist to Prisma database FIRST - this must succeed before anything else
    logger.debug(`Creating user in Prisma: ${JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      tier: user.tier,
    })}`, { requestId })

    try {
      const createdUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name || null,
          password: user.password,
          role: user.role as "USER" | "PRO" | "ADMIN",
          isActive: user.isActive,
          tier: user.tier,
          dailyUsage: user.dailyUsage,
          monthlyUsage: user.monthlyUsage,
          dailyResetAt: user.dailyResetAt,
          monthlyResetAt: user.monthlyResetAt,
        },
      })

      logger.info(`User created in Prisma successfully: ${createdUser.id}`, { requestId })
    } catch (prismaError) {
      logger.error(`Prisma user.create failed: ${prismaError}`, undefined, { requestId })
      throw prismaError
    }

    // Only after Prisma succeeds, store in memory
    users.set(sanitizedEmail, user)
    users.set(user.id, user)

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
    }, { status: 201 })

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 201, duration, { requestId, userId: user.id })
    logger.auth.login(user.id, true, { requestId })

    return applySecurityHeaders(response)
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    const errorMessage = error instanceof Error ? error.message : String(error)
    return applySecurityHeaders(
      NextResponse.json(
        { error: `注册失败: ${errorMessage}` },
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
