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


if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "register")
  if (rateLimitResponse) {
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
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供邮箱和密码" },
          { status: 400 }
        )
      )
    }

    // Validate password length
    if (sanitizedPassword.length < 6) {
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
    await prisma.user.create({
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
    console.error("Register error:", error)
    return applySecurityHeaders(
      NextResponse.json(
        { error: "注册失败，请稍后重试" },
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
