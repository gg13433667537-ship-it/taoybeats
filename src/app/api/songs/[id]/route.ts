import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
}

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

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const song = songsMap.get(id)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    return NextResponse.json(song)
  } catch (error) {
    console.error("GET song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
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

    const body = await request.json()

    const songsMap = global.songs as Map<string, Song>
    const song = songsMap.get(id)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin to update
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only allow updating certain fields - prevent security issues
    const allowedUpdates: Partial<Song> = {}
    const updatableFields = ['title', 'lyrics', 'genre', 'mood', 'instruments', 'referenceSinger', 'referenceSong', 'userNotes', 'isInstrumental', 'voiceId', 'referenceAudio', 'status', 'audioUrl']
    for (const field of updatableFields) {
      if (field in body) {
        (allowedUpdates as Record<string, unknown>)[field] = body[field]
      }
    }

    const updatedSong: Song = { ...song, ...allowedUpdates, id, updatedAt: new Date().toISOString() }
    songsMap.set(id, updatedSong)

    return NextResponse.json(updatedSong)
  } catch (error) {
    console.error("PATCH song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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

    const songsMap = global.songs as Map<string, Song>
    const song = songsMap.get(id)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin to delete
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    songsMap.delete(id)

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("DELETE song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}