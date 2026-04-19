import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"
import { prisma } from "@/lib/db"

/**
 * GET - Check current user tier status
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
  }

  const userId = payload.id || payload.email
  if (!userId) {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    return applySecurityHeaders(NextResponse.json({
      id: user.id,
      email: user.email,
      tier: user.tier,
      role: user.role,
      dailyUsage: user.dailyUsage,
      monthlyUsage: user.monthlyUsage,
    }))

  } catch (error) {
    console.error("Failed to get user:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to get user" }, { status: 500 }))
  }
}

/**
 * POST - Fix user tier to PRO
 * This is a one-time fix - should be removed after use
 */
export async function POST(request: NextRequest) {
  // Get session token
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
  }

  const userId = payload.id || payload.email
  if (!userId) {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid session" }, { status: 401 }))
  }

  try {
    // Get current user
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    console.log(`Fixing tier for user ${user.email} (${user.id}): ${user.tier} -> PRO`)

    // Update tier to PRO
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { tier: 'PRO' }
    })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      message: `Tier updated to PRO for ${user.email}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
        role: updatedUser.role
      }
    }))

  } catch (error) {
    console.error("Failed to fix tier:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to update tier" }, { status: 500 }))
  }
}