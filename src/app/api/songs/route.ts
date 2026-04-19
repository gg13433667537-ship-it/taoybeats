/**
 * @version v1
 * @description 歌曲管理API：列出用户所有歌曲 / 创建新歌曲生成任务
 * @request GET /api/songs - 获取当前用户的所有歌曲（按创建时间倒序）
 * @request POST /api/songs - 创建新的AI歌曲生成任务
 *
 * POST /api/songs 请求参数：
 * @param {string} title - 歌曲标题（必需，最大长度100字符）
 * @param {string} [lyrics] - 歌词（可选，非 instrumental 时必需）
 * @param {string[]} genre - 音乐风格数组（必需，至少一个元素）
 * @param {string} mood - 歌曲情绪/风格（必需）
 * @param {string[]} [instruments] - 乐器列表（可选，最多20个）
 * @param {string} [referenceSinger] - 参考歌手（可选）
 * @param {string} [referenceSong] - 参考歌曲（可选）
 * @param {string} [userNotes] - 用户备注（可选）
 * @param {boolean} [isInstrumental] - 是否为纯音乐（默认false）
 * @param {string} [voiceId] - 声音ID（可选）
 * @param {string} [model] - 模型版本（默认music-2.6，支持music-2.5, music-2.5-turbo）
 * @param {string} [outputFormat] - 输出格式（默认mp3，支持mp3/wav/flac）
 * @param {boolean} [lyricsOptimizer] - 是否优化歌词（默认false）
 * @param {number} [sampleRate] - 采样率（默认44100，范围8000-192000）
 * @param {number} [bitrate] - 比特率（默认256000，范围32000-512000）
 * @param {boolean} [aigcWatermark] - 是否添加AI水印（默认false）
 *
 * GET /api/songs 响应：
 * @returns {object} { songs: Song[] }
 *
 * POST /api/songs 响应：
 * @returns {object} { id, shareToken, status: "PENDING", usage: { daily, monthly } }
 * @errors 400 - 参数验证失败 | 429 - 超出使用限制（FREE用户每日3次，每月10次）| 500 - 服务器错误
 * @rateLimit 20 requests per minute per user
 */
import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { musicProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"
import { checkDuplicateGeneration } from "@/lib/cache"
import { prisma } from "@/lib/db"
import { rateLimitMiddleware, DEFAULT_RATE_LIMIT, sanitizeString, validateRequiredString, validateOptionalString, validateStringArray, validateNumber, MAX_LENGTHS } from "@/lib/security"
import { uploadAudioFromUrl } from "@/lib/r2-storage"
import crypto from "crypto"

// Shared global storage - ensure initialized
if (typeof global.songs === 'undefined') global.songs = new Map()
if (typeof global.adminLogs === 'undefined') global.adminLogs = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

// Helper to get or initialize songs map
function getSongsMap(): Map<string, Song> {
  if (!global.songs) global.songs = new Map()
  return global.songs
}

// Free tier limits
const FREE_DAILY_LIMIT = 3
const FREE_MONTHLY_LIMIT = 10

// Lyrics segment size for MiniMax API (~400 chars per segment to stay under ~5 min limit)
const LYRICS_SEGMENT_SIZE = 400
const MIN_LYRICS_FOR_SPLIT = 500 // Only split if lyrics exceed this length

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Split lyrics into segments of approximately LYRICS_SEGMENT_SIZE characters.
 * Attempts to split at line breaks or sentence boundaries for better readability.
 */
function splitLyricsIntoSegments(lyrics: string | undefined): { segments: string[]; needsSplit: boolean } {
  if (!lyrics) {
    return { segments: [], needsSplit: false }
  }

  if (lyrics.length <= MIN_LYRICS_FOR_SPLIT) {
    return { segments: [lyrics], needsSplit: false }
  }

  const segments: string[] = []
  const lines = lyrics.split('\n')
  let currentSegment = ''
  let currentLength = 0

  for (const line of lines) {
    const lineLength = line.length

    // If adding this line would exceed segment size
    if (currentLength + lineLength > LYRICS_SEGMENT_SIZE && currentSegment.length > 0) {
      // Save current segment and start a new one
      segments.push(currentSegment.trim())
      currentSegment = ''
      currentLength = 0

      // If single line is longer than segment size, break it anyway
      if (lineLength > LYRICS_SEGMENT_SIZE) {
        // Break long line into smaller pieces
        let remaining = line
        while (remaining.length > LYRICS_SEGMENT_SIZE) {
          segments.push(remaining.slice(0, LYRICS_SEGMENT_SIZE))
          remaining = remaining.slice(LYRICS_SEGMENT_SIZE)
        }
        currentSegment = remaining
        currentLength = remaining.length
      } else {
        currentSegment = line
        currentLength = lineLength
      }
    } else {
      currentSegment += (currentSegment ? '\n' : '') + line
      currentLength += lineLength
    }
  }

  // Add remaining content
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim())
  }

  return { segments, needsSplit: segments.length > 1 }
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

