import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
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
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "请输入邮箱和密码" },
        { status: 400 }
      )
    }

    // Find user by email
    const user = users.get(email)
    if (!user) {
      return NextResponse.json(
        { error: "该邮箱尚未注册，请先注册" },
        { status: 401 }
      )
    }

    // Check if user has a password
    if (!user.password) {
      return NextResponse.json(
        { error: "该账号尚未设置密码，请使用验证码登录" },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: "密码错误，请重试" },
        { status: 401 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: "账号已被禁用，请联系管理员" },
        { status: 403 }
      )
    }

    // If this is the only user, make them ADMIN (first user rule)
    if (users.size === 1 && user.role !== 'ADMIN') {
      user.role = 'ADMIN'
      users.set(email, user)
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

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    )
  }
}
