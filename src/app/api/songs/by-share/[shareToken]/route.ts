import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { prisma } from "@/lib/db"


if (!global.users) global.users = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params

  try {
    // Try in-memory cache first
    const songsMap = global.songs as Map<string, Song> | undefined
    if (songsMap) {
      let foundSong: Song | undefined
      songsMap.forEach((song) => {
        if (song.shareToken === shareToken) {
          foundSong = song
        }
      })

      if (foundSong) {
        return NextResponse.json(foundSong)
      }
    }

    // Fall back to Prisma database
    try {
      const dbSong = await prisma.song.findFirst({
        where: { shareToken },
      })

      if (dbSong) {
        const song: Song = {
          id: dbSong.id,
          title: dbSong.title,
          lyrics: dbSong.lyrics || undefined,
          genre: dbSong.genre,
          mood: dbSong.mood || undefined,
          instruments: dbSong.instruments,
          referenceSinger: dbSong.referenceSinger || undefined,
          referenceSong: dbSong.referenceSong || undefined,
          userNotes: dbSong.userNotes || undefined,
          isInstrumental: false,
          status: dbSong.status as Song['status'],
          moderationStatus: dbSong.moderationStatus as Song['moderationStatus'],
          audioUrl: dbSong.audioUrl || undefined,
          coverUrl: dbSong.coverUrl || undefined,
          shareToken: dbSong.shareToken || undefined,
          userId: dbSong.userId,
          createdAt: dbSong.createdAt.toISOString(),
          updatedAt: dbSong.updatedAt.toISOString(),
        }

        // Update in-memory cache
        if (songsMap) {
          songsMap.set(song.id, song)
        }

        return NextResponse.json(song)
      }
    } catch (dbError) {
      console.error("Prisma lookup failed:", dbError)
    }

    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  } catch (error) {
    console.error("Error fetching song by shareToken:", error)
    return NextResponse.json(
      { error: "Failed to fetch song" },
      { status: 500 }
    )
  }
}
