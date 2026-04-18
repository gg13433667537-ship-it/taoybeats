import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { miniMaxProvider } from "@/lib/ai-providers"

// Global storage shared from songs route

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
 * Track Continuation API
 *
 * Extends an existing song by generating a continuation.
 * The continuation uses the original song's style, genre, mood, and instruments
 * as a base, and optionally accepts a custom continuation prompt.
 *
 * POST /api/songs/[id]/continue
 * Body: { prompt?: string; startFrom?: 'end' | 'timestamp'; duration?: number }
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
        { error: "Can only continue completed songs" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      prompt, // Optional: custom continuation prompt
      startFrom = 'end', // Where to start the continuation
      duration = 60, // Duration in seconds (default 1 minute)
    } = body

    // Build continuation prompt from original song + custom prompt
    const continuationPrompt = buildContinuationPrompt(originalSong, prompt)

    // Create a new song record for the continuation
    const songId = crypto.randomUUID()
    const now = new Date().toISOString()
    const shareToken = crypto.randomUUID().slice(0, 8)

    const continuedSong: Song = {
      id: songId,
      userId: user.id,
      title: `${originalSong.title} (Continued)`,
      lyrics: originalSong.lyrics, // Keep original lyrics as reference
      genre: originalSong.genre,
      mood: originalSong.mood,
      instruments: originalSong.instruments,
      referenceSinger: originalSong.referenceSinger,
      referenceSong: originalSong.referenceSong,
      userNotes: prompt ? `Continuation: ${prompt}` : 'Continued from original',
      isInstrumental: originalSong.isInstrumental,
      voiceId: originalSong.voiceId,
      model: originalSong.model,
      status: "PENDING",
      moderationStatus: "APPROVED",
      shareToken,
      createdAt: now,
      updatedAt: now,
      forkedFrom: originalSongId, // Track that this is a continuation
    }

    songsMap.set(songId, continuedSong)

    // Start generation in background
    const apiKey = global.systemApiKey || process.env.MINIMAX_API_KEY
    const apiUrl = global.systemApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

    if (apiKey) {
      // Pass original audio URL for proper continuation with reference audio
      generateContinuation(songId, continuedSong, continuationPrompt, originalSong.audioUrl || '', apiKey, apiUrl).catch((err) => {
        console.error(`[Continue] Song ${songId} generation failed:`, err)
      })
    }

    return NextResponse.json({
      id: songId,
      originalId: originalSongId,
      shareToken,
      status: "PENDING",
      message: "Track continuation started. Use the stream endpoint to track progress.",
      streamUrl: `/api/songs/${songId}/stream`,
      redirectUrl: `/song/${songId}`,
    })
  } catch (error) {
    console.error("Continue error:", error)
    return NextResponse.json(
      { error: "Failed to create continuation" },
      { status: 500 }
    )
  }
}

/**
 * Build a prompt for track continuation based on the original song
 */
function buildContinuationPrompt(song: Song, customPrompt?: string): string {
  const parts: string[] = []

  // Reference the original style
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

  // Add custom prompt if provided
  if (customPrompt) {
    parts.push(`Continuation request: ${customPrompt}`)
  } else {
    parts.push(`Continue the song naturally from where it ended`)
  }

  return parts.join('; ')
}

async function generateContinuation(
  songId: string,
  song: Song,
  prompt: string,
  originalAudioUrl: string,
  apiKey: string,
  apiUrl: string
) {
  const songsMap = global.songs as Map<string, Song>

  try {
    songsMap.set(songId, { ...song, status: "GENERATING", updatedAt: new Date().toISOString() })

    // Use miniMaxProvider.continue() for proper track continuation with reference audio
    if (!miniMaxProvider.continue) {
      throw new Error('Continue not supported by this provider')
    }

    const taskId = await miniMaxProvider.continue({
      originalAudioUrl,
      prompt,
      model: song.model,
    }, apiKey, apiUrl)

    // Poll for progress
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl)

      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      songsMap.set(songId, {
        ...currentSong,
        status: progress.status,
        audioUrl: progress.audioUrl,
        updatedAt: new Date().toISOString(),
      })

      if (progress.status === 'COMPLETED') {
        console.log(`[Continue] Song ${songId} completed`)
        break
      }

      if (progress.status === 'FAILED') {
        console.error(`[Continue] Song ${songId} failed`)
        break
      }
    }

    // Final status check
    const finalSong = songsMap.get(songId)
    if (finalSong && finalSong.status !== 'COMPLETED' && finalSong.status !== 'FAILED') {
      songsMap.set(songId, {
        ...finalSong,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error(`[Continue] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
  }
}
