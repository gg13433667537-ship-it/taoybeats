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
import type { Song, User } from "@/lib/types"
import { musicProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"
import { checkDuplicateGeneration } from "@/lib/cache"
import { prisma } from "@/lib/db"
import { prepareLyricsForModel } from "@/lib/minimax-music"
import { rateLimitMiddleware, DEFAULT_RATE_LIMIT, sanitizeString, validateRequiredString, validateOptionalString, validateStringArray, validateNumber, MAX_LENGTHS } from "@/lib/security"
import { queueR2Upload } from "@/lib/r2-upload-queue"
import crypto from "crypto"

// Shared global storage - ensure initialized
if (typeof global.users === 'undefined') global.users = new Map()
if (typeof global.songs === 'undefined') global.songs = new Map()
if (typeof global.adminLogs === 'undefined') global.adminLogs = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

function getUsersMap(): Map<string, User> {
  if (!global.users) global.users = new Map()
  return global.users
}

// Helper to get or initialize songs map
function getSongsMap(): Map<string, Song> {
  if (!global.songs) global.songs = new Map()
  return global.songs
}

// Free tier limits
const FREE_DAILY_LIMIT = 3
const FREE_MONTHLY_LIMIT = 10
const PRO_DAILY_LIMIT = 50

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

interface SessionUser {
  id: string
  email?: string
  name?: string
  role: string
  tier: string
  dailyUsage: number
  monthlyUsage: number
  dailyResetAt: string
  monthlyResetAt: string
}

async function getOrCreateUserFromDB(userId: string, email?: string): Promise<SessionUser> {
  const today = getDateKey()
  const thisMonth = getMonthKey()
  const usersMap = getUsersMap()

  try {
    let user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
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

    if (user.dailyResetAt !== today) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          dailyUsage: 0,
          dailyResetAt: today,
        },
      })
    }

    if (user.monthlyResetAt !== thisMonth) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          monthlyUsage: 0,
          monthlyResetAt: thisMonth,
        },
      })
    }

    const memoryUser: User = {
      id: user.id,
      email: user.email || email || `${user.id}@local`,
      name: user.name || undefined,
      role: user.role as User['role'],
      isActive: user.isActive,
      tier: user.tier as User['tier'],
      dailyUsage: user.dailyUsage,
      monthlyUsage: user.monthlyUsage,
      dailyResetAt: user.dailyResetAt || today,
      monthlyResetAt: user.monthlyResetAt || thisMonth,
      createdAt: user.createdAt.toISOString(),
    }
    usersMap.set(memoryUser.id, memoryUser)
    usersMap.set(memoryUser.email, memoryUser)

    return {
      id: user.id,
      email: user.email || undefined,
      name: user.name || undefined,
      role: user.role,
      tier: user.tier,
      dailyUsage: user.dailyUsage,
      monthlyUsage: user.monthlyUsage,
      dailyResetAt: user.dailyResetAt || today,
      monthlyResetAt: user.monthlyResetAt || thisMonth,
    }
  } catch (dbError) {
    console.error("Prisma user lookup failed, falling back to memory:", dbError)
  }

  const existingMemoryUser = usersMap.get(userId) || (email ? usersMap.get(email) : undefined)
  const memoryUser: User = existingMemoryUser || {
    id: userId,
    email: email || `${userId}@local`,
    name: email?.split('@')[0] || 'User',
    role: 'USER',
    isActive: true,
    tier: 'FREE',
    dailyUsage: 0,
    monthlyUsage: 0,
    dailyResetAt: today,
    monthlyResetAt: thisMonth,
    createdAt: new Date().toISOString(),
  }

  if (memoryUser.dailyResetAt !== today) {
    memoryUser.dailyUsage = 0
    memoryUser.dailyResetAt = today
  }

  if (memoryUser.monthlyResetAt !== thisMonth) {
    memoryUser.monthlyUsage = 0
    memoryUser.monthlyResetAt = thisMonth
  }

  usersMap.set(memoryUser.id, memoryUser)
  usersMap.set(memoryUser.email, memoryUser)

  return {
    id: memoryUser.id,
    email: memoryUser.email,
    name: memoryUser.name,
    role: memoryUser.role,
    tier: memoryUser.tier,
    dailyUsage: memoryUser.dailyUsage,
    monthlyUsage: memoryUser.monthlyUsage,
    dailyResetAt: memoryUser.dailyResetAt,
    monthlyResetAt: memoryUser.monthlyResetAt,
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
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyUsage: { increment: 1 },
        monthlyUsage: { increment: 1 },
      },
    })
  } catch (dbError) {
    console.error("Prisma usage update failed, falling back to memory:", dbError)
    const usersMap = getUsersMap()
    const user = usersMap.get(userId)
    if (user) {
      user.dailyUsage += 1
      user.monthlyUsage += 1
      usersMap.set(user.id, user)
      usersMap.set(user.email, user)
    }
  }
}

type PrismaSongCreateArgs = Parameters<typeof prisma.song.create>[0]

