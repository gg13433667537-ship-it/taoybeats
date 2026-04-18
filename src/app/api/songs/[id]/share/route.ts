import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


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

function generateShareToken(): string {
  // Generate a cryptographically secure 32-character token using crypto.randomBytes
  return randomBytes(24).toString("base64url")
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

    // Only allow owner or admin to create share link
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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