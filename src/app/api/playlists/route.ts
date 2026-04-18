import { NextRequest, NextResponse } from "next/server"
import type { Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { playlistCache } from "@/lib/cache"


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

// GET /api/playlists - List user's playlists
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check cache first
  const cacheKey = `playlists:${user.id}`
  if (playlistCache.has(cacheKey)) {
    return NextResponse.json(playlistCache.get(cacheKey))
  }

  const playlists = Array.from(global.playlists?.values() || [])
    .filter(p => p.userId === user.id)
    .map(p => ({
      ...p,
      songCount: p.songIds.length,
    }))

  const response = { playlists }

  // Cache for 30 seconds
  playlistCache.set(cacheKey, response, 30000)

  return NextResponse.json(response)
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, description, isPublic } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Playlist name is required" }, { status: 400 })
    }

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description?.trim() || undefined,
      userId: user.id,
      songIds: [],
      isPublic: isPublic || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(playlist.id, playlist)

    // Invalidate playlist cache for this user
    playlistCache.delete(`playlists:${user.id}`)

    return NextResponse.json({ playlist }, { status: 201 })
  } catch (error) {
    console.error("Create playlist error:", error)
    return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 })
  }
}