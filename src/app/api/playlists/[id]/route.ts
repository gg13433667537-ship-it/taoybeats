import { NextRequest, NextResponse } from "next/server"
import type { User, Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
  var playlists: Map<string, Playlist> | undefined
}

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

// GET /api/playlists/[id] - Get a playlist
export async function GET(
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

  // Check access - owner or admin or public playlist
  if (playlist.userId !== user.id && user.role !== 'ADMIN' && !playlist.isPublic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ playlist })
}

// PUT /api/playlists/[id] - Update a playlist
export async function PUT(
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
    const { name, description, isPublic } = await request.json()

    const updated: Playlist = {
      ...playlist,
      name: name?.trim() || playlist.name,
      description: description !== undefined ? description?.trim() || undefined : playlist.description,
      isPublic: isPublic !== undefined ? isPublic : playlist.isPublic,
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(id, updated)

    return NextResponse.json({ playlist: updated })
  } catch (error) {
    console.error("Update playlist error:", error)
    return NextResponse.json({ error: "Failed to update playlist" }, { status: 500 })
  }
}

// DELETE /api/playlists/[id] - Delete a playlist
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

  global.playlists?.delete(id)

  return NextResponse.json({ success: true })
}