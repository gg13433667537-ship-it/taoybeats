import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { verifySessionToken } from "@/lib/auth-utils"
import {
  rateLimitMiddleware,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
} from "@/lib/security"
import { prisma } from "@/lib/db"


/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
function validatePasswordStrength(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "Password is required"
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters"
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter"
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter"
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number"
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character"
  }

  return null
}

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

    const userId = payload.id
    if (!userId) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Validate required fields (do NOT sanitize passwords - they must be used as-is)
    if (!currentPassword || !newPassword) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Current password and new password are required" },
          { status: 400 }
        )
      )
    }

    // Validate password strength (use raw passwords, not sanitized)
    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) {
      return applySecurityHeaders(
        NextResponse.json({ error: strengthError }, { status: 400 })
      )
    }

    // Prevent new password being same as current (optional additional check)
    if (currentPassword === newPassword) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        )
      )
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })

    if (!user) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    // Verify current password
    if (user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return applySecurityHeaders(NextResponse.json({ error: "Current password is incorrect" }, { status: 401 }))
      }
    } else {
      return applySecurityHeaders(NextResponse.json({ error: "No password set for this account" }, { status: 400 }))
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return applySecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error("Change password error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to change password" }, { status: 500 }))
  }
}