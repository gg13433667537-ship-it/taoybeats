import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"
import type { Song } from "@/lib/types"

// Global storage is shared from songs route

export async function POST(request: NextRequest) {
  // Verify session
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid session' }, { status: 401 }))
  }

  const userId = payload.id || payload.email
  if (!userId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { songIds } = body

    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json(
        { error: "songIds array is required" },
        { status: 400 }
      )
    }

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Songs not found" }, { status: 404 })
    }

    const downloads = songIds.map(id => {
      const song = songsMap.get(id)
      if (!song || song.status !== 'COMPLETED' || !song.audioUrl) {
        return { id, error: "Song not available" }
      }
      return {
        id: song.id,
        title: song.title,
        audioUrl: song.audioUrl,
        genre: song.genre,
      }
    })

    return NextResponse.json({
      success: true,
      count: downloads.length,
      downloads,
    })
  } catch (error) {
    console.error("Batch download error:", error)
    return NextResponse.json(
      { error: "Failed to prepare batch download" },
      { status: 500 }
    )
  }
}
