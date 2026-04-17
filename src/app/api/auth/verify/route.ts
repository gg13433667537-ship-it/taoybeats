import { NextRequest, NextResponse } from "next/server"

// Demo users (replace with database in production)
const users: Map<string, any> = new Map()

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
      user = {
        id: crypto.randomUUID(),
        email,
        name: email.split('@')[0],
        tier: 'FREE',
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: getDateKey(),
        monthlyResetAt: getMonthKey(),
        createdAt: new Date().toISOString(),
      }
      users.set(email, user)
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
