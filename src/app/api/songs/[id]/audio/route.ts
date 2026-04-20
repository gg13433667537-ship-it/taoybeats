import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { uploadAndWaitForR2 } from "@/lib/r2-upload-queue"
import { prisma } from "@/lib/db"

function isR2Url(url: string): boolean {
  const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
  return r2PublicUrl.length > 0 && url.startsWith(r2PublicUrl)
}

async function getSongById(id: string): Promise<Song | null> {
  const songsMap = global.songs as Map<string, Song> | undefined
  const cachedSong = songsMap?.get(id)
  if (cachedSong) {
    return cachedSong
  }

  try {
    const dbSong = await prisma.song.findUnique({
      where: { id },
    })

    if (!dbSong) {
      return null
    }

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
      moderationStatus: "APPROVED",
      audioUrl: dbSong.audioUrl || undefined,
      coverUrl: dbSong.coverUrl || undefined,
      shareToken: dbSong.shareToken || undefined,
      userId: dbSong.userId,
      partGroupId: dbSong.partGroupId || undefined,
      part: dbSong.part || undefined,
      createdAt: dbSong.createdAt.toISOString(),
      updatedAt: dbSong.updatedAt.toISOString(),
    }

    songsMap?.set(id, song)
    return song
  } catch (dbError) {
    console.error("[Audio Proxy] Prisma lookup failed:", dbError)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const song = await getSongById(id)

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    if (!song.audioUrl) {
      return NextResponse.json({ error: "Audio not available" }, { status: 404 })
    }

    // Ensure audio is on R2 (wait for upload if needed)
    let audioUrl = song.audioUrl
    if (!isR2Url(audioUrl)) {
      try {
        audioUrl = await uploadAndWaitForR2(id, audioUrl)
      } catch (error) {
        console.error("[Audio Proxy] R2 upload failed, falling back to original URL:", error)
        // Fall back to original URL even if R2 upload failed
      }
    }

    const range = request.headers.get("range")
    const audioResponse = await fetch(audioUrl, {
      headers: range ? { Range: range } : undefined,
    })

    if (!audioResponse.ok) {
      console.error("[Audio Proxy] Failed to fetch source audio:", audioResponse.status)
      return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", audioResponse.headers.get("content-type") || "audio/mpeg")
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate")

    for (const headerName of ["accept-ranges", "content-length", "content-range", "etag", "last-modified"]) {
      const value = audioResponse.headers.get(headerName)
      if (value) {
        headers.set(headerName, value)
      }
    }

    return new NextResponse(audioResponse.body, {
      status: audioResponse.status,
      headers,
    })
  } catch (error) {
    console.error("[Audio Proxy] Internal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
