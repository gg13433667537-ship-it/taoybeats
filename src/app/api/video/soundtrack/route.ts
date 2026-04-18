import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, rateLimitMiddleware, DEFAULT_RATE_LIMIT, sanitizeString, validateNumber, validateStringArray, MAX_LENGTHS } from "@/lib/security"


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
 * Validate video URL format
 */
function validateVideoUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) {
    return "videoUrl is required"
  }
  if (url.length > MAX_LENGTHS.PROMPT) {
    return "videoUrl must not exceed 2000 characters"
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return "videoUrl must be a valid HTTP or HTTPS URL"
    }
  } catch {
    return "videoUrl must be a valid URL"
  }
  return null
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
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "video-soundtrack")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body: VideoSoundtrackRequest = await request.json()
    const {
      videoUrl,
      audioUrl,
      genre,
      mood,
      fadeIn = 0,
      fadeOut = 2,
      volume = 0.8,
      outputFormat = 'mp4',
      quality = '1080p'
    } = body

    // Validate videoUrl
    const videoUrlError = validateVideoUrl(videoUrl)
    if (videoUrlError) {
      return applySecurityHeaders(NextResponse.json({ error: videoUrlError }, { status: 400 }))
    }

    // Sanitize videoUrl
    const sanitizedVideoUrl = sanitizeString(videoUrl)
    if (!sanitizedVideoUrl) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid videoUrl" }, { status: 400 }))
    }

    // Validate optional audioUrl if provided
    if (audioUrl) {
      const audioUrlError = validateVideoUrl(audioUrl)
      if (audioUrlError) {
        return applySecurityHeaders(NextResponse.json({ error: audioUrlError }, { status: 400 }))
      }
    }

    // Validate genre array
    if (genre !== undefined) {
      const validatedGenre = validateStringArray(genre, MAX_LENGTHS.GENRE, 10, "Genre")
      if (!validatedGenre) {
        return applySecurityHeaders(NextResponse.json({ error: "Invalid genre format" }, { status: 400 }))
      }
    }

    // Validate mood
    if (mood !== undefined && typeof mood === 'string') {
      const sanitizedMood = sanitizeString(mood)
      if (sanitizedMood.length > MAX_LENGTHS.MOOD) {
        return applySecurityHeaders(NextResponse.json({ error: `Mood must not exceed ${MAX_LENGTHS.MOOD} characters` }, { status: 400 }))
      }
    }

    // Validate fadeIn
    const validatedFadeIn = fadeIn !== undefined ? validateNumber(fadeIn, 0, 60, "fadeIn") : 0
    if (fadeIn !== undefined && validatedFadeIn === null) {
      return applySecurityHeaders(NextResponse.json({ error: "fadeIn must be a number between 0 and 60" }, { status: 400 }))
    }

    // Validate fadeOut
    const validatedFadeOut = fadeOut !== undefined ? validateNumber(fadeOut, 0, 60, "fadeOut") : 2
    if (fadeOut !== undefined && validatedFadeOut === null) {
      return applySecurityHeaders(NextResponse.json({ error: "fadeOut must be a number between 0 and 60" }, { status: 400 }))
    }

    // Validate volume
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      return applySecurityHeaders(NextResponse.json({ error: "volume must be between 0 and 1" }, { status: 400 }))
    }

    // Validate outputFormat
    if (!['mp4', 'webm'].includes(outputFormat)) {
      return applySecurityHeaders(NextResponse.json({ error: "outputFormat must be 'mp4' or 'webm'" }, { status: 400 }))
    }

    // Validate quality
    if (!['720p', '1080p', '4k'].includes(quality)) {
      return applySecurityHeaders(NextResponse.json({ error: "quality must be '720p', '1080p', or '4k'" }, { status: 400 }))
    }

    // Check user tier
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    if (!isPro) {
      return applySecurityHeaders(NextResponse.json(
        { error: "Video soundtrack is available for Pro users only" },
        { status: 403 }
      ))
    }

    // 4K quality requires Pro - already checked above via isPro
    // Note: Pro users have access to all quality levels

    // Check if MiniMax API key is configured
    const apiKey = global.systemApiKey
    // Note: API URL reserved for future MiniMax video API integration

    if (!apiKey) {
      console.error("Video soundtrack: MINIMAX_API_KEY not configured")
      return applySecurityHeaders(NextResponse.json(
        { error: "Service not configured. Please contact support." },
        { status: 500 }
      ))
    }

    // In production, this would:
    // 1. Download the source video
    // 2. If audioUrl provided:
    //    - Use FFmpeg to merge video with audio track
    //    - Apply fade in/out and volume adjustments
    // 3. If no audioUrl:
    //    - Analyze video (if AI analysis available)
    //    - Generate appropriate soundtrack using MiniMax API
    //    - Merge generated audio with video
    // 4. Upload the final video
    // 5. Return the new video URL

    // Placeholder response - in production, this would call MiniMax API
    const finalVideoUrl = sanitizedVideoUrl // In production, this would be the final video URL

    return applySecurityHeaders(NextResponse.json({
      success: true,
      originalVideoUrl: sanitizedVideoUrl,
      finalVideoUrl,
      audioUrl: audioUrl ? sanitizeString(audioUrl) : 'AI-generated',
      genre: genre || [],
      mood: mood ? sanitizeString(mood) : 'auto-detected',
      outputFormat,
      quality,
      fadeIn: validatedFadeIn ?? 0,
      fadeOut: validatedFadeOut ?? 2,
      volume,
      message: "Video soundtrack processing requires server-side processing. This is a placeholder."
    }))
  } catch (error) {
    console.error("Video soundtrack error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to process video soundtrack" }, { status: 500 }))
  }
}
