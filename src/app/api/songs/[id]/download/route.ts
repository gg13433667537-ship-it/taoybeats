/**
 * GET /api/songs/[id]/download
 * @description Proxied audio download endpoint to handle CORS restrictions from external audio URLs
 */
import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"

function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth check
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get song from database
    const song = await prisma.song.findUnique({
      where: { id },
    })

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Check ownership or admin
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if song has audio
    if (!song.audioUrl) {
      return NextResponse.json({ error: "Audio not available" }, { status: 404 })
    }

    // Fetch the audio from external URL
    const audioResponse = await fetch(song.audioUrl)

    if (!audioResponse.ok) {
      console.error("Failed to fetch audio from external URL:", audioResponse.status)
      return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 })
    }

    // Get the audio buffer
    const audioBuffer = await audioResponse.arrayBuffer()

    // Determine content type from response or default to mp3
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg'

    // Get filename from title or use default
    const filename = `${song.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') || 'audio'}.mp3`

    // Return the audio with appropriate headers for download
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}