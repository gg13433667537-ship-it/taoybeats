import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"

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
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body: ConvertRequest = await request.json()
    const { audioUrl, outputFormat, quality = 'high', bitrate } = body

    if (!audioUrl) {
      return applySecurityHeaders(NextResponse.json({ error: "audioUrl is required" }, { status: 400 }))
    }

    if (!outputFormat) {
      return applySecurityHeaders(NextResponse.json({ error: "outputFormat is required" }, { status: 400 }))
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

    // Placeholder response
    const convertedUrl = audioUrl // In production, this would be the converted file URL

    return NextResponse.json({
      success: true,
      originalUrl: audioUrl,
      convertedUrl,
      outputFormat,
      quality,
      bitrate: bitrate || getDefaultBitrate(outputFormat, quality),
      message: "Format conversion requires server-side audio processing. This is a placeholder."
    })
  } catch (error) {
    console.error("Audio convert error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to convert audio" }, { status: 500 }))
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
