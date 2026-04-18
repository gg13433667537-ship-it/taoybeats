import { NextRequest, NextResponse } from "next/server"
import { applySecurityHeaders } from "@/lib/security"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import crypto from "crypto"

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/check-email"

  logger.api.request("POST", endpoint, { requestId })

  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请输入有效的邮箱地址" },
          { status: 400 }
        )
      )
    }

    // Check if user exists in global store first
    const user = users.get(email)
    let exists = !!user
    let hasPassword = user ? !!user.password : false

    // If not in memory, check Prisma database
    if (!user) {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true },
      })
      if (dbUser) {
        exists = true
        hasPassword = !!dbUser.password
      }
    }

    if (!exists) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 200, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({
        exists: false,
        hasPassword: false,
        message: "该邮箱未注册",
      }))
    }

    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 200, duration, { requestId })
    return applySecurityHeaders(NextResponse.json({
      exists: true,
      hasPassword,
      message: hasPassword ? "请输入密码登录" : "请输入验证码登录",
    }))
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "检查邮箱失败" },
        { status: 500 }
      )
    )
  }
}
