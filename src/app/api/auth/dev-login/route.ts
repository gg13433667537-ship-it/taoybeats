/**
 * POST /api/auth/dev-login
 * @description 开发者快速登录 - 仅在本地开发环境使用，绕过数据库验证
 * @warning 不要在生产环境暴露此端点
 */
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createSessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"

export async function POST(request: NextRequest) {
  // Safety check: only allow in development
  if (process.env.NODE_ENV === "production") {
    return applySecurityHeaders(
      NextResponse.json({ error: "Not available in production" }, { status: 403 })
    )
  }

  try {
    const body = await request.json()
    const { email = "dev@local.test", role = "ADMIN" } = body

    const devUser = {
      id: `dev_${crypto.randomUUID().slice(0, 8)}`,
      email,
      name: "Developer",
      role: role as "USER" | "PRO" | "ADMIN",
      isActive: true,
      tier: "PRO" as "FREE" | "PRO",
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: new Date().toISOString().split("T")[0],
      monthlyResetAt: new Date().toISOString().slice(0, 7),
      createdAt: new Date().toISOString(),
    }

    const sessionToken = createSessionToken(devUser)

    const response = NextResponse.json({
      success: true,
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        role: devUser.role,
      },
      note: "Dev login bypass - database connection issues detected",
    })

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: false, // localhost
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return applySecurityHeaders(response)
  } catch (error) {
    console.error("Dev login error:", error)
    return applySecurityHeaders(
      NextResponse.json({ error: "Dev login failed" }, { status: 500 })
    )
  }
}
