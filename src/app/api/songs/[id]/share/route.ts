import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Generate a unique share token if not exists
    // In production, check if song exists and user owns it
    const shareToken = generateShareToken()

    const shareUrl = `${request.nextUrl.origin}/song/${shareToken}`

    return NextResponse.json({
      id,
      shareToken,
      shareUrl,
      message: "Share link created successfully",
    })
  } catch (error) {
    console.error("Share error:", error)
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    )
  }
}

function generateShareToken(): string {
  // Generate a random 8-character token
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
