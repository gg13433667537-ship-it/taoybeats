import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Find the song
    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const song = songsMap.get(id)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // If song already has a shareToken, return it
    if (song.shareToken) {
      const shareUrl = `${request.nextUrl.origin}/song/${song.shareToken}`
      return NextResponse.json({
        id,
        shareToken: song.shareToken,
        shareUrl,
        message: "Share link retrieved successfully",
      })
    }

    // Generate a new share token if not exists
    const shareToken = generateShareToken()

    // Update the song with the new shareToken
    const updatedSong = { ...song, shareToken }
    songsMap.set(id, updatedSong)

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
