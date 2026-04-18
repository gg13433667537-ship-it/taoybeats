import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { verifySessionToken } from "@/lib/auth-utils"
import {
  rateLimitMiddleware,
  sanitizeString,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
} from "@/lib/security"


if (!global.users) global.users = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  // Apply rate limiting for password change
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "change-password")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const sessionToken = request.cookies.get('session-token')?.value
    if (!sessionToken) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    // Verify session token
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
    }

    const userId = payload.id || payload.email
    if (!userId) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Input validation and sanitization
    const sanitizedCurrentPassword = sanitizeString(currentPassword)
    const sanitizedNewPassword = sanitizeString(newPassword)

    if (!sanitizedCurrentPassword || !sanitizedNewPassword) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Current password and new password are required" },
          { status: 400 }
        )
      )
    }

    if (sanitizedNewPassword.length < 8) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        )
      )
    }

    // Find user
    const user = users.get(userId)
    if (!user) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    // Verify current password
    if (user.password) {
      const isValid = await bcrypt.compare(sanitizedCurrentPassword, user.password)
      if (!isValid) {
        return applySecurityHeaders(NextResponse.json({ error: "Current password is incorrect" }, { status: 401 }))
      }
    } else {
      return applySecurityHeaders(NextResponse.json({ error: "No password set for this account" }, { status: 400 }))
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(sanitizedNewPassword, 10)
    user.password = hashedPassword
    users.set(userId, user)

    return applySecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error("Change password error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to change password" }, { status: 500 }))
  }
}