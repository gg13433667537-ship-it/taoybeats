import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { createSessionToken } from "@/lib/auth-utils"
import {
  rateLimitMiddleware,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
} from "@/lib/security"

export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "verify")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供邮箱和验证码" },
          { status: 400 }
        )
      )
    }

    // Verify code from database
    let codeValid = false
    try {
      const tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: email,
          token: String(code),
          expires: { gt: new Date() },
        },
      })
      if (tokenRecord) {
        codeValid = true
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: email, token: String(code) } },
        })
      }
    } catch (dbError) {
      logger.error(`Failed to verify code from DB: ${dbError}`)
      return applySecurityHeaders(
        NextResponse.json({ error: "服务器繁忙，请稍后重试" }, { status: 503 })
      )
    }

    if (!codeValid) {
      return applySecurityHeaders(
        NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 })
      )
    }

    // Find or create user in database
    let dbUser = null
    try {
      dbUser = await prisma.user.findUnique({
        where: { email },
      })
    } catch (dbError) {
      logger.error(`Failed to find user: ${dbError}`)
      return applySecurityHeaders(
        NextResponse.json({ error: "服务器繁忙，请稍后重试" }, { status: 503 })
      )
    }

    if (!dbUser) {
      // Auto-create user for code login
      try {
        const userCount = await prisma.user.count()
        const isFirstUser = userCount === 0

        dbUser = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            email,
            name: email.split('@')[0],
            role: isFirstUser ? 'ADMIN' : 'USER',
            isActive: true,
            tier: 'FREE',
            dailyUsage: 0,
            monthlyUsage: 0,
            dailyResetAt: getDateKey(),
            monthlyResetAt: getMonthKey(),
          },
        })
        logger.info(`Auto-created user via code login: ${dbUser.id}`)
      } catch (createError) {
        logger.error(`Failed to create user: ${createError}`)
        return applySecurityHeaders(
          NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 })
        )
      }
    }

    const sessionUser = {
      id: dbUser.id,
      email: dbUser.email || email,
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

    const sessionToken = createSessionToken(sessionUser)

    console.log(`[Verify] User ${email} login - role: ${sessionUser.role}, userId: ${sessionUser.id}`)

    const response = NextResponse.json({
      success: true,
      message: "验证成功",
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
      },
    })

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return applySecurityHeaders(response)
  } catch (error) {
    console.error("Verify error:", error)
    return applySecurityHeaders(
      NextResponse.json(
        { error: "验证失败，请稍后重试" },
        { status: 500 }
      )
    )
  }
}

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
