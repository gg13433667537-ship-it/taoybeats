import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partGroupId: string }> }
) {
  try {
    const { partGroupId } = await params

    if (!partGroupId) {
      return NextResponse.json({ error: "partGroupId is required" }, { status: 400 })
    }

    // Fetch all songs with the same partGroupId, ordered by part number
    const dbSongs = await prisma.song.findMany({
      where: { partGroupId },
      orderBy: { part: "asc" },
    })

    if (dbSongs.length === 0) {
      return NextResponse.json({ error: "No songs found with this partGroupId" }, { status: 404 })
    }

    const songs: Song[] = dbSongs.map((s) => ({
      id: s.id,
      title: s.title,
      lyrics: s.lyrics || undefined,
      genre: s.genre,
      mood: s.mood || undefined,
      instruments: s.instruments,
      referenceSinger: s.referenceSinger || undefined,
      referenceSong: s.referenceSong || undefined,
      userNotes: s.userNotes || undefined,
      isInstrumental: false,
      status: s.status as Song['status'],
      moderationStatus: "APPROVED",
      audioUrl: s.audioUrl || undefined,
      coverUrl: s.coverUrl || undefined,
      shareToken: s.shareToken || undefined,
      userId: s.userId,
      partGroupId: s.partGroupId || undefined,
      part: s.part || undefined,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    return NextResponse.json({ songs })
  } catch (error) {
    console.error("GET songs by partGroupId error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
