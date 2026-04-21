/**
 * POST /api/auth/reset-password
 * @version v1
 * @description 忘记密码：验证码验证 + 密码重置
 * @param {string} email - 用户邮箱（必需）
 * @param {string} code - 验证码（必需）
 * @param {string} newPassword - 新密码（最少6字符）
 * @returns {object} { success: true, message: "密码重置成功，请使用新密码登录" }
 * @errors 400 - 参数缺失或密码太短或验证码错误 | 404 - 用户不存在 | 500 - 更新失败 | 503 - 数据库繁忙
 * @rateLimit 5 requests per 15 minutes per IP
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
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
  const endpoint = "/api/auth/reset-password"

  logger.api.request("POST", endpoint, { requestId })

  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "reset-password")
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
    const { email, code, newPassword } = body

    // Input validation and sanitization
    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(newPassword)

    if (!sanitizedEmail || !code || !sanitizedPassword) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供邮箱、验证码和新密码" },
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

    // Verify code from database
    let codeValid = false
    try {
      const tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: sanitizedEmail,
          token: String(code),
          expires: { gt: new Date() },
        },
      })
      if (tokenRecord) {
        codeValid = true
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: sanitizedEmail, token: String(code) } },
        })
      }
    } catch (dbError) {
      logger.error(`Failed to verify code: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!codeValid) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "验证码错误或已过期" },
          { status: 400 }
        )
      )
    }

    // Find user by email
    let user = null
    try {
      user = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
      })
    } catch (dbError) {
      logger.error(`Failed to find user: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!user) {
      const duration = Date.now() - startTime
      logger.warn(`User not found for email: ${sanitizedEmail}`, { requestId })
      logger.api.response("POST", endpoint, 404, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱尚未注册" },
          { status: 404 }
        )
      )
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10)

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          sessionsRevokedAt: new Date(),
        },
      })
      logger.info(`Password reset successful for user: ${user.id}`, { requestId })
    } catch (dbError) {
      logger.error(`Failed to update password: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码重置失败，请稍后重试" },
          { status: 500 }
        )
      )
    }

    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        message: "密码重置成功，请使用新密码登录",
      })
    )
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "密码重置失败，请稍后重试" },
        { status: 500 }
      )
    )
  }
}
