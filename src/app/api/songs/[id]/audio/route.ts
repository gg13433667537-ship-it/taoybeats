import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { prisma } from "@/lib/db"
import { applySecurityHeaders } from "@/lib/security"
import { isR2Configured, extractObjectKeyFromUrl, uploadAudioFromUrl, getAudioStream } from "@/lib/storage"

function isR2Url(url: string): boolean {
  return extractObjectKeyFromUrl(url) !== null
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

    // Ensure audio is on R2 - upload if needed
    let audioUrl = song.audioUrl
    const objectKey = extractObjectKeyFromUrl(audioUrl)

    if (!objectKey && isR2Configured()) {
      // Not an R2 URL - try to upload
      try {
        console.log(`[Audio] Uploading to R2 for song ${id}...`)
        const result = await uploadAudioFromUrl(audioUrl, id)
        audioUrl = result.r2Url
        console.log(`[Audio] Uploaded to R2: ${result.r2Url}`)

        // Update database with new R2 URL
        await prisma.song.update({
          where: { id },
          data: { audioUrl: result.r2Url },
        }).catch(err => console.error("[Audio] Failed to update DB with R2 URL:", err))
      } catch (error) {
        console.error("[Audio] R2 upload failed, using original URL:", error)
        // Fall back to original URL even if R2 upload failed
      }
    }

    // Stream from R2 if available
    const r2Key = extractObjectKeyFromUrl(audioUrl)
    if (r2Key) {
      try {
        const stream = await getAudioStream(r2Key)
        const range = request.headers.get("range")

        if (range) {
          // Handle range request for R2 stream
          const parts = range.replace(/bytes=/, "").split("-")
          const start = parseInt(parts[0], 10)
          const end = parts[1] ? parseInt(parts[1], 10) : stream.contentLength - 1
          const chunkSize = end - start + 1
          const chunk = stream.body.slice(start, start + chunkSize)

          const headers = new Headers()
          headers.set("Content-Type", stream.contentType)
          headers.set("Content-Length", chunkSize.toString())
          headers.set("Content-Range", `bytes ${start}-${end}/${stream.contentLength}`)
          headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate")

          return applySecurityHeaders(new NextResponse(chunk, {
            status: 206,
            headers,
          }), 'api')
        }

        const headers = new Headers()
        headers.set("Content-Type", stream.contentType)
        headers.set("Content-Length", stream.contentLength.toString())
        headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate")

        return applySecurityHeaders(new NextResponse(new Uint8Array(stream.body), {
          status: 200,
          headers,
        }), 'api')
      } catch (error) {
        console.error("[Audio] R2 stream failed:", error)
        return NextResponse.json({ error: "Failed to stream audio from storage" }, { status: 500 })
      }
    }

    // Fall back to direct URL fetch
    const range = request.headers.get("range")
    const audioResponse = await fetch(audioUrl, {
      headers: range ? { Range: range } : undefined,
    })

    if (!audioResponse.ok) {
      console.error("[Audio] Failed to fetch source audio:", audioResponse.status)
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

    return applySecurityHeaders(new NextResponse(audioResponse.body, {
      status: audioResponse.status,
      headers,
    }), 'api')
  } catch (error) {
    console.error("[Audio Proxy] Internal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
