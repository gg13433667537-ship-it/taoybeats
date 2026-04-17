import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // For demo, return mock song
  // In production, query database
  const mockSong = {
    id,
    title: "Sample Song",
    status: "COMPLETED",
    audioUrl: "/sample-audio.mp3",
    genre: ["Pop"],
    mood: "Happy",
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json(mockSong)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  // In production, update database
  return NextResponse.json({ id, ...body })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // In production, delete from database
  return NextResponse.json({ success: true, id })
}
