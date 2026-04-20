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

/**
 * Sanitize a filename to be safe for ASCII header values
 * Removes all non-ASCII and special characters
 */
function sanitizeAsciiFilename(filename: string, extension: string): string {
  // Replace any non-ASCII, non-alphanumeric characters with underscore
  const sanitized = filename.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'audio'
  return `${sanitized}.${extension}`.toLowerCase()
}

/**
 * Encode a filename using RFC 5987 (extended notation for non-ASCII in Content-Disposition)
 * Example: "囚鸟.mp3" -> "UTF-8''%E5%9B%9A%E9%B8%9F.mp3"
 */
function encodeRFC5987Filename(filename: string): string {
  // Split filename into name and extension parts properly
  // Handle cases where filename has or doesn't have an extension
  const lastDotIndex = filename.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1
  const name = hasExtension ? filename.substring(0, lastDotIndex) : filename
  const ext = hasExtension ? filename.substring(lastDotIndex + 1) : 'mp3'

  // Encode just the name part (not the extension)
  const encoded = encodeURIComponent(name).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `UTF-8''${encoded}.${ext}`
}

/**
 * Build a Content-Disposition header value that is safe for both ASCII and non-ASCII filenames
 * Uses RFC 5987 encoding for the extended filename* parameter
 */
function buildContentDisposition(filename: string, extension: string): string {
  const asciiFilename = sanitizeAsciiFilename(filename, extension)
  const rfc5987Filename = encodeRFC5987Filename(filename)
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${rfc5987Filename.replace(/^UTF-8''/, '')}`
}

function applyBinarySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.delete("Content-Security-Policy")
  return response
}

async function fetchAudioFromUrl(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  console.log(`[Download] Fetching audio from URL: ${url.substring(0, 100)}...`)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      // Check for expiration errors (Aliyun OSS returns XML error)
      if (responseText.includes('Expired') || responseText.includes('AccessDenied') || responseText.includes('Request has expired')) {
        throw new Error('Audio URL has expired. The song may need to be regenerated.')
      }
      throw new Error(`Failed to fetch audio: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    console.log(`[Download] Fetched audio: ${buffer.byteLength} bytes, type: ${contentType}`)
    return { buffer, contentType }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fetch timeout after 30s for URL: ${url.substring(0, 100)}...`)
    }
    throw error
  }
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
  console.log(`[Download] uploadToR2IfNeeded called for song ${songId}, URL: ${audioUrl.substring(0, 80)}...`)

  // If already R2 URL, no upload needed
  const objectKey = extractObjectKeyFromUrl(audioUrl)
  if (objectKey) {
    console.log(`[Download] Already R2 URL with key: ${objectKey}`)
    return null
  }

  // If R2 not configured, skip upload
  if (!isR2Configured()) {
    console.log(`[Download] R2 not configured, skipping upload`)
    return null
  }

  try {
    console.log(`[Download] Starting R2 upload for song ${songId}...`)
    const { uploadAudioFromUrl } = await import('@/lib/storage')
    const result = await uploadAudioFromUrl(audioUrl, songId)
    console.log(`[Download] R2 upload succeeded: ${result.r2Url}, size: ${result.size}`)

    // Update database with R2 URL
    try {
      await prisma.song.update({
        where: { id: songId },
        data: { audioUrl: result.r2Url },
      })
      console.log(`[Download] Updated database with R2 URL for song ${songId}`)

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
    console.error(`[Download] Failed to upload to R2 for song ${songId}:`, uploadError)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const shareToken = request.nextUrl.searchParams.get("shareToken")

  try {

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

    const contentDisposition = buildContentDisposition(song.title, extension)

    return applyBinarySecurityHeaders(new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': contentLength.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }))
  } catch (error) {
    // Enhanced error logging with details
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`[Download] Error for song ${id}:`, {
      message: errorMessage,
      stack: errorStack,
    })

    // Return specific error messages instead of generic 500
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: "Download timed out. The audio source may be slow or unavailable." },
        { status: 504 }
      )
    }

    if (errorMessage.includes('expired') || errorMessage.includes('Expired')) {
      return NextResponse.json(
        { error: "Audio URL has expired. Please regenerate the song to get a fresh download link." },
        { status: 410 } // 410 Gone - resource no longer available
      )
    }

    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        { error: "Failed to fetch audio from source. The audio URL may be invalid or expired." },
        { status: 502 }
      )
    }

    if (errorMessage.includes('R2') || errorMessage.includes('S3') || errorMessage.includes('Cloudflare')) {
      return NextResponse.json(
        { error: "Storage service error. Please try again later." },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: `Download failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
