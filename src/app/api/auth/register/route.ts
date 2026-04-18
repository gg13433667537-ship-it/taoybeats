import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import type { User } from "@/lib/types"
import { createSessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
  var songs: Map<string, unknown> | undefined
  var adminLogs: Map<string, unknown> | undefined
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "请提供邮箱和密码" },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少为6个字符" },
        { status: 400 }
      )
    }

    // Check if user already exists
    if (users.has(email)) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Check if this is the first user (make them ADMIN)
    const isFirstUser = users.size === 0

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name: name || email.split("@")[0],
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

    // Store by both email and id for easy lookup
    users.set(email, user)
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

    return response
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    )
  }
}

function getDateKey(): string {
  return new Date().toISOString().split("T")[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
