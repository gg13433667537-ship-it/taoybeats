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

export interface VideoSoundtrackRequest {
  videoUrl: string
  audioUrl?: string // If not provided, generate new audio
  genre?: string[]
  mood?: string
  duration?: number // Target duration (will sync to video)
  fadeIn?: number // Audio fade in duration
  fadeOut?: number // Audio fade out duration
  volume?: number // Audio volume (0.0 to 1.0)
  outputFormat?: 'mp4' | 'webm'
  quality?: '720p' | '1080p' | '4k'
}

/**
 * Video Soundtrack API
 *
 * Adds or generates soundtrack for video content.
 * Either use an existing audio track or generate new music to match the video.
 *
 * In production:
 * - Use FFmpeg for video/audio merging
 * - For AI-generated soundtracks, integrate with MiniMax or similar
 * - Video analysis could determine mood/tempo for generated music
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: VideoSoundtrackRequest = await request.json()
    const {
      videoUrl,
      audioUrl,
      genre,
      mood,
      duration,
      fadeIn = 0,
      fadeOut = 2,
      volume = 0.8,
      outputFormat = 'mp4',
      quality = '1080p'
    } = body

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 })
    }

    // Check user tier
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    if (!isPro) {
      return NextResponse.json(
        { error: "Video soundtrack is available for Pro users only" },
        { status: 403 }
      )
    }

    // Video quality restrictions for non-4K
    if (quality === '4k' && !isPro) {
      return NextResponse.json(
        { error: "4K output is available for Pro users only" },
        { status: 403 }
      )
    }

    // In production, this would:
    // 1. Download the source video
    // 2. If audioUrl provided:
    //    - Use FFmpeg to merge video with audio track
    //    - Apply fade in/out and volume adjustments
    // 3. If no audioUrl:
    //    - Analyze video (if AI analysis available)
    //    - Generate appropriate soundtrack using AI
    //    - Merge generated audio with video
    // 4. Upload the final video
    // 5. Return the new video URL

    // Placeholder response
    const finalVideoUrl = videoUrl // In production, this would be the final video URL

    return NextResponse.json({
      success: true,
      originalVideoUrl: videoUrl,
      finalVideoUrl,
      audioUrl: audioUrl || 'AI-generated',
      genre: genre || [],
      mood: mood || 'auto-detected',
      outputFormat,
      quality,
      fadeIn,
      fadeOut,
      volume,
      message: "Video soundtrack processing requires server-side processing. This is a placeholder."
    })
  } catch (error) {
    console.error("Video soundtrack error:", error)
    return NextResponse.json({ error: "Failed to process video soundtrack" }, { status: 500 })
  }
}