interface SessionUser {
  id: string
  email?: string
  name?: string
  tier: string
  dailyUsage: number
  monthlyUsage: number
  dailyResetAt: string
  monthlyResetAt: string
}

async function getOrCreateUserFromDB(userId: string, email?: string): Promise<SessionUser> {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  // Try to find user in DB
  let user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user) {
    // Create user in DB if doesn't exist
    user = await prisma.user.create({
      data: {
        id: userId,
        email: email || null,
        name: email?.split('@')[0] || 'User',
        tier: 'FREE',
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: today,
        monthlyResetAt: thisMonth,
      },
    })
  }

  // Check if we need to reset daily usage
  if (user.dailyResetAt !== today) {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        dailyUsage: 0,
        dailyResetAt: today,
      },
    })
  }

  // Check if we need to reset monthly usage
  if (user.monthlyResetAt !== thisMonth) {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyUsage: 0,
        monthlyResetAt: thisMonth,
      },
    })
  }

  return {
    id: user.id,
    email: user.email || undefined,
    name: user.name || undefined,
    tier: user.tier,
    dailyUsage: user.dailyUsage,
    monthlyUsage: user.monthlyUsage,
    dailyResetAt: user.dailyResetAt || today,
    monthlyResetAt: user.monthlyResetAt || thisMonth,
  }
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return null
  }

  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return null
    }
    return await getOrCreateUserFromDB(payload.id, payload.email)
  } catch {
    return null
  }
}

