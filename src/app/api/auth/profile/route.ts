import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


if (!global.users) global.users = new Map()

async function getCurrentUser(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) return null

  try {
    return verifySessionToken(sessionToken)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get full user from global store
    const usersMap = global.users!
    const existingUser = usersMap.get(user.id)
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        tier: existingUser.tier,
      },
    })
  } catch (error) {
    console.error("Profile error:", error)
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await request.json()

    // Update user in global store
    const usersMap = global.users!
    const existingUser = usersMap.get(user.id)
    if (existingUser) {
      existingUser.name = name
      usersMap.set(user.id, existingUser)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name,
      },
    })
  } catch (error) {
    console.error("Profile error:", error)
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()

    // In production, update user in database
    // For demo, just return success
    return NextResponse.json({
      success: true,
      user: {
        email,
        name,
      },
    })
  } catch (error) {
    console.error("Profile error:", error)
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    )
  }
}
