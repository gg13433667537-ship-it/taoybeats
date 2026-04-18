import { NextRequest, NextResponse } from "next/server"
import type { User, Song } from "@/lib/types"
import { miniMaxProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"
import { checkDuplicateGeneration } from "@/lib/cache"
import { prisma } from "@/lib/db"

// Shared global storage

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()
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

function getSessionUser(request: NextRequest): User {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    const demoUserId = 'demo-user'
    return getOrCreateUser(demoUserId, 'demo@taoybeats.com')
  }

  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return getOrCreateUser('demo-user')
    }
    return getOrCreateUser(payload.id, payload.email)
  } catch {
    return getOrCreateUser('demo-user')
  }
}

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)

  // Try Prisma first, fall back to memory
  let userSongs: Song[] = []

  try {
    const dbSongs = await prisma.song.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
    userSongs = dbSongs.map((s) => ({
      id: s.id,
      title: s.title,
      lyrics: s.lyrics || undefined,
      genre: s.genre,
      mood: s.mood || undefined,
      instruments: s.instruments,
      referenceSinger: s.referenceSinger || undefined,
      referenceSong: s.referenceSong || undefined,
      userNotes: s.userNotes || undefined,
      isInstrumental: false,
      status: s.status,
      moderationStatus: "APPROVED" as const,
      audioUrl: s.audioUrl || undefined,
      coverUrl: s.coverUrl || undefined,
      shareToken: s.shareToken || undefined,
      userId: s.userId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    // Also update in-memory cache
    const songsMap = global.songs as Map<string, Song>
    userSongs.forEach((s) => songsMap.set(s.id, s))
  } catch (prismaError) {
    console.error("Prisma song lookup failed, falling back to memory:", prismaError)
    const songsMap = global.songs as Map<string, Song> | undefined
    if (songsMap) {
      userSongs = Array.from(songsMap.values()).filter((s) => s.userId === user.id)
    }
  }

  return NextResponse.json({ songs: userSongs })
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUser(request)
    const body = await request.json()
    const {
      title,
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceSong,
      userNotes,
      isInstrumental,
      voiceId,
      referenceAudio,
      model,
      outputFormat,
      lyricsOptimizer,
      sampleRate,
      bitrate,
      aigcWatermark,
    } = body

    // Validation - lyrics not required if instrumental
    if (!title || (!isInstrumental && !lyrics) || !genre?.length || !mood) {
      return NextResponse.json(
        { error: "Missing required fields: title, lyrics, genre, mood" },
        { status: 400 }
      )
    }

    // Request deduplication - prevent duplicate generation requests
    if (checkDuplicateGeneration(user.id, title)) {
      return NextResponse.json(
        {
          error: "Duplicate request",
          message: "A generation request for this song was recently submitted. Please wait a moment before trying again.",
          code: "DUPLICATE_REQUEST",
        },
        { status: 429 }
      )
    }

    // Use system API key - no client-side API key required
    const apiKey = global.systemApiKey
    const apiUrl = global.systemApiUrl || 'https://api.minimaxi.com'

    // Validate API key is configured
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please set MINIMAX_API_KEY environment variable." },
        { status: 500 }
      )
    }

    // Check usage limits
    checkAndResetUsage(user)

    if (user.tier === 'FREE') {
      if (user.dailyUsage >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `You've used all ${FREE_DAILY_LIMIT} free generations today. Upgrade to Pro for 50/day.`,
            daily: { used: user.dailyUsage, limit: FREE_DAILY_LIMIT },
            code: "DAILY_LIMIT_REACHED",
          },
          { status: 429 }
        )
      }

      if (user.monthlyUsage >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: "Monthly limit reached",
            message: `You've used all ${FREE_MONTHLY_LIMIT} free generations this month. Upgrade to Pro for unlimited.`,
            monthly: { used: user.monthlyUsage, limit: FREE_MONTHLY_LIMIT },
            code: "MONTHLY_LIMIT_REACHED",
          },
          { status: 429 }
        )
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
      model: model || 'music-2.6',
      outputFormat: outputFormat || 'mp3',
      lyricsOptimizer: lyricsOptimizer || false,
      sampleRate: sampleRate || 44100,
      bitrate: bitrate || 256000,
      aigcWatermark: aigcWatermark || false,
      status: "PENDING",
      moderationStatus: "APPROVED", // Auto-approve for MVP
      shareToken,
      createdAt: now,
      updatedAt: now,
    }

    const songsMap = global.songs as Map<string, Song>
    songsMap.set(songId, song)

    // Persist to Prisma
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
          audioUrl: null,
          coverUrl: null,
          shareToken: shareToken,
          userId: user.id,
        },
      })
    } catch (prismaError) {
      console.error("Failed to persist song to Prisma:", prismaError)
      // Continue anyway - song is in memory
    }

    // Start real generation in background
    generateMusic(songId, song, apiKey, apiUrl).catch((err) => {
      console.error(`[Generate] Song ${songId} background generation failed:`, err)
    })

    return NextResponse.json({
      id: songId,
      shareToken,
      status: "PENDING",
      usage: {
        daily: { used: user.dailyUsage, limit: FREE_DAILY_LIMIT },
        monthly: { used: user.monthlyUsage, limit: FREE_MONTHLY_LIMIT },
      },
    })
  } catch (error) {
    console.error("Error creating song:", error)
    return NextResponse.json(
      { error: "Failed to create song" },
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
      model: song.model || 'music-2.6',
      outputFormat: song.outputFormat,
      lyricsOptimizer: song.lyricsOptimizer,
      sampleRate: song.sampleRate,
      bitrate: song.bitrate,
      aigcWatermark: song.aigcWatermark,
    }, apiKey, apiUrl || 'https://api.minimaxi.com')

    // Poll for progress
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes max
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl || 'https://api.minimaxi.com')

      // Update song with latest status
      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      songsMap.set(songId, {
        ...currentSong,
        status: progress.status,
        audioUrl: progress.audioUrl,
        videoUrl: progress.videoUrl,
        updatedAt: new Date().toISOString(),
      })

      if (progress.status === 'COMPLETED') {
        console.log(`[Generate] Song ${songId} completed, audioUrl: ${progress.audioUrl}`)
        break
      }

      if (progress.status === 'FAILED') {
        console.error(`[Generate] Song ${songId} failed:`, progress.error)
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
    console.error(`[Generate] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
  }
}
