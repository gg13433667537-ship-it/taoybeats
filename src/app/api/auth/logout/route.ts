import { NextResponse } from "next/server"
import { applySecurityHeaders } from "@/lib/security"
import { logger } from "@/lib/logger"
import crypto from "crypto"

export async function POST() {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/logout"

  logger.api.request("POST", endpoint, { requestId })

  const response = NextResponse.json({ success: true })

  // Clear session token
  response.cookies.set("session-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })

  const duration = Date.now() - startTime
  logger.api.response("POST", endpoint, 200, duration, { requestId })

  return applySecurityHeaders(response)
}
