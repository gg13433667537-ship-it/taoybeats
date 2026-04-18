import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { miniMaxProvider } from "@/lib/ai-providers"

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

/**
 * Extended Generation API
 *
 * Generates an extended version of a song (3-5 minutes) by chaining
 * multiple generation segments using the continue API with reference_audio
 * to maintain style consistency.
 *
 * POST /api/songs/[id]/extend
 * Body: { targetDuration?: number; prompt?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: originalSongId } = await params

    // Auth check
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const originalSong = songsMap.get(originalSongId)
    if (!originalSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Check ownership
    if (originalSong.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if original is completed
    if (originalSong.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: "Can only extend completed songs" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      targetDuration = 300, // Default 5 minutes
      prompt, // Optional: custom continuation prompt
    } = body

    // Validate target duration (max 5 minutes = 300 seconds)
    if (targetDuration < 60 || targetDuration > 300) {
      return NextResponse.json(
        { error: "Target duration must be between 60 and 300 seconds" },
        { status: 400 }
      )
    }

    const apiKey = global.systemApiKey || process.env.MINIMAX_API_KEY
    const apiUrl = global.systemApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      )
    }

    // Create a new song record for the extended version
    const songId = crypto.randomUUID()
    const now = new Date().toISOString()
    const shareToken = crypto.randomUUID().slice(0, 8)

    const extendedSong: Song = {
      id: songId,
      userId: user.id,
      title: `${originalSong.title} (Extended)`,
      lyrics: originalSong.lyrics,
      genre: originalSong.genre,
      mood: originalSong.mood,
      instruments: originalSong.instruments,
      referenceSinger: originalSong.referenceSinger,
      referenceSong: originalSong.referenceSong,
      userNotes: prompt ? `Extended: ${prompt}` : 'Extended version from original',
      isInstrumental: originalSong.isInstrumental,
      voiceId: originalSong.voiceId,
      status: "PENDING",
      moderationStatus: "APPROVED",
      shareToken,
      createdAt: now,
      updatedAt: now,
      forkedFrom: originalSongId,
    }

    songsMap.set(songId, extendedSong)

    // Start extended generation in background
    generateExtendedVersion(songId, extendedSong, originalSong.audioUrl || '', targetDuration, prompt, apiKey, apiUrl).catch((err) => {
      console.error(`[Extend] Song ${songId} extended generation failed:`, err)
    })

    return NextResponse.json({
      id: songId,
      originalId: originalSongId,
      shareToken,
      status: "PENDING",
      targetDuration,
      message: "Extended version generation started. Use the stream endpoint to track progress.",
      streamUrl: `/api/songs/${songId}/stream`,
      redirectUrl: `/song/${songId}`,
    })
  } catch (error) {
    console.error("Extend error:", error)
    return NextResponse.json(
      { error: "Failed to create extended version" },
      { status: 500 }
    )
  }
}

/**
 * Generate an extended version of a song by chaining multiple continue segments
 */
async function generateExtendedVersion(
  songId: string,
  song: Song,
  originalAudioUrl: string,
  targetDuration: number,
  customPrompt: string | undefined,
  apiKey: string,
  apiUrl: string
) {
  const songsMap = global.songs as Map<string, Song>

  try {
    songsMap.set(songId, { ...song, status: "GENERATING", updatedAt: new Date().toISOString() })

    // Build continuation prompt
    const continuationPrompt = buildContinuationPrompt(song, customPrompt)

    // MiniMax API generates ~2 minutes per segment
    // Strategy: Generate segments and chain them
    // First segment: 2 minutes, then continue with ~60s segments
    const segmentDuration = 120 // 2 minutes per segment
    const continueDuration = 60 // 1 minute per continue

    let currentAudioUrl = originalAudioUrl
    let currentDuration = 0
    let segmentCount = 0
    const maxSegments = 5 // Max 5 segments = ~5-6 minutes

    // First, check if we need to generate initial segment
    // If originalAudioUrl is from an existing song, we can start from there
    if (!originalAudioUrl) {
      // Need to generate initial segment first
      console.log(`[Extend] Song ${songId}: No original audio, generating initial segment`)
      currentAudioUrl = await generateInitialSegment(song, apiKey, apiUrl)
      if (!currentAudioUrl) {
        throw new Error("Failed to generate initial segment")
      }
      currentDuration = segmentDuration
      segmentCount = 1
    } else {
      currentDuration = await getAudioDuration(originalAudioUrl) || 0
      console.log(`[Extend] Song ${songId}: Starting with ${currentDuration}s audio`)
    }

    // Continue until we reach target duration
    while (currentDuration < targetDuration && segmentCount < maxSegments) {
      console.log(`[Extend] Song ${songId}: Continuing... current=${currentDuration}s target=${targetDuration}s`)

      const nextAudioUrl = await continueSong(currentAudioUrl, continuationPrompt, continueDuration, apiKey, apiUrl)
      if (!nextAudioUrl) {
        console.warn(`[Extend] Song ${songId}: Continue returned no audio, stopping`)
        break
      }

      currentAudioUrl = nextAudioUrl
      currentDuration += continueDuration
      segmentCount++

      // Update progress
      const progress = Math.min(95, Math.round((currentDuration / targetDuration) * 100))
      songsMap.set(songId, {
        ...songsMap.get(songId)!,
        status: "GENERATING",
        audioUrl: currentAudioUrl,
        updatedAt: new Date().toISOString(),
      })
    }

    // Mark as completed
    songsMap.set(songId, {
      ...songsMap.get(songId)!,
      status: "COMPLETED",
      audioUrl: currentAudioUrl,
      updatedAt: new Date().toISOString(),
    })

    console.log(`[Extend] Song ${songId} completed with ${currentDuration}s audio`)
  } catch (error) {
    console.error(`[Extend] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Generate initial segment for extension
 */
async function generateInitialSegment(
  song: Song,
  apiKey: string,
  apiUrl: string
): Promise<string | null> {
  try {
    const taskId = await miniMaxProvider.generate({
      title: song.title,
      lyrics: song.lyrics || '',
      genre: song.genre,
      mood: song.mood || '',
      instruments: song.instruments,
      referenceSinger: song.referenceSinger,
      referenceSong: song.referenceSong,
      userNotes: song.userNotes,
      isInstrumental: song.isInstrumental,
      voiceId: song.voiceId,
    }, apiKey, apiUrl)

    // Poll for completion
    const maxWaitTime = 10 * 60 * 1000
    const pollInterval = 5000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl)

      if (progress.status === 'COMPLETED' && progress.audioUrl) {
        return progress.audioUrl
      }

      if (progress.status === 'FAILED') {
        console.error(`[Extend] Initial segment generation failed`)
        return null
      }
    }

    return null
  } catch (error) {
    console.error(`[Extend] Initial segment error:`, error)
    return null
  }
}

/**
 * Continue a song using reference_audio for style consistency
 */
async function continueSong(
  referenceAudioUrl: string,
  prompt: string,
  duration: number,
  apiKey: string,
  apiUrl: string
): Promise<string | null> {
  try {
    const taskId = await miniMaxProvider.continue({
      originalAudioUrl: referenceAudioUrl,
      prompt,
      duration,
    }, apiKey, apiUrl)

    if (!taskId) {
      return null
    }

    // Handle synchronous completion (audio URL prefixed with 'audio:')
    if (taskId.startsWith('audio:')) {
      return taskId.slice(6)
    }

    // Poll for completion
    const maxWaitTime = 10 * 60 * 1000
    const pollInterval = 5000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl)

      if (progress.status === 'COMPLETED' && progress.audioUrl) {
        return progress.audioUrl
      }

      if (progress.status === 'FAILED') {
        console.error(`[Extend] Continue failed`)
        return null
      }
    }

    return null
  } catch (error) {
    console.error(`[Extend] Continue error:`, error)
    return null
  }
}

/**
 * Get audio duration from URL (approximate)
 */
async function getAudioDuration(audioUrl: string): Promise<number | null> {
  try {
    // For MiniMax URLs, we can estimate based on the generation params
    // This is an approximation - in production you'd want to fetch audio metadata
    // Return a default estimate of 120 seconds (2 minutes)
    return 120
  } catch {
    return null
  }
}

/**
 * Build a prompt for song continuation
 */
function buildContinuationPrompt(song: Song, customPrompt?: string): string {
  const parts: string[] = []

  if (song.genre.length > 0) {
    parts.push(`Style: ${song.genre.join(', ')}`)
  }

  if (song.mood) {
    parts.push(`Mood: ${song.mood}`)
  }

  if (song.instruments.length > 0) {
    parts.push(`Instruments: ${song.instruments.join(', ')}`)
  }

  if (song.referenceSinger) {
    parts.push(`Vocal style similar to: ${song.referenceSinger}`)
  }

  if (customPrompt) {
    parts.push(`Continuation request: ${customPrompt}`)
  } else {
    parts.push(`Continue the song naturally, maintaining the same style, mood, and tempo`)
  }

  return parts.join('; ')
}
