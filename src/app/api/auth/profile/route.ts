import { NextRequest, NextResponse } from "next/server"

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
