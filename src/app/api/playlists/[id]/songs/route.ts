import { NextRequest, NextResponse } from "next/server"
import type { User, Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


if (!global.users) global.users = new Map()
if (!global.playlists) global.playlists = new Map()

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

// POST /api/playlists/[id]/songs - Add a song to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const playlist = global.playlists?.get(id) as Playlist | undefined

  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
  }

  // Check ownership
  if (playlist.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { songId } = await request.json()

    if (!songId) {
      return NextResponse.json({ error: "Song ID is required" }, { status: 400 })
    }

    // Check if song exists
    if (!global.songs?.has(songId)) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Check if song is already in playlist
    if (playlist.songIds.includes(songId)) {
      return NextResponse.json({ error: "Song already in playlist" }, { status: 409 })
    }

    const updated: Playlist = {
      ...playlist,
      songIds: [...playlist.songIds, songId],
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(id, updated)

    return NextResponse.json({ playlist: updated })
  } catch (error) {
    console.error("Add song to playlist error:", error)
    return NextResponse.json({ error: "Failed to add song to playlist" }, { status: 500 })
  }
}

// DELETE /api/playlists/[id]/songs - Remove a song from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const playlist = global.playlists?.get(id) as Playlist | undefined

  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
  }

  // Check ownership
  if (playlist.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (!songId) {
      return NextResponse.json({ error: "Song ID is required" }, { status: 400 })
    }

    const updated: Playlist = {
      ...playlist,
      songIds: playlist.songIds.filter(sid => sid !== songId),
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(id, updated)

    return NextResponse.json({ playlist: updated })
  } catch (error) {
    console.error("Remove song from playlist error:", error)
    return NextResponse.json({ error: "Failed to remove song from playlist" }, { status: 500 })
  }
}