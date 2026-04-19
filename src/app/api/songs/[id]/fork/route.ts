import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

if (!global.users) global.users = new Map()

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

/**
 * Fork/Remix Song API (Workaround Implementation)
 *
 * EXPERIMENTAL: This is NOT a native remix API.
 *
 * MiniMax API does not yet support native remix functionality (混音/remix).
 * See: docs/minimax-api-reference.md - "混音 (remix)" is marked as pending.
 *
 * Current workaround:
 * - Copies the original song's generation parameters (title, lyrics, genre, etc.)
 * - Returns these parameters to the generate page
 * - User clicks generate to create a "remix" with the same parameters
 *
 * IMPORTANT: This endpoint does NOT create a database entry.
 * The actual song is only created when the user clicks Generate on the generate page.
 * This prevents "phantom" songs from appearing in the user's list without explicit generation.
 *
 * When MiniMax releases native remix API, this should be replaced with:
 * - Native API call with source song reference
 * - In-place modification without regeneration
 * - True audio mixing capabilities
 */
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
    const body = await request.json().catch(() => ({}))
    const { modifications } = body

    // Fetch original song from storage
    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const originalSong = songsMap.get(id)
    if (!originalSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Check ownership - only owner or admin can fork
    if (originalSong.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate modifications object if provided
    const allowedModifications = ['title', 'lyrics', 'genre', 'mood', 'instruments', 'referenceSinger', 'referenceSong', 'userNotes']
    if (modifications && typeof modifications === 'object') {
      const invalidKeys = Object.keys(modifications).filter(key => !allowedModifications.includes(key))
      if (invalidKeys.length > 0) {
        return NextResponse.json(
          { error: "Invalid modification fields", details: `Forbidden fields: ${invalidKeys.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Prepare forked song parameters (DO NOT persist to database)
    // The actual song creation happens only when user clicks Generate
    const forkedParams = {
      title: modifications?.title || `${originalSong.title} (Remix)`,
      lyrics: modifications?.lyrics || originalSong.lyrics,
      genre: modifications?.genre || originalSong.genre,
      mood: modifications?.mood || originalSong.mood,
      instruments: modifications?.instruments || originalSong.instruments,
      referenceSinger: modifications?.referenceSinger ?? originalSong.referenceSinger,
      referenceSong: modifications?.referenceSong ?? originalSong.referenceSong,
      userNotes: modifications?.userNotes ?? originalSong.userNotes,
      isInstrumental: originalSong.isInstrumental,
    }

    return NextResponse.json({
      originalId: id,
      originalOwnerId: originalSong.userId, // Include for attribution display
      forkedParams,
      message: "Song parameters copied. Redirect to generate page to create remix.",
      // Note: No songId is created here - actual song is created on Generate page
      redirectUrl: `/generate?fork=${id}`,
      experimental: true,
      note: "This uses parameter copy + regenerate workaround. Native remix API pending MiniMax release."
    })
  } catch (error) {
    console.error("Fork error:", error)
    return NextResponse.json(
      { error: "Failed to fork song" },
      { status: 500 }
    )
  }
}