function buildPrismaSongCreateData(song: Song): PrismaSongCreateArgs["data"] {
  return {
    id: song.id,
    title: song.title,
    lyrics: song.lyrics || null,
    originalLyrics: song.originalLyrics || null,
    genre: song.genre,
    mood: song.mood || null,
    instruments: song.instruments,
    referenceSinger: song.referenceSinger || null,
    referenceSong: song.referenceSong || null,
    userNotes: song.userNotes || null,
    status: "PENDING",
    lyricsCompressionApplied: song.lyricsCompressionApplied || false,
    lyricsCompressionReason: song.lyricsCompressionReason || null,
    lyricsCompressionModel: song.lyricsCompressionModel || null,
    lyricsCompressionLimit: song.lyricsCompressionLimit || null,
    providerTaskId: null,
    errorMessage: null,
    audioUrl: null,
    coverUrl: null,
    shareToken: song.shareToken || null,
    userId: song.userId,
    forkedFrom: song.forkedFrom || null,
    originalOwnerId: song.originalOwnerId || null,
  }
}

async function persistSongToDatabase(song: Song, userEmail?: string): Promise<boolean> {
  const createData = buildPrismaSongCreateData(song)

  try {
    await prisma.song.create({ data: createData })
    return true
  } catch (prismaError) {
    console.error("Failed to persist song to Prisma on first attempt:", prismaError)
  }

  try {
    await getOrCreateUserFromDB(song.userId, userEmail)
    await prisma.song.create({ data: createData })
    return true
  } catch (retryError) {
    console.error("Failed to persist song to Prisma after recreating user record:", retryError)
    return false
  }
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
      originalLyrics: s.originalLyrics || undefined,
      genre: s.genre,
      mood: s.mood || undefined,
      instruments: s.instruments,
      referenceSinger: s.referenceSinger || undefined,
      referenceSong: s.referenceSong || undefined,
      userNotes: s.userNotes || undefined,
      isInstrumental: false,
      status: s.status,
      moderationStatus: "APPROVED" as const,
      lyricsCompressionApplied: s.lyricsCompressionApplied,
      lyricsCompressionReason: s.lyricsCompressionReason || undefined,
      lyricsCompressionModel: s.lyricsCompressionModel || undefined,
      lyricsCompressionLimit: s.lyricsCompressionLimit || undefined,
      providerTaskId: s.providerTaskId || undefined,
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
    const sanitizedMood = sanitizeString(mood)
    const sanitizedGenre = genre.map((g: string) => sanitizeString(g)).filter((g: string) => g.length > 0)

    if (sanitizedGenre.length === 0) {
      return NextResponse.json({ error: "Genre must have at least one valid value" }, { status: 400 })
    }

    const instrumental = isInstrumental === true || isInstrumental === "true"
    const enableLyricsOptimizer = lyricsOptimizer === true || lyricsOptimizer === "true"

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

    const preparedLyrics = prepareLyricsForModel({
      lyrics: sanitizedLyricsInput,
      model: sanitizedModel as 'music-2.6' | 'music-2.5' | 'music-2.5-turbo' | 'music-cover',
      isInstrumental: instrumental,
    })

    if (!instrumental && !preparedLyrics.lyrics.trim() && !enableLyricsOptimizer) {
      return NextResponse.json(
        { error: "Missing required fields: title, lyrics, genre, mood" },
        { status: 400 }
      )
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
    // Admins bypass usage limits
    if (user.role === 'ADMIN') {
      // Admin bypasses all limits
    } else if (user.tier === 'FREE') {
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
    } else if (user.tier === 'PRO') {
      if (user.dailyUsage >= PRO_DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `You've used all ${PRO_DAILY_LIMIT} Pro generations today.`,
            daily: { used: user.dailyUsage, limit: PRO_DAILY_LIMIT },
            code: "DAILY_LIMIT_REACHED",
          },
          { status: 429 }
        )
      }
    }

    // Build song properties
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
      model: sanitizedModel as 'music-2.6' | 'music-2.5' | 'music-2.5-turbo' | 'music-cover',
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
    const now = new Date().toISOString()
    const songId = crypto.randomUUID()
    const shareToken = crypto.randomUUID().slice(0, 8)
    const song: Song = {
      id: songId,
      ...commonSongProps,
      lyrics: preparedLyrics.lyrics || undefined,
      originalLyrics: preparedLyrics.originalLyrics,
      status: "PENDING",
      lyricsCompressionApplied: preparedLyrics.applied,
      lyricsCompressionReason: preparedLyrics.reason || undefined,
      lyricsCompressionModel: preparedLyrics.model,
      lyricsCompressionLimit: preparedLyrics.maxLength,
      providerTaskId: undefined,
      errorMessage: undefined,
      audioUrl: undefined,
      videoUrl: undefined,
      coverUrl: undefined,
      shareToken,
      createdAt: now,
      updatedAt: now,
    }

    songsMap.set(songId, song)

    const persistedToDatabase = await persistSongToDatabase(song, user.email)
    if (!persistedToDatabase) {
      console.error("Song persistence failed, continuing with memory fallback")
    }

    // Increment usage in database ONLY after all songs are successfully created
    try {
      await incrementUsage(user.id)
    } catch (dbError) {
      console.error("Failed to increment usage in Prisma:", dbError)
      // Songs were created, but usage increment failed - not critical
    }

    const initiatedSong = await initiateMusicGeneration(songId, song, apiKey, apiUrl)
    songsMap.set(songId, initiatedSong)

    const isAdmin = user.role === 'ADMIN'
    return NextResponse.json({
      id: songId,
      shareToken,
      status: initiatedSong.status || "PENDING",
      audioUrl: initiatedSong.audioUrl,
      usage: isAdmin ? { unlimited: true } : {
        daily: { used: user.dailyUsage + 1, limit: FREE_DAILY_LIMIT },
        monthly: { used: user.monthlyUsage + 1, limit: FREE_MONTHLY_LIMIT },
      },
      compression: {
        applied: preparedLyrics.applied,
        reason: preparedLyrics.reason,
        originalLength: preparedLyrics.originalLength,
        compressedLength: preparedLyrics.compressedLength,
        maxLength: preparedLyrics.maxLength,
        model: preparedLyrics.model,
        usedLyrics: preparedLyrics.lyrics,
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

// Helper to update song in both memory and Prisma
async function updateSongStatus(
  songId: string,
  updates: Partial<Pick<Song, 'status' | 'audioUrl' | 'videoUrl' | 'error' | 'errorMessage'>> & { providerTaskId?: string | null },
  currentSong: Song
): Promise<void> {
  const songsMap = getSongsMap()
  const now = new Date().toISOString()
  const hasProviderTaskIdUpdate = Object.prototype.hasOwnProperty.call(updates, 'providerTaskId')
  const { providerTaskId, ...songUpdates } = updates
  const nextSong: Song = {
    ...currentSong,
    ...songUpdates,
    ...(typeof updates.error !== 'undefined' ? { errorMessage: updates.error } : {}),
    ...(hasProviderTaskIdUpdate ? { providerTaskId: providerTaskId || undefined } : {}),
    updatedAt: now,
  }

  // Update memory cache
  songsMap.set(songId, nextSong)

  // Update Prisma database (error field is not stored in Prisma, only in memory)
  try {
    const prismaUpdates: Record<string, unknown> = {}

    if (typeof updates.status !== 'undefined') {
      prismaUpdates.status = updates.status
    }

    if (typeof updates.audioUrl !== 'undefined') {
      prismaUpdates.audioUrl = updates.audioUrl || null
    }

    if (typeof updates.videoUrl !== 'undefined') {
      prismaUpdates.coverUrl = updates.videoUrl || null
    }

    if (typeof updates.error !== 'undefined' || typeof updates.errorMessage !== 'undefined') {
      prismaUpdates.errorMessage = updates.errorMessage || updates.error || null
    }

    if (hasProviderTaskIdUpdate) {
      prismaUpdates.providerTaskId = providerTaskId || null
    }

    await prisma.song.update({
      where: { id: songId },
      data: prismaUpdates,
    })
  } catch (dbError) {
    console.error(`[Generate] Failed to update Prisma for song ${songId}:`, dbError)
    // Continue with memory update even if DB fails
  }
}

async function initiateMusicGeneration(
  songId: string,
  song: Song,
  apiKey: string,
  apiUrl?: string
) : Promise<Song> {
  const songsMap = getSongsMap()
  const resolvedApiUrl = apiUrl || 'https://api.minimaxi.com'

  try {
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
      referenceAudio: song.referenceAudio || song.referenceAudioUrl,
      model: song.model || 'music-2.6',
      outputFormat: song.outputFormat,
      lyricsOptimizer: song.lyricsOptimizer,
      sampleRate: song.sampleRate,
      bitrate: song.bitrate,
      aigcWatermark: song.aigcWatermark,
    }, apiKey, resolvedApiUrl)

    if (taskId.startsWith('audio:')) {
      const sourceAudioUrl = taskId.slice(6)
      // Queue background upload (non-blocking)
      queueR2Upload(songId, sourceAudioUrl)

      await updateSongStatus(songId, {
        status: 'COMPLETED',
        audioUrl: sourceAudioUrl,
        providerTaskId: null,
      }, song)
    } else {
      await updateSongStatus(songId, {
        status: 'GENERATING',
        providerTaskId: taskId,
      }, song)
      // R2 upload will be queued when song completes with audioUrl in persistSongRefresh
    }

    return songsMap.get(songId) || song
  } catch (error) {
    console.error(`[Generate] Song ${songId} initiation error:`, error)
    const currentSong = songsMap.get(songId) || song
    await updateSongStatus(songId, {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Generation failed',
      providerTaskId: null,
    }, currentSong)
    return songsMap.get(songId) || currentSong
  }
}
