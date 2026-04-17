import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    // In production, fetch the song from database and use its parameters
    // For now, return success to start the SSE stream
    return NextResponse.json({
      id,
      status: "GENERATING",
      message: "Generation started. Poll /api/songs/[id]/stream for progress.",
    })
  } catch (error) {
    console.error("Generate error:", error)
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    )
  }
}
