import { NextRequest, NextResponse } from "next/server"
import type { Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { playlistCache } from "@/lib/cache"
import { sanitizeString, validateRequiredString, validateOptionalString, validateBoolean, MAX_LENGTHS, applySecurityHeaders, handleCORS } from "@/lib/security"


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

// OPTIONS /api/playlists - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const corsResponse = handleCORS(request)
  if (corsResponse) {
    return applySecurityHeaders(corsResponse)
  }
  return applySecurityHeaders(new NextResponse(null, { status: 405 }))
}

// GET /api/playlists - List user's playlists
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  // Check cache first
  const cacheKey = `playlists:${user.id}`
  if (playlistCache.has(cacheKey)) {
    return applySecurityHeaders(NextResponse.json(playlistCache.get(cacheKey)))
  }

  const playlists = Array.from(global.playlists?.values() || [])
    .filter(p => p.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(p => ({
      ...p,
      songCount: p.songIds.length,
    }))

  const response = { playlists }

  // Cache for 30 seconds
  playlistCache.set(cacheKey, response, 30000)

  return applySecurityHeaders(NextResponse.json(response))
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  let body: { name?: unknown; description?: unknown; isPublic?: unknown }
  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }))
  }

  const { name, description, isPublic } = body

  // Validate and sanitize name
  const nameError = validateRequiredString(name, MAX_LENGTHS.NAME, "Playlist name")
  if (nameError) {
    return applySecurityHeaders(NextResponse.json({ error: nameError }, { status: 400 }))
  }

  // Validate and sanitize description
  const descError = validateOptionalString(description, MAX_LENGTHS.DESCRIPTION, "Description")
  if (descError) {
    return applySecurityHeaders(NextResponse.json({ error: descError }, { status: 400 }))
  }

  // Validate isPublic
  const validatedIsPublic = validateBoolean(isPublic, "isPublic")
  if (validatedIsPublic === null) {
    return applySecurityHeaders(NextResponse.json({ error: "isPublic must be a boolean" }, { status: 400 }))
  }

  const sanitizedName = sanitizeString(name)
  const sanitizedDescription = typeof description === "string" ? sanitizeString(description) : undefined

  const playlist: Playlist = {
    id: crypto.randomUUID(),
    name: sanitizedName,
    description: sanitizedDescription,
    userId: user.id,
    songIds: [],
    isPublic: validatedIsPublic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  global.playlists?.set(playlist.id, playlist)

  // Invalidate playlist cache for this user
  playlistCache.delete(`playlists:${user.id}`)

  return applySecurityHeaders(NextResponse.json({ playlist }, { status: 201 }))
}