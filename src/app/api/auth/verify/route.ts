import { NextRequest, NextResponse } from "next/server"

// Shared global storage
declare global {
  var users: Map<string, any> | undefined
  var songs: Map<string, any> | undefined
  var adminLogs: Map<string, any> | undefined
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: "请提供邮箱和验证码" },
        { status: 400 }
      )
    }

    // Get verify token from cookie
    const token = request.cookies.get("verify-token")?.value
    const devCode = request.cookies.get("dev-code")?.value

    if (!token) {
      return NextResponse.json(
        { error: "请先获取验证码" },
        { status: 400 }
      )
    }

    // Decode token
    let payload: { email: string; code: string; exp: number }
    try {
      payload = JSON.parse(Buffer.from(token, "base64url").toString())
    } catch {
      return NextResponse.json(
        { error: "验证码无效" },
        { status: 400 }
      )
    }

    // Check expiry
    if (Date.now() > payload.exp) {
      return NextResponse.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      )
    }

    // Check email match
    if (payload.email !== email) {
      return NextResponse.json(
        { error: "邮箱不匹配，请重新获取验证码" },
        { status: 400 }
      )
    }

    // Check code - use devCode if in dev mode, otherwise use payload.code
    const validCode = devCode || payload.code
    if (code !== validCode) {
      return NextResponse.json(
        { error: "验证码错误，请检查后重新输入" },
        { status: 400 }
      )
    }

    // Code valid - clear verify cookie
    const response = NextResponse.json({
      success: true,
      message: "验证成功",
    })
    response.cookies.delete("verify-token")
    response.cookies.delete("dev-code")

    // Get or create user
    let user = users.get(email)
    if (!user) {
      // Check if this is the first user (make them ADMIN)
      const isFirstUser = users.size === 0
      user = {
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
        createdAt: new Date().toISOString(),
      }
      // Store by both email and id for easy lookup
      users.set(email, user)
      users.set(user.id, user)
    } else {
      // If this is the only user, make them ADMIN
      if (users.size === 1 && user.role !== 'ADMIN') {
        user.role = 'ADMIN'
        users.set(email, user)
        if (user.id) users.set(user.id, user)
      }
    }

    // Create session token
    const sessionToken = createSessionToken(user)

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error("Verify error:", error)
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    )
  }
}

function createSessionToken(user: any): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }
  return Buffer.from(JSON.stringify(payload)).toString("base64")
}

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
