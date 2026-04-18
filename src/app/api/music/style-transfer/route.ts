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

export interface StyleTransferRequest {
  audioUrl: string
  targetGenre?: string[] // e.g., ['Jazz', 'Electronic']
  targetMood?: string // e.g., 'Calm', 'Energetic'
  targetInstruments?: string[] // e.g., ['Piano', 'Guitar']
  referenceAudioUrl?: string // Style reference
  preserveVocals?: boolean // Keep original vocals
  intensity?: number // 0.0 to 1.0, how much to apply style
}

/**
 * Music Style Transfer API
 *
 * Transforms music from one style to another while preserving
 * the core melody and vocals (if requested).
 *
 * In production:
 * - Use an AI audio style transfer model
 * - Options: DDSP, DiffWave, or commercial services like
 *   Adobe Podcast, iZotope, or LANDR
 * - Could also use MiniMax if they support style transfer
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: StyleTransferRequest = await request.json()
    const {
      audioUrl,
      targetGenre,
      targetMood,
      targetInstruments,
      referenceAudioUrl,
      preserveVocals = true,
      intensity = 0.7
    } = body

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 })
    }

    if (!targetGenre && !targetMood && !targetInstruments && !referenceAudioUrl) {
      return NextResponse.json(
        { error: "At least one style target is required (genre, mood, instruments, or referenceAudio)" },
        { status: 400 }
      )
    }

    if (intensity < 0 || intensity > 1) {
      return NextResponse.json({ error: "intensity must be between 0 and 1" }, { status: 400 })
    }

    // Check user tier
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    if (!isPro) {
      return NextResponse.json(
        { error: "Style transfer is available for Pro users only" },
        { status: 403 }
      )
    }

    // In production, this would:
    // 1. Download the source audio
    // 2. Apply AI style transfer based on:
    //    - Target genre/mood/instruments
    //    - Reference audio (if provided)
    //    - Intensity setting
    // 3. Preserve vocals if requested
    // 4. Upload the styled audio
    // 5. Return the new URL

    // Placeholder response
    const styledUrl = audioUrl // In production, this would be the styled file URL

    return NextResponse.json({
      success: true,
      originalUrl: audioUrl,
      styledUrl,
      styleSettings: {
        targetGenre: targetGenre || [],
        targetMood: targetMood || null,
        targetInstruments: targetInstruments || [],
        referenceAudioUrl: referenceAudioUrl || null,
        preserveVocals,
        intensity
      },
      message: "Style transfer requires server-side AI processing. This is a placeholder."
    })
  } catch (error) {
    console.error("Style transfer error:", error)
    return NextResponse.json({ error: "Failed to apply style transfer" }, { status: 500 })
  }
}
