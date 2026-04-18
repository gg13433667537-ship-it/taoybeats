import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


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

export interface TrimRequest {
  audioUrl: string
  startTime: number // in seconds
  endTime: number // in seconds
  fadeIn?: number // fade in duration in seconds
  fadeOut?: number // fade out duration in seconds
  outputFormat?: 'mp3' | 'wav' | 'flac'
}

/**
 * Audio Trimming/Cutting API
 *
 * Cuts a section from an audio file with optional fade in/out.
 *
 * In production:
 * - Use FFmpeg for audio trimming
 * - Or integrate with a cloud audio processing service
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: TrimRequest = await request.json()
    const { audioUrl, startTime, endTime, fadeIn = 0, fadeOut = 0, outputFormat = 'mp3' } = body

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 })
    }

    if (startTime < 0) {
      return NextResponse.json({ error: "startTime must be >= 0" }, { status: 400 })
    }

    if (endTime <= startTime) {
      return NextResponse.json({ error: "endTime must be greater than startTime" }, { status: 400 })
    }

    // Max duration check (10 minutes for free users)
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'
    const maxDuration = isPro ? 600 : 120 // Pro: 10min, Free: 2min

    if (endTime - startTime > maxDuration) {
      return NextResponse.json(
        { error: `Trimmed audio exceeds maximum duration. Pro users can trim up to 10 minutes.` },
        { status: 400 }
      )
    }

    // In production, this would:
    // 1. Download the source audio
    // 2. Use FFmpeg to trim with optional fade in/out
    // 3. Upload the trimmed file
    // 4. Return the new URL

    // Placeholder response
    const trimmedUrl = audioUrl // In production, this would be the trimmed file URL
    const duration = endTime - startTime

    return NextResponse.json({
      success: true,
      originalUrl: audioUrl,
      trimmedUrl,
      duration,
      startTime,
      endTime,
      fadeIn,
      fadeOut,
      outputFormat,
      message: "Audio trimming requires server-side processing. This is a placeholder."
    })
  } catch (error) {
    console.error("Audio trim error:", error)
    return NextResponse.json({ error: "Failed to trim audio" }, { status: 500 })
  }
}
