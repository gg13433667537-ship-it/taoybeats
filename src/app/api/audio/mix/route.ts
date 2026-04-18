import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"


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

export interface MixTrack {
  audioUrl: string
  volume: number // 0.0 to 1.0
  startTime: number // offset in seconds
  fadeIn?: number // fade in duration
  fadeOut?: number // fade out duration
}

export interface MixRequest {
  tracks: MixTrack[]
  outputFormat?: 'mp3' | 'wav' | 'flac'
  sampleRate?: 16000 | 24000 | 32000 | 44100 | 48000
  bitrate?: number
  normalize?: boolean // normalize volumes
}

/**
 * Audio Mixing API
 *
 * Mix multiple audio tracks together with volume control and timing.
 *
 * In production:
 * - Use FFmpeg for audio mixing
 * - Or integrate with a cloud audio processing service like
 *   Cloudflare Stream, AWS Elemental MediaConvert, or similar
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: MixRequest = await request.json()
    const { tracks, outputFormat = 'mp3', sampleRate = 44100, bitrate = 256000, normalize = true } = body

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: "At least one track is required" }, { status: 400 })
    }

    if (tracks.length > 10) {
      return NextResponse.json({ error: "Maximum 10 tracks allowed per mix" }, { status: 400 })
    }

    // Validate each track
    for (const track of tracks) {
      if (!track.audioUrl) {
        return NextResponse.json({ error: "Each track must have an audioUrl" }, { status: 400 })
      }
      if (track.volume < 0 || track.volume > 1) {
        return NextResponse.json({ error: "Track volume must be between 0 and 1" }, { status: 400 })
      }
      if (track.startTime < 0) {
        return NextResponse.json({ error: "Track startTime must be >= 0" }, { status: 400 })
      }
    }

    // Check user tier for mix capability
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    if (tracks.length > 3 && !isPro) {
      return NextResponse.json(
        { error: "Free users can mix up to 3 tracks. Upgrade to Pro for up to 10 tracks." },
        { status: 403 }
      )
    }

    // In production, this would:
    // 1. Download all source audios
    // 2. Use FFmpeg to mix with volume and timing controls
    // 3. Apply normalization if requested
    // 4. Upload the mixed file
    // 5. Return the new URL

    // Calculate total duration (max of all track startTime + their durations)
    const maxDuration = Math.max(...tracks.map(t => t.startTime + 300)) // Assume 5min per track

    // Placeholder response
    const mixedUrl = tracks[0]?.audioUrl // In production, this would be the mixed file URL

    return NextResponse.json({
      success: true,
      trackCount: tracks.length,
      mixedUrl,
      outputFormat,
      sampleRate,
      bitrate,
      normalized: normalize,
      estimatedDuration: maxDuration,
      message: "Audio mixing requires server-side processing. This is a placeholder."
    })
  } catch (error) {
    console.error("Audio mix error:", error)
    return NextResponse.json({ error: "Failed to mix audio" }, { status: 500 })
  }
}
