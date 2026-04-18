import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, rateLimitMiddleware, DEFAULT_RATE_LIMIT } from "@/lib/security"

// Initialize global state
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
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

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'aac' | 'ogg' | 'm4a' | 'pcm'

export interface ConvertRequest {
  audioUrl: string
  outputFormat: AudioFormat
  quality?: 'low' | 'medium' | 'high' | 'lossless'
  bitrate?: number
}

// Quality and bitrate validation constants
const VALID_QUALITIES = ['low', 'medium', 'high', 'lossless'] as const
const MIN_BITRATE = 32000   // 32 kbps minimum
const MAX_BITRATE = 1411200 // 1411.2 kbps (CD quality) maximum
const MAX_AUDIO_URL_LENGTH = 2048

/**
 * Audio Format Conversion API
 *
 * Converts audio from one format to another.
 * Supports: MP3, WAV, FLAC, AAC, OGG, M4A, PCM
 *
 * Note: This is a placeholder implementation. In production:
 * - Use FFmpeg for audio conversion
 * - Or integrate with a cloud audio processing service like
 *   Cloudflare Stream, AWS MediaConvert, or similar
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "audio-convert")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body: ConvertRequest = await request.json()
    const { audioUrl, outputFormat, quality = 'high', bitrate } = body

    // Validate audioUrl
    if (!audioUrl) {
      return applySecurityHeaders(NextResponse.json({ error: "audioUrl is required" }, { status: 400 }))
    }

    // Validate audioUrl format and length
    let parsedUrl: URL
    try {
      parsedUrl = new URL(audioUrl)
    } catch {
      return applySecurityHeaders(NextResponse.json({ error: "audioUrl must be a valid URL" }, { status: 400 }))
    }

    // Only allow http and https protocols to prevent SSRF
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return applySecurityHeaders(NextResponse.json({ error: "audioUrl must use HTTP or HTTPS protocol" }, { status: 400 }))
    }

    // Check URL length to prevent DoS
    if (audioUrl.length > MAX_AUDIO_URL_LENGTH) {
      return applySecurityHeaders(NextResponse.json({ error: "audioUrl exceeds maximum length" }, { status: 400 }))
    }

    if (!outputFormat) {
      return applySecurityHeaders(NextResponse.json({ error: "outputFormat is required" }, { status: 400 }))
    }

    // Validate quality
    if (quality && !VALID_QUALITIES.includes(quality as typeof VALID_QUALITIES[number])) {
      return applySecurityHeaders(NextResponse.json(
        { error: `Invalid quality. Supported: ${VALID_QUALITIES.join(', ')}` },
        { status: 400 }
      ))
    }

    // Validate bitrate if provided
    if (bitrate !== undefined) {
      if (typeof bitrate !== 'number' || !Number.isInteger(bitrate)) {
        return applySecurityHeaders(NextResponse.json({ error: "bitrate must be an integer" }, { status: 400 }))
      }
      if (bitrate < MIN_BITRATE || bitrate > MAX_BITRATE) {
        return applySecurityHeaders(NextResponse.json(
          { error: `bitrate must be between ${MIN_BITRATE} and ${MAX_BITRATE}` },
          { status: 400 }
        ))
      }
    }

    const supportedFormats: AudioFormat[] = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'pcm']
    if (!supportedFormats.includes(outputFormat)) {
      return applySecurityHeaders(NextResponse.json(
        { error: `Unsupported format. Supported: ${supportedFormats.join(', ')}` },
        { status: 400 }
      ))
    }

    // Check user tier for format availability
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    // FLAC is Pro only
    if (outputFormat === 'flac' && !isPro) {
      return applySecurityHeaders(NextResponse.json(
        { error: "FLAC format is available for Pro users only" },
        { status: 403 }
      ))
    }

    // In production, this would:
    // 1. Download the source audio
    // 2. Convert using FFmpeg or audio processing service
    // 3. Upload the converted file
    // 4. Return the new URL

    // Return 501 Not Implemented since conversion is not yet available
    return applySecurityHeaders(NextResponse.json({
      success: false,
      error: "Audio format conversion is not yet implemented",
      originalUrl: audioUrl,
      outputFormat,
      quality,
      bitrate: bitrate || getDefaultBitrate(outputFormat, quality),
    }, { status: 501 }))
  } catch (error) {
    console.error("Audio convert error:", error)

    // Handle JSON parse errors with specific message
    if (error instanceof SyntaxError && 'body' in error) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 }))
    }

    return applySecurityHeaders(NextResponse.json({ error: "Failed to process audio conversion request" }, { status: 500 }))
  }
}

function getDefaultBitrate(format: AudioFormat, quality: string): number {
  const bitrates: Record<string, number> = {
    mp3: quality === 'lossless' ? 320000 : quality === 'high' ? 256000 : quality === 'medium' ? 128000 : 64000,
    aac: quality === 'lossless' ? 256000 : quality === 'high' ? 192000 : quality === 'medium' ? 128000 : 64000,
    ogg: quality === 'lossless' ? 256000 : quality === 'high' ? 192000 : quality === 'medium' ? 128000 : 96000,
    m4a: quality === 'lossless' ? 256000 : quality === 'high' ? 192000 : quality === 'medium' ? 128000 : 96000,
    flac: 1000000, // Lossless, but variable
    wav: 1411000, // CD quality PCM
    pcm: 1411000, // Raw PCM
  }
  return bitrates[format] || 256000
}