async function incrementUsage(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyUsage: { increment: 1 },
      monthlyUsage: { increment: 1 },
    },
  })
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "songs:get")
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  const user = await getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
      partGroupId: s.partGroupId || undefined,
      part: s.part || undefined,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    // Also update in-memory cache
    const songsMap = getSongsMap()
    userSongs.forEach((s) => songsMap.set(s.id, s))
  } catch (prismaError) {
    console.error("Prisma song lookup failed, falling back to memory:", prismaError)
    const songsMap = getSongsMap()
    userSongs = Array.from(songsMap.values()).filter((s) => s.userId === user.id)
  }

  return NextResponse.json({ songs: userSongs })
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "songs:post")
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const user = await getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
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
      referenceAudioUrl,
      model,
      outputFormat,
      lyricsOptimizer,
      sampleRate,
      bitrate,
      aigcWatermark,
      forkedFrom,
      originalOwnerId,
    } = body

    // Validation and sanitization
    const titleError = validateRequiredString(title, MAX_LENGTHS.TITLE, "Title")
    if (titleError) {
      return NextResponse.json({ error: titleError }, { status: 400 })
    }

    const lyricsError = validateOptionalString(lyrics, MAX_LENGTHS.LYRICS, "Lyrics")
    if (lyricsError) {
      return NextResponse.json({ error: lyricsError }, { status: 400 })
    }

    // Validate mood
    const moodError = validateRequiredString(mood, MAX_LENGTHS.MOOD, "Mood")
    if (moodError) {
      return NextResponse.json({ error: moodError }, { status: 400 })
    }

    // Validate genre array
    if (!Array.isArray(genre) || genre.length === 0) {
      return NextResponse.json({ error: "Genre must be a non-empty array" }, { status: 400 })
    }

    const sanitizedTitle = sanitizeString(title)
    const sanitizedLyricsInput = lyrics ? sanitizeString(lyrics) : undefined

    // Split lyrics into segments if too long for single MiniMax generation
    const { segments: lyricsSegments, needsSplit } = splitLyricsIntoSegments(sanitizedLyricsInput)

    const sanitizedMood = sanitizeString(mood)
    const sanitizedGenre = genre.map((g: string) => sanitizeString(g)).filter((g: string) => g.length > 0)

    if (sanitizedGenre.length === 0) {
      return NextResponse.json({ error: "Genre must have at least one valid value" }, { status: 400 })
    }

    // Validation - lyrics not required if instrumental or if lyricsOptimizer is enabled
    const instrumental = isInstrumental === true || isInstrumental === "true"
    const enableLyricsOptimizer = lyricsOptimizer === true || lyricsOptimizer === "true"
    if (!instrumental && lyricsSegments.length === 0 && !enableLyricsOptimizer) {
      return NextResponse.json(
        { error: "Missing required fields: title, lyrics, genre, mood" },
        { status: 400 }
      )
    }

    // Validate optional fields
    const sanitizedInstruments = instruments
      ? validateStringArray(instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments")
      : []
    if (instruments && !sanitizedInstruments) {
      return NextResponse.json({ error: "Invalid instruments format" }, { status: 400 })
    }

    const sanitizedReferenceSinger = referenceSinger ? sanitizeString(referenceSinger) : undefined
    const sanitizedReferenceSong = referenceSong ? sanitizeString(referenceSong) : undefined
    const sanitizedUserNotes = userNotes ? sanitizeString(userNotes) : undefined
    const sanitizedVoiceId = voiceId ? sanitizeString(voiceId) : undefined

    // Validate referenceAudioUrl - must be a valid URL if provided
    let sanitizedReferenceAudioUrl: string | undefined
    if (referenceAudioUrl) {
      if (typeof referenceAudioUrl !== 'string') {
        return NextResponse.json({ error: "Reference audio URL must be a string" }, { status: 400 })
      }
      try {
        const url = new URL(referenceAudioUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json({ error: "Reference audio URL must use HTTP or HTTPS protocol" }, { status: 400 })
        }
        sanitizedReferenceAudioUrl = referenceAudioUrl.trim()
      } catch {
        return NextResponse.json({ error: "Invalid reference audio URL format" }, { status: 400 })
      }
    }

    // Validate numeric fields
    const validatedSampleRate = sampleRate ? validateNumber(sampleRate, 8000, 192000, "Sample rate") : 44100
    const validatedBitrate = bitrate ? validateNumber(bitrate, 32000, 512000, "Bitrate") : 256000
    if ((sampleRate && validatedSampleRate === null) || (bitrate && validatedBitrate === null)) {
      return NextResponse.json({ error: "Invalid numeric parameter" }, { status: 400 })
    }

    // Validate model enum
    const allowedModels = ["music-2.6", "music-2.5-turbo", "music-2.5", "music-cover"]
    const sanitizedModel = model ? sanitizeString(model) : "music-2.6"
    if (model && !allowedModels.includes(sanitizedModel)) {
      return NextResponse.json({ error: "Invalid model. Allowed: " + allowedModels.join(", ") }, { status: 400 })
    }

    // Validate output format enum
    const allowedFormats = ["mp3", "wav", "pcm"]
    const sanitizedOutputFormat = outputFormat ? sanitizeString(outputFormat) : "mp3"
    if (outputFormat && !allowedFormats.includes(sanitizedOutputFormat)) {
      return NextResponse.json({ error: "Invalid output format. Allowed: " + allowedFormats.join(", ") }, { status: 400 })
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
        { error: "API key not configured. Please set API_KEY environment variable." },
        { status: 500 }
      )
    }

    // Check usage limits (from Prisma - already reset if needed by getSessionUser)
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

    // Generate partGroupId for multi-part songs
    const partGroupId = needsSplit ? crypto.randomUUID() : undefined
    const totalParts = lyricsSegments.length

    // Build common song properties (shared across all segments)
    const commonSongProps = {
      userId: user.id,
      title: sanitizedTitle,
      genre: sanitizedGenre,
      mood: sanitizedMood,
      instruments: sanitizedInstruments || [],
      referenceSinger: sanitizedReferenceSinger,
      referenceSong: sanitizedReferenceSong,
      userNotes: sanitizedUserNotes,
      isInstrumental: instrumental,
      voiceId: sanitizedVoiceId,
      referenceAudio,
      referenceAudioUrl: sanitizedReferenceAudioUrl,
      model: sanitizedModel as 'music-2.6' | 'music-cover',
      outputFormat: sanitizedOutputFormat as 'mp3' | 'wav' | 'pcm',
      lyricsOptimizer: lyricsOptimizer === true || lyricsOptimizer === "true",
      sampleRate: (validatedSampleRate || 44100) as 16000 | 24000 | 32000 | 44100,
      bitrate: (validatedBitrate || 256000) as 32000 | 64000 | 128000 | 256000,
      aigcWatermark: aigcWatermark === true || aigcWatermark === "true",
      moderationStatus: "APPROVED" as const,
      forkedFrom,
      originalOwnerId,
    }

    const songsMap = getSongsMap()
    const createdSongs: Array<{ id: string; part: number; shareToken: string }> = []
    const now = new Date().toISOString()

    // If no lyrics segments (empty lyrics with lyricsOptimizer enabled), create a single song
    const segmentsToCreate = lyricsSegments.length > 0 ? lyricsSegments : ['']

    // Create song records for each segment
    for (let partIndex = 0; partIndex < segmentsToCreate.length; partIndex++) {
      const segmentLyrics = segmentsToCreate[partIndex]
      const partNumber = partIndex + 1
      const songId = crypto.randomUUID()
      const shareToken = partNumber === 1 ? crypto.randomUUID().slice(0, 8) : undefined // Only first part gets shareToken

      const song: Song = {
        id: songId,
        ...commonSongProps,
        lyrics: segmentLyrics,
        status: "PENDING",
        audioUrl: undefined,
        videoUrl: undefined,
        coverUrl: undefined,
        shareToken,
        partGroupId,
        part: partNumber,
        createdAt: now,
        updatedAt: now,
      }

      songsMap.set(songId, song)

      // Persist to Prisma - if this fails, no songs are created
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
            shareToken: shareToken || null,
            userId: user.id,
            partGroupId: partGroupId || null,
            part: partNumber,
            forkedFrom: song.forkedFrom || null,
            originalOwnerId: song.originalOwnerId || null,
          },
        })
        createdSongs.push({ id: songId, part: partNumber, shareToken: shareToken || '' })
      } catch (prismaError) {
        console.error("Failed to persist song to Prisma:", prismaError)
        // Clean up any songs already created
        for (const created of createdSongs) {
          songsMap.delete(created.id)
          await prisma.song.delete({ where: { id: created.id } }).catch(() => {})
        }
        return NextResponse.json(
          { error: "Failed to create song. Please try again." },
          { status: 500 }
        )
      }
    }

    // Increment usage in database ONLY after all songs are successfully created
    // Count each segment as one usage (user is generating one song, just split into parts)
    try {
      await incrementUsage(user.id)
    } catch (dbError) {
      console.error("Failed to increment usage in Prisma:", dbError)
      // Songs were created, but usage increment failed - not critical
    }

    // Start real generation in background for each segment
    for (const { id, part } of createdSongs) {
      const song = songsMap.get(id)
      if (song) {
        generateMusic(id, song, apiKey, apiUrl).catch((err) => {
          console.error(`[Generate] Song ${id} (part ${part}) background generation failed:`, err)
        })
      }
    }

    // Return primary song info (first part) plus multi-part info
    const primarySong = createdSongs[0]
    return NextResponse.json({
      id: primarySong.id,
      shareToken: primarySong.shareToken,
      status: "PENDING",
      usage: {
        daily: { used: user.dailyUsage + 1, limit: FREE_DAILY_LIMIT },
        monthly: { used: user.monthlyUsage + 1, limit: FREE_MONTHLY_LIMIT },
      },
      multiPart: needsSplit ? {
        isMultiPart: true,
        partGroupId,
        totalParts,
        parts: createdSongs.map(s => ({ id: s.id, part: s.part })),
      } : undefined,
    })
  } catch (error) {
    console.error("Error creating song:", error)
    return NextResponse.json(
      { error: "Failed to create song" },
      { status: 500 }
    )
  }
}

