import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createSessionToken } from "@/lib/auth-utils"
import {
  rateLimitMiddleware,
  sanitizeEmail,
  sanitizeString,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
} from "@/lib/security"
import { prisma } from "@/lib/db"


if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "login")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const body = await request.json()
    const { email, password } = body

    // Input validation and sanitization
    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(password)

    if (!sanitizedEmail || !sanitizedPassword) {
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
      try {
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
      } catch (prismaError) {
        console.error("Prisma lookup failed:", prismaError)
      }
    }

    if (!user) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱尚未注册，请先注册" },
          { status: 401 }
        )
      )
    }

    // Check if user has a password
    if (!user.password) {
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
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码错误，请重试" },
          { status: 401 }
        )
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "账号已被禁用，请联系管理员" },
          { status: 403 }
        )
      )
    }

    // If this is the only user, make them ADMIN (first user rule)
    if (users.size === 1 && user.role !== 'ADMIN') {
      user.role = 'ADMIN'
      users.set(sanitizedEmail, user)
      if (user.id) users.set(user.id, user)
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

    return applySecurityHeaders(response)
  } catch (error) {
    console.error("Login error:", error)
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
