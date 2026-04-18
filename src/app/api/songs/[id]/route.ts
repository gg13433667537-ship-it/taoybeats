import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { sanitizeString, validateRequiredString, validateOptionalString, validateStringArray, MAX_LENGTHS } from "@/lib/security"


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
    // Add sanitization for each field
    const allowedUpdates: Partial<Song> = {}

    if ('title' in body) {
      const titleError = validateRequiredString(body.title, MAX_LENGTHS.TITLE, "Title")
      if (titleError) {
        return NextResponse.json({ error: titleError }, { status: 400 })
      }
      allowedUpdates.title = sanitizeString(body.title)
    }

    if ('lyrics' in body) {
      const lyricsError = validateOptionalString(body.lyrics, MAX_LENGTHS.LYRICS, "Lyrics")
      if (lyricsError) {
        return NextResponse.json({ error: lyricsError }, { status: 400 })
      }
      allowedUpdates.lyrics = body.lyrics ? sanitizeString(body.lyrics) : undefined
    }

    if ('genre' in body) {
      if (!Array.isArray(body.genre)) {
        return NextResponse.json({ error: "Genre must be an array" }, { status: 400 })
      }
      const sanitizedGenre = validateStringArray(body.genre, MAX_LENGTHS.GENRE, 10, "Genre")
      if (!sanitizedGenre) {
        return NextResponse.json({ error: "Invalid genre format" }, { status: 400 })
      }
      allowedUpdates.genre = sanitizedGenre
    }

    if ('mood' in body) {
      const moodError = validateOptionalString(body.mood, MAX_LENGTHS.MOOD, "Mood")
      if (moodError) {
        return NextResponse.json({ error: moodError }, { status: 400 })
      }
      allowedUpdates.mood = body.mood ? sanitizeString(body.mood) : undefined
    }

    if ('instruments' in body) {
      const sanitizedInstruments = validateStringArray(body.instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments")
      if (!sanitizedInstruments) {
        return NextResponse.json({ error: "Invalid instruments format" }, { status: 400 })
      }
      allowedUpdates.instruments = sanitizedInstruments
    }

    if ('referenceSinger' in body) {
      const refError = validateOptionalString(body.referenceSinger, MAX_LENGTHS.NAME, "Reference singer")
      if (refError) {
        return NextResponse.json({ error: refError }, { status: 400 })
      }
      allowedUpdates.referenceSinger = body.referenceSinger ? sanitizeString(body.referenceSinger) : undefined
    }

    if ('referenceSong' in body) {
      const refError = validateOptionalString(body.referenceSong, MAX_LENGTHS.TITLE, "Reference song")
      if (refError) {
        return NextResponse.json({ error: refError }, { status: 400 })
      }
      allowedUpdates.referenceSong = body.referenceSong ? sanitizeString(body.referenceSong) : undefined
    }

    if ('userNotes' in body) {
      const notesError = validateOptionalString(body.userNotes, MAX_LENGTHS.NOTES, "User notes")
      if (notesError) {
        return NextResponse.json({ error: notesError }, { status: 400 })
      }
      allowedUpdates.userNotes = body.userNotes ? sanitizeString(body.userNotes) : undefined
    }

    if ('isInstrumental' in body) {
      allowedUpdates.isInstrumental = body.isInstrumental === true || body.isInstrumental === "true"
    }

    if ('voiceId' in body) {
      const voiceError = validateOptionalString(body.voiceId, MAX_LENGTHS.NAME, "Voice ID")
      if (voiceError) {
        return NextResponse.json({ error: voiceError }, { status: 400 })
      }
      allowedUpdates.voiceId = body.voiceId ? sanitizeString(body.voiceId) : undefined
    }

    if ('status' in body) {
      const allowedStatuses = ['PENDING', 'GENERATING', 'COMPLETED', 'FAILED']
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      allowedUpdates.status = body.status
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