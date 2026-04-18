import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
}

if (!global.users) global.users = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify session token
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const userId = payload.id || payload.email
    if (!userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Find user
    const user = users.get(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    if (user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
      }
    } else {
      return NextResponse.json({ error: "No password set for this account" }, { status: 400 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    users.set(userId, user)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Change password error:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}