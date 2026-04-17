import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"

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
    const body = await request.json()

    const songsMap = global.songs as Map<string, Song>
    const song = songsMap.get(id)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
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

    const songsMap = global.songs as Map<string, Song>
    if (!songsMap.has(id)) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    songsMap.delete(id)

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("DELETE song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
