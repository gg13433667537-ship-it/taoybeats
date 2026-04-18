import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { applySecurityHeaders } from "@/lib/security"
import crypto from "crypto"

if (!global.users) global.users = new Map()
const users = global.users!

async function getCurrentUser(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) return null

  try {
    // First try without revocation check
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null

    // Get user's revocation timestamp from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { sessionsRevokedAt: true, isActive: true },
    })

    if (!dbUser) return null
    if (!dbUser.isActive) return null

    // Check if sessions were revoked after this token was issued
    if (dbUser.sessionsRevokedAt && payload.iat * 1000 < dbUser.sessionsRevokedAt.getTime()) {
      return null
    }

    return { id: payload.id, email: payload.email, role: payload.role }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const user = await getCurrentUser(request)
    if (!user) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    }

    const now = new Date()

    // Update sessionsRevokedAt in database
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionsRevokedAt: now },
    })

    // Update in-memory cache
    const cachedUser = users.get(user.id)
    if (cachedUser) {
      cachedUser.sessionsRevokedAt = now.toISOString()
      users.set(user.id, cachedUser)
      if (cachedUser.email) {
        users.set(cachedUser.email, cachedUser)
      }
    }

    // Clear the session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set("session-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })

    logger.auth.logout(user.id, { requestId: crypto.randomUUID(), action: "logout-all" })

    return applySecurityHeaders(response)
  } catch (error) {
    console.error("Logout all error:", error)
    return applySecurityHeaders(
      NextResponse.json({ error: "Failed to sign out" }, { status: 500 })
    )
  }
}
