import { NextRequest, NextResponse } from "next/server"
import { verificationCodes } from "@/lib/auth-codes"

// Demo users (replace with database in production)
const users: Map<string, any> = new Map()

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      )
    }

    // Check verification code
    const stored = verificationCodes.get(email)

    if (!stored) {
      return NextResponse.json(
        { error: "No verification code sent to this email" },
        { status: 400 }
      )
    }

    if (Date.now() > stored.expires) {
      verificationCodes.delete(email)
      return NextResponse.json(
        { error: "Verification code expired" },
        { status: 400 }
      )
    }

    if (stored.code !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      )
    }

    // Code valid - delete it
    verificationCodes.delete(email)

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

    // Create session token (simple JWT-like token)
    const sessionToken = createSessionToken(user)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
    })

    // Set cookie
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
      { error: "Verification failed" },
      { status: 500 }
    )
  }
}

function createSessionToken(user: any): string {
  // Simple token (use real JWT in production)
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