// Helper to update song in both memory and Prisma
async function updateSongStatus(
  songId: string,
  updates: Partial<Pick<Song, 'status' | 'audioUrl' | 'videoUrl' | 'error'>>,
  currentSong: Song
): Promise<void> {
  const songsMap = getSongsMap()
  const now = new Date().toISOString()

  // Update memory cache
  songsMap.set(songId, { ...currentSong, ...updates, updatedAt: now })

  // Update Prisma database (error field is not stored in Prisma, only in memory)
  try {
    await prisma.song.update({
      where: { id: songId },
      data: {
        status: updates.status,
        audioUrl: updates.audioUrl,
        ...(updates.videoUrl && { coverUrl: updates.videoUrl }),
      },
    })
  } catch (dbError) {
    console.error(`[Generate] Failed to update Prisma for song ${songId}:`, dbError)
    // Continue with memory update even if DB fails
  }
}

async function generateMusic(
  songId: string,
  song: Song,
  apiKey: string,
  apiUrl?: string
) {
  const songsMap = getSongsMap()

  try {
    // Update status to GENERATING
    await updateSongStatus(songId, { status: "GENERATING" }, song)

    // Call Music API
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
      referenceAudio: song.referenceAudio || song.referenceAudioUrl,
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

      const progress = await musicProvider.getProgress(taskId, apiKey, apiUrl || 'https://api.minimaxi.com')

      // Update song with latest status in both memory and DB
      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      await updateSongStatus(songId, {
        status: progress.status,
        audioUrl: progress.audioUrl,
        videoUrl: progress.videoUrl,
      }, currentSong)

      if (progress.status === 'COMPLETED') {
        console.log(`[Generate] Song ${songId} completed, audioUrl: ${progress.audioUrl}`)

        // Upload to R2 and store R2 URL (fallback to MiniMax URL on failure)
        let finalAudioUrl = progress.audioUrl
        if (progress.audioUrl) {
          try {
            finalAudioUrl = await uploadAudioFromUrl(progress.audioUrl, songId)
            console.log(`[Generate] Song ${songId} uploaded to R2: ${finalAudioUrl}`)
          } catch (r2Error) {
            console.error(`[Generate] Song ${songId} R2 upload failed, using MiniMax URL:`, r2Error)
          }
        }

        // Update with final URL (R2 or MiniMax fallback)
        const currentSongAfterComplete = songsMap.get(songId)
        if (currentSongAfterComplete) {
          await updateSongStatus(songId, {
            status: 'COMPLETED',
            audioUrl: finalAudioUrl,
            videoUrl: progress.videoUrl,
          }, currentSongAfterComplete)
        }
        return // Successful completion
      }

      if (progress.status === 'FAILED') {
        console.error(`[Generate] Song ${songId} failed:`, progress.error)
        return // Explicit failure
      }
    }

    // Timeout or unexpected state - update final status
    const finalSong = songsMap.get(songId)
    if (finalSong && finalSong.status !== 'COMPLETED' && finalSong.status !== 'FAILED') {
      await updateSongStatus(songId, { status: 'FAILED' }, finalSong)
    }
  } catch (error) {
    console.error(`[Generate] Song ${songId} error:`, error)
    const currentSong = songsMap.get(songId) || song
    await updateSongStatus(songId, {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Generation failed',
    }, currentSong)
  }
}
