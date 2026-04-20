/**
 * GET /api/songs/[id]/download
 * Downloads audio - either from R2 or directly from source URL
 */
import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { isR2Configured, getAudioStream, extractObjectKeyFromUrl } from "@/lib/storage"

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

function getFileExtension(contentType: string | null): string {
  if (contentType?.includes("wav")) return "wav"
  if (contentType?.includes("flac")) return "flac"
  if (contentType?.includes("pcm")) return "pcm"
  if (contentType?.includes("mpeg") || contentType?.includes("mp3")) return "mp3"
  return "mp3"
}

function applyBinarySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.delete("Content-Security-Policy")
  return response
}

async function fetchAudioFromUrl(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  return { buffer, contentType }
}

async function streamFromR2(objectKey: string): Promise<{ body: Buffer; contentType: string; contentLength: number }> {
  const stream = await getAudioStream(objectKey)
  return {
    body: stream.body,
    contentType: stream.contentType,
    contentLength: stream.contentLength,
  }
}

async function uploadToR2IfNeeded(audioUrl: string, songId: string): Promise<string | null> {
  // If already R2 URL, no upload needed
  if (extractObjectKeyFromUrl(audioUrl)) {
    return null
  }

  // If R2 not configured, skip upload
  if (!isR2Configured()) {
    return null
  }

  try {
    const { uploadAudioFromUrl } = await import('@/lib/storage')
    const result = await uploadAudioFromUrl(audioUrl, songId)

    // Update database with R2 URL
    try {
      await prisma.song.update({
        where: { id: songId },
        data: { audioUrl: result.r2Url },
      })
      // Update memory cache
      const songsMap = global.songs as Map<string, Song> | undefined
      const cachedSong = songsMap?.get(songId)
      if (cachedSong) {
        songsMap!.set(songId, { ...cachedSong, audioUrl: result.r2Url })
      }
    } catch (updateError) {
      console.error("[Download] Failed to update song audioUrl:", updateError)
    }

    return result.r2Url
  } catch (uploadError) {
    console.error("[Download] Failed to upload to R2:", uploadError)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shareToken = request.nextUrl.searchParams.get("shareToken")

    const user = getSessionUser(request)
    if (!user && !shareToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch song from memory or database
    let song: Song | null = (global.songs as Map<string, Song> | undefined)?.get(id) || null

    if (!song) {
      try {
        const dbSong = await prisma.song.findUnique({ where: { id } })
        if (dbSong) {
          song = {
            ...dbSong,
            moderationStatus: "APPROVED",
            audioUrl: dbSong.audioUrl || undefined,
            coverUrl: dbSong.coverUrl || undefined,
            createdAt: dbSong.createdAt ? dbSong.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: dbSong.updatedAt ? dbSong.updatedAt.toISOString() : new Date().toISOString(),
          } as unknown as Song
        }
      } catch (dbError) {
        console.error("Prisma lookup failed:", dbError)
      }
    }

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Authorization check
    const hasSharedAccess = Boolean(shareToken && song.shareToken === shareToken)
    const hasUserAccess = Boolean(user && (song.userId === user.id || user.role === "ADMIN"))

    if (!hasSharedAccess && !hasUserAccess) {
      return NextResponse.json(
        { error: shareToken ? "Song not found or invalid share token" : "Forbidden" },
        { status: shareToken ? 404 : 403 }
      )
    }

    if (!song.audioUrl) {
      return NextResponse.json({ error: "Audio not available" }, { status: 404 })
    }

    let audioUrl = song.audioUrl
    let body: Buffer
    let contentType: string
    let contentLength: number

    // Check if we should use R2
    const r2Configured = isR2Configured()
    const isR2Url = Boolean(extractObjectKeyFromUrl(audioUrl))

    if (r2Configured && !isR2Url) {
      // R2 configured but URL is not R2 - try to upload
      const newR2Url = await uploadToR2IfNeeded(audioUrl, id)
      if (newR2Url) {
        // Upload succeeded, get object key and stream from R2
        audioUrl = newR2Url
        const objectKey = extractObjectKeyFromUrl(audioUrl)
        if (objectKey) {
          console.log(`[Download] Streaming from R2: ${objectKey}`)
          const r2Stream = await streamFromR2(objectKey)
          body = r2Stream.body
          contentType = r2Stream.contentType
          contentLength = r2Stream.contentLength
        } else {
          // Fallback to URL fetch
          const urlFetch = await fetchAudioFromUrl(audioUrl)
          body = Buffer.from(urlFetch.buffer)
          contentType = urlFetch.contentType
          contentLength = body.length
        }
      } else {
        // Upload failed or skipped, fall back to direct URL fetch
        console.log(`[Download] Falling back to direct URL fetch: ${audioUrl}`)
        const urlFetch = await fetchAudioFromUrl(audioUrl)
        body = Buffer.from(urlFetch.buffer)
        contentType = urlFetch.contentType
        contentLength = body.length
      }
    } else if (r2Configured && isR2Url) {
      // Already R2 URL, stream directly from R2
      const objectKey = extractObjectKeyFromUrl(audioUrl)
      if (objectKey) {
        console.log(`[Download] Streaming from R2: ${objectKey}`)
        const r2Stream = await streamFromR2(objectKey)
        body = r2Stream.body
        contentType = r2Stream.contentType
        contentLength = r2Stream.contentLength
      } else {
        return NextResponse.json({ error: "Invalid R2 URL" }, { status: 500 })
      }
    } else {
      // R2 not configured, stream directly from URL
      console.log(`[Download] R2 not configured, streaming from: ${audioUrl}`)
      const urlFetch = await fetchAudioFromUrl(audioUrl)
      body = Buffer.from(urlFetch.buffer)
      contentType = urlFetch.contentType
      contentLength = body.length
    }

    const extension = getFileExtension(contentType)
    const filename = `${song.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') || 'audio'}.${extension}`

    console.log(`[Download] Serving: ${filename}, size: ${contentLength}`)

    return applyBinarySecurityHeaders(new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': contentLength.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }))
  } catch (error) {
    console.error("[Download] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
