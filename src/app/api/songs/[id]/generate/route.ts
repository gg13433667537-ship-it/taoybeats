import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"
import { miniMaxProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
  var systemApiKey: string | undefined
  var systemApiUrl: string | undefined
}

if (!global.users) global.users = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { modifications } = body

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const existingSong = songsMap.get(id)
    if (!existingSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin to regenerate
    if (existingSong.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use system API key - not from request body
    const apiKey = global.systemApiKey
    const apiUrl = global.systemApiUrl || 'https://api.minimaxi.com'

    // Apply modifications or keep existing
    const updatedSong: Song = {
      ...existingSong,
      ...modifications,
      id: existingSong.id, // Keep original ID
      status: "PENDING",
      updatedAt: new Date().toISOString(),
    }

    songsMap.set(id, updatedSong)

    // Validate API key is configured
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please set MINIMAX_API_KEY environment variable." },
        { status: 500 }
      )
    }

    // Start generation in background
    generateMusic(id, updatedSong, apiKey, apiUrl).catch((err) => {
      console.error(`[Regenerate] Song ${id} background generation failed:`, err)
    })

    return NextResponse.json({
      id,
      status: "PENDING",
      message: "Regeneration started",
    })
  } catch (error) {
    console.error("Generate error:", error)
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    )
  }
}

async function generateMusic(
  songId: string,
  song: Song,
  apiKey: string,
  apiUrl: string
) {
  const songsMap = global.songs as Map<string, Song>

  try {
    // Update status to GENERATING
    songsMap.set(songId, { ...song, status: "GENERATING", updatedAt: new Date().toISOString() })

    // Call MiniMax API
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
      referenceAudio: song.referenceAudio,
    }, apiKey, apiUrl)

    // Poll for progress
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes max
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl)

      // Update song with latest status
      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      songsMap.set(songId, {
        ...currentSong,
        status: progress.status,
        audioUrl: progress.audioUrl,
        updatedAt: new Date().toISOString(),
      })

      if (progress.status === 'COMPLETED') {
        console.log(`[Regenerate] Song ${songId} completed, audioUrl: ${progress.audioUrl}`)
        break
      }

      if (progress.status === 'FAILED') {
        console.error(`[Regenerate] Song ${songId} failed:`, progress.error)
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
    console.error(`[Regenerate] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
  }
}