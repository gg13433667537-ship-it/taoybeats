import { NextRequest, NextResponse } from "next/server"
import type { User, Song } from "@/lib/types"
import { musicProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { } from "@/lib/security"
import crypto from "crypto"


if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

const users = global.users!

// Free tier limits
const FREE_DAILY_LIMIT = 3
const FREE_MONTHLY_LIMIT = 10

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function getOrCreateUser(userId: string, email?: string): User {
  let user = users.get(userId)
  if (!user) {
    user = {
      id: userId,
      email: email || `${userId}@example.com`,
      name: email?.split('@')[0] || 'User',
      role: 'USER',
      isActive: true,
      tier: 'FREE',
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: getDateKey(),
      monthlyResetAt: getMonthKey(),
      createdAt: new Date().toISOString(),
    }
    users.set(userId, user)
  }
  return user
}

function checkAndResetUsage(user: User) {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  if (user.dailyResetAt !== today) {
    user.dailyUsage = 0
    user.dailyResetAt = today
  }

  if (user.monthlyResetAt !== thisMonth) {
    user.monthlyUsage = 0
    user.monthlyResetAt = thisMonth
  }
}

function getSessionUser(request: NextRequest): User | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return null
  }

  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return null
    }
    return getOrCreateUser(payload.id, payload.email)
  } catch {
    return null
  }
}

// POST /api/songs/batch - Create multiple songs at once
export async function POST(request: NextRequest) {
  try {
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { songs: songsToCreate } = body

    if (!Array.isArray(songsToCreate) || songsToCreate.length === 0) {
      return NextResponse.json(
        { error: "songs array is required" },
        { status: 400 }
      )
    }

    // Limit batch size
    const maxBatchSize = 5
    if (songsToCreate.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Maximum batch size is ${maxBatchSize}` },
        { status: 400 }
      )
    }

    // Validate API key
    const apiKey = global.systemApiKey
    const apiUrl = global.systemApiUrl || 'https://api.minimaxi.com'

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please set MINIMAX_API_KEY environment variable." },
        { status: 500 }
      )
    }

    // Check usage limits
    checkAndResetUsage(user)

    const results: Array<{ id: string; shareToken: string; status: string; error?: string }> = []

    for (const songData of songsToCreate) {
      const { title, lyrics, genre, mood, instruments, referenceSinger, referenceSong, userNotes, isInstrumental, voiceId, referenceAudio } = songData

      // Validate required fields
      if (!title || (!isInstrumental && !lyrics) || !genre?.length || !mood) {
        results.push({
          id: '',
          shareToken: '',
          status: 'FAILED',
          error: "Missing required fields: title, lyrics, genre, mood"
        })
        continue
      }

      // Check usage limits before each song
      if (user.tier === 'FREE') {
        if (user.dailyUsage >= FREE_DAILY_LIMIT) {
          results.push({
            id: '',
            shareToken: '',
            status: 'FAILED',
            error: `Daily limit reached (${FREE_DAILY_LIMIT})`
          })
          continue
        }

        if (user.monthlyUsage >= FREE_MONTHLY_LIMIT) {
          results.push({
            id: '',
            shareToken: '',
            status: 'FAILED',
            error: `Monthly limit reached (${FREE_MONTHLY_LIMIT})`
          })
          continue
        }
      }

      // Increment usage
      user.dailyUsage++
      user.monthlyUsage++

      // Create song record
      const songId = crypto.randomUUID()
      const now = new Date().toISOString()
      const shareToken = crypto.randomUUID().slice(0, 8)

      const song: Song = {
        id: songId,
        userId: user.id,
        title,
        lyrics,
        genre,
        mood,
        instruments: instruments || [],
        referenceSinger,
        referenceSong,
        userNotes,
        isInstrumental: isInstrumental || false,
        voiceId,
        referenceAudio,
        status: "PENDING",
        moderationStatus: "APPROVED",
        shareToken,
        createdAt: now,
        updatedAt: now,
      }

      const songsMap = global.songs as Map<string, Song>
      songsMap.set(songId, song)

      // Persist song to database
      try {
        await prisma.song.create({
          data: {
            id: songId,
            title: song.title,
            lyrics: song.lyrics || null,
            genre: song.genre,
            mood: song.mood || null,
            instruments: song.instruments,
            referenceSinger: song.referenceSinger || null,
            referenceSong: song.referenceSong || null,
            userNotes: song.userNotes || null,
            status: "PENDING",
            lyricsCompressionApplied: false,
            shareToken: shareToken,
            userId: user.id,
            isInstrumental: song.isInstrumental,
            voiceId: song.voiceId || null,
            referenceAudio: song.referenceAudio || null,
          },
        })
        console.log(`Song ${songId} persisted to database`)
      } catch (error) {
        console.error(`Failed to persist song ${songId}:`, error)
      }

      // Start background generation
      generateMusic(songId, song, apiKey, apiUrl).catch((err) => {
        console.error(`[BatchGenerate] Song ${songId} failed:`, err)
      })

      results.push({
        id: songId,
        shareToken,
        status: "PENDING"
      })
    }

    return NextResponse.json({
      results,
      usage: {
        daily: { used: user.dailyUsage, limit: FREE_DAILY_LIMIT },
        monthly: { used: user.monthlyUsage, limit: FREE_MONTHLY_LIMIT },
      },
    })
  } catch (error) {
    console.error("Batch create songs error:", error)
    return NextResponse.json(
      { error: "Failed to create songs" },
      { status: 500 }
    )
  }
}

async function generateMusic(
  songId: string,
  song: Song,
  apiKey: string,
  apiUrl?: string
) {
  const songsMap = global.songs as Map<string, Song>

  try {
    songsMap.set(songId, { ...song, status: "GENERATING", updatedAt: new Date().toISOString() })

    const taskId = await musicProvider.generate({
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
    }, apiKey, apiUrl || 'https://api.minimaxi.com')

    const maxWaitTime = 10 * 60 * 1000
    const pollInterval = 5000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await musicProvider.getProgress(taskId, apiKey, apiUrl || 'https://api.minimaxi.com')

      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      songsMap.set(songId, {
        ...currentSong,
        status: progress.status,
        audioUrl: progress.audioUrl,
        updatedAt: new Date().toISOString(),
      })

      if (progress.status === 'COMPLETED') {
        console.log(`[BatchGenerate] Song ${songId} completed`)
        // Persist final status to database
        try {
          await prisma.song.update({
            where: { id: songId },
            data: {
              status: "COMPLETED",
              audioUrl: progress.audioUrl || null,
              providerTaskId: taskId,
            },
          })
          console.log(`Song ${songId} final status persisted to database`)
        } catch (error) {
          console.error(`Failed to persist song ${songId} status:`, error)
        }
        break
      }

      if (progress.status === 'FAILED') {
        console.error(`[BatchGenerate] Song ${songId} failed:`, progress.error)
        // Persist final status to database
        try {
          await prisma.song.update({
            where: { id: songId },
            data: {
              status: "FAILED",
              errorMessage: progress.error || "Generation failed",
              providerTaskId: taskId,
            },
          })
          console.log(`Song ${songId} failure status persisted to database`)
        } catch (error) {
          console.error(`Failed to persist song ${songId} failure status:`, error)
        }
        break
      }
    }

    const finalSong = songsMap.get(songId)
    if (finalSong && finalSong.status !== 'COMPLETED' && finalSong.status !== 'FAILED') {
      songsMap.set(songId, {
        ...finalSong,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
      })
      // Persist timeout status to database
      try {
        await prisma.song.update({
          where: { id: songId },
          data: {
            status: "FAILED",
            errorMessage: "Generation timed out",
          },
        })
        console.log(`Song ${songId} timeout status persisted to database`)
      } catch (error) {
        console.error(`Failed to persist song ${songId} timeout status:`, error)
      }
    }
  } catch (error) {
    console.error(`[BatchGenerate] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
    // Persist error status to database
    try {
      await prisma.song.update({
        where: { id: songId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      })
      console.log(`Song ${songId} error status persisted to database`)
    } catch (dbError) {
      console.error(`Failed to persist song ${songId} error status:`, dbError)
    }
  }
}