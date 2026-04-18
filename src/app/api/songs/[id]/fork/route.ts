import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"


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
    const body = await request.json()
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

    // Create forked song with same parameters (optionally modified)
    const songId = crypto.randomUUID()
    const now = new Date().toISOString()
    const shareToken = crypto.randomUUID().slice(0, 8)

    const forkedSong: Song = {
      id: songId,
      userId: user.id, // Use current user's ID
      title: modifications?.title || `${originalSong.title} (Remix)`,
      lyrics: modifications?.lyrics || originalSong.lyrics,
      genre: modifications?.genre || originalSong.genre,
      mood: modifications?.mood || originalSong.mood,
      instruments: modifications?.instruments || originalSong.instruments,
      referenceSinger: modifications?.referenceSinger ?? originalSong.referenceSinger,
      referenceSong: modifications?.referenceSong ?? originalSong.referenceSong,
      userNotes: modifications?.userNotes ?? originalSong.userNotes,
      status: "PENDING",
      moderationStatus: "APPROVED", // Auto-approve for MVP
      shareToken,
      createdAt: now,
      updatedAt: now,
      forkedFrom: id, // Track the original song
    }

    songsMap.set(songId, forkedSong)

    // Persist to Prisma - if this fails, the forked song cannot be created
    try {
      await prisma.song.create({
        data: {
          id: songId,
          title: forkedSong.title,
          lyrics: forkedSong.lyrics || null,
          genre: forkedSong.genre,
          mood: forkedSong.mood || null,
          instruments: forkedSong.instruments,
          referenceSinger: forkedSong.referenceSinger || null,
          referenceSong: forkedSong.referenceSong || null,
          userNotes: forkedSong.userNotes || null,
          status: "PENDING",
          audioUrl: null,
          coverUrl: null,
          shareToken: shareToken,
          userId: user.id,
          forkedFrom: id, // Track the original song
        },
      })
    } catch (prismaError) {
      console.error("Failed to persist forked song to Prisma:", prismaError)
      // Clean up in-memory song since we couldn't persist
      songsMap.delete(songId)
      return NextResponse.json(
        { error: "Failed to fork song. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: songId,
      originalId: id,
      shareToken,
      status: "PENDING",
      forkedParams: {
        title: forkedSong.title,
        genre: forkedSong.genre,
        mood: forkedSong.mood,
      },
      message: "Song forked successfully. Redirect to generate page to customize.",
      redirectUrl: `/generate?fork=${id}&songId=${songId}`,
    })
  } catch (error) {
    console.error("Fork error:", error)
    return NextResponse.json(
      { error: "Failed to fork song" },
      { status: 500 }
    )
  }
}