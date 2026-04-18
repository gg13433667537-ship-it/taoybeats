import { NextRequest, NextResponse } from "next/server"
import type { Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { playlistCache } from "@/lib/cache"
import { sanitizeString, validateRequiredString, validateOptionalString, MAX_LENGTHS } from "@/lib/security"


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

    // Validate and sanitize name
    const nameError = validateRequiredString(name, MAX_LENGTHS.NAME, "Playlist name")
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }

    // Validate and sanitize description
    const descError = validateOptionalString(description, MAX_LENGTHS.DESCRIPTION, "Description")
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }

    const sanitizedName = sanitizeString(name)
    const sanitizedDescription = description ? sanitizeString(description) : undefined
    const publicFlag = isPublic === true || isPublic === "true"

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: sanitizedName,
      description: sanitizedDescription,
      userId: user.id,
      songIds: [],
      isPublic: publicFlag,
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