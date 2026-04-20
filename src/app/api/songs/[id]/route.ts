import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { musicProvider } from "@/lib/ai-providers"
import { verifySessionToken } from "@/lib/auth-utils"
import { sanitizeString, validateRequiredString, validateOptionalString, validateStringArray, MAX_LENGTHS } from "@/lib/security"
import { prisma } from "@/lib/db"

if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || "https://api.minimaxi.com"

const PROVIDER_TASK_ID_FIELDS = ["providerTaskId", "taskId", "minimaxTaskId"] as const
const ERROR_FIELDS = ["error", "errorMessage", "generationError"] as const

type SongRecord = Song & Record<string, unknown>

function readStringField(
  record: Record<string, unknown> | null | undefined,
  fields: readonly string[]
): string | undefined {
  if (!record) {
    return undefined
  }

  for (const field of fields) {
    const value = record[field]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }

  return undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSongRecord(dbSong: any): SongRecord {
  const song: SongRecord = {
    id: dbSong.id,
    title: dbSong.title,
    lyrics: dbSong.lyrics || undefined,
    originalLyrics: dbSong.originalLyrics || undefined,
    genre: dbSong.genre,
    mood: dbSong.mood || undefined,
    instruments: dbSong.instruments,
    referenceSinger: dbSong.referenceSinger || undefined,
    referenceSong: dbSong.referenceSong || undefined,
    userNotes: dbSong.userNotes || undefined,
    isInstrumental: false,
    status: dbSong.status as Song["status"],
    moderationStatus: "APPROVED",
    lyricsCompressionApplied: dbSong.lyricsCompressionApplied || false,
    lyricsCompressionReason: dbSong.lyricsCompressionReason || undefined,
    lyricsCompressionModel: dbSong.lyricsCompressionModel || undefined,
    lyricsCompressionLimit: dbSong.lyricsCompressionLimit || undefined,
    providerTaskId: dbSong.providerTaskId || undefined,
    audioUrl: dbSong.audioUrl || undefined,
    coverUrl: dbSong.coverUrl || undefined,
    shareToken: dbSong.shareToken || undefined,
    userId: dbSong.userId,
    partGroupId: dbSong.partGroupId || undefined,
    part: dbSong.part || undefined,
    createdAt: dbSong.createdAt.toISOString(),
    updatedAt: dbSong.updatedAt.toISOString(),
  }

  for (const field of PROVIDER_TASK_ID_FIELDS) {
    const value = dbSong[field]
    if (typeof value === "string" && value.length > 0) {
      song[field] = value
    }
  }

  for (const field of ERROR_FIELDS) {
    if (field in dbSong) {
      const value = dbSong[field]
      song[field] = typeof value === "string" && value.length > 0 ? value : undefined
    }
  }

  return song
}

export async function getSongFromDb(id: string): Promise<SongRecord | null> {
  try {
    const dbSong = await prisma.song.findUnique({
      where: { id },
    })

    if (!dbSong) {
      return null
    }

    return toSongRecord(dbSong)
  } catch (dbError) {
    console.error("Prisma lookup failed:", dbError)
    return null
  }
}

// Upload audio to R2 when song completes with audioUrl
// This is now synchronous - waits for upload to complete before returning
async function uploadAudioToR2IfComplete(
  song: SongRecord,
  updates: Partial<SongRecord> & { status: Song["status"] }
): Promise<{ audioUrl: string } | null> {
  // Only upload if status is COMPLETED and audioUrl is set
  if (updates.status === "COMPLETED" && updates.audioUrl) {
    try {
      const { uploadAudioFromUrl, isR2Configured, extractObjectKeyFromUrl } = await import("@/lib/storage")

      // Skip if already an R2 URL
      if (extractObjectKeyFromUrl(updates.audioUrl)) {
        console.log(`[Persist] Audio already in R2: ${updates.audioUrl}`)
        return null
      }

      // Skip if R2 not configured
      if (!isR2Configured()) {
        console.log(`[Persist] R2 not configured, using original URL: ${updates.audioUrl}`)
        return null
      }

      console.log(`[Persist] Uploading audio to R2 for song ${song.id}...`)
      const result = await uploadAudioFromUrl(updates.audioUrl, song.id)
      console.log(`[Persist] Audio uploaded to R2: ${result.r2Url}`)
      return { audioUrl: result.r2Url }
    } catch (error) {
      console.error("[Persist] Failed to upload audio to R2:", error)
      return null
    }
  }
  return null
}

async function persistSongRefresh(
  song: SongRecord,
  updates: Partial<SongRecord> & { status: Song["status"] }
): Promise<SongRecord> {
  const refreshedSong: SongRecord = {
    ...song,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  const songsMap = global.songs as Map<string, SongRecord> | undefined
  songsMap?.set(song.id, refreshedSong)

  // Upload to R2 synchronously if song just completed with audio
  const r2UploadResult = await uploadAudioToR2IfComplete(song, updates)
  if (r2UploadResult) {
    refreshedSong.audioUrl = r2UploadResult.audioUrl
  }

  const prismaData: Record<string, unknown> = {
    status: refreshedSong.status,
    audioUrl: refreshedSong.audioUrl || null,
  }

  prismaData.providerTaskId = refreshedSong.providerTaskId || null

  const errorField = ERROR_FIELDS.find((field) => field in song)
  const errorValue = readStringField(refreshedSong, ERROR_FIELDS)
  if (errorField) {
    prismaData[errorField] = errorValue || null
  }

  try {
    await prisma.song.update({
      where: { id: song.id },
      data: prismaData as Record<string, unknown>,
    })
  } catch (dbError) {
    console.error("Prisma refresh update failed:", dbError)
  }

  return refreshedSong
}

export async function refreshGeneratingSong(song: SongRecord): Promise<SongRecord> {
  if (song.status !== "GENERATING") {
    return song
  }

  const taskId = readStringField(song, PROVIDER_TASK_ID_FIELDS)
  if (!taskId) {
    return song
  }

  const apiKey = global.systemApiKey || process.env.MINIMAX_API_KEY
  const apiUrl = global.systemApiUrl || process.env.MINIMAX_API_URL || "https://api.minimaxi.com"
  if (!apiKey) {
    return song
  }

  try {
    const progress = await musicProvider.getProgress(taskId, apiKey, apiUrl)

    if (progress.status === "COMPLETED") {
      return persistSongRefresh(song, {
        status: "COMPLETED",
        providerTaskId: undefined,
        error: undefined,
        errorMessage: undefined,
        audioUrl: progress.audioUrl || song.audioUrl,
      })
    }

    if (progress.status === "FAILED") {
      return persistSongRefresh(song, {
        status: "FAILED",
        providerTaskId: undefined,
        error: progress.error || "MiniMax generation failed",
      })
    }

    if (progress.status !== song.status) {
      return persistSongRefresh(song, {
        status: progress.status,
        audioUrl: progress.audioUrl || song.audioUrl,
      })
    }
  } catch (error) {
    console.error("MiniMax refresh failed:", error)
  }

  return song
}

async function getRefreshableSong(
  id: string,
  cachedSong?: SongRecord
): Promise<SongRecord | null> {
  if (cachedSong && (cachedSong.status !== "GENERATING" || readStringField(cachedSong, PROVIDER_TASK_ID_FIELDS))) {
    return cachedSong
  }

  const dbSong = await getSongFromDb(id)
  if (dbSong) {
    return dbSong
  }

  return cachedSong || null
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try in-memory cache first
    const songsMap = global.songs as Map<string, SongRecord> | undefined
    const song = await getRefreshableSong(id, songsMap?.get(id))
    if (song) {
      const refreshedSong = await refreshGeneratingSong(song)
      songsMap?.set(id, refreshedSong)
      return NextResponse.json(refreshedSong)
    }

    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  } catch (error) {
    console.error("GET song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth check
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Try in-memory cache first, then fall back to database
    let song = global.songs ? global.songs.get(id) as Song | undefined : undefined
    if (!song) {
      try {
        const dbSong = await prisma.song.findUnique({ where: { id } })
        if (dbSong) {
          song = toSongRecord(dbSong)
        }
      } catch (dbError) {
        console.error("Prisma lookup failed:", dbError)
      }
    }

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin to update
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only allow updating certain fields - prevent security issues
    // Add sanitization for each field
    const allowedUpdates: Partial<Song> = {}

    if ('title' in body) {
      const titleError = validateRequiredString(body.title, MAX_LENGTHS.TITLE, "Title")
      if (titleError) {
        return NextResponse.json({ error: titleError }, { status: 400 })
      }
      allowedUpdates.title = sanitizeString(body.title)
    }

    if ('lyrics' in body) {
      const lyricsError = validateOptionalString(body.lyrics, MAX_LENGTHS.LYRICS, "Lyrics")
      if (lyricsError) {
        return NextResponse.json({ error: lyricsError }, { status: 400 })
      }
      allowedUpdates.lyrics = body.lyrics ? sanitizeString(body.lyrics) : undefined
      allowedUpdates.originalLyrics = undefined
      allowedUpdates.lyricsCompressionApplied = false
      allowedUpdates.lyricsCompressionReason = undefined
      allowedUpdates.lyricsCompressionModel = undefined
      allowedUpdates.lyricsCompressionLimit = undefined
    }

    if ('genre' in body) {
      if (!Array.isArray(body.genre)) {
        return NextResponse.json({ error: "Genre must be an array" }, { status: 400 })
      }
      const sanitizedGenre = validateStringArray(body.genre, MAX_LENGTHS.GENRE, 10, "Genre")
      if (!sanitizedGenre) {
        return NextResponse.json({ error: "Invalid genre format" }, { status: 400 })
      }
      allowedUpdates.genre = sanitizedGenre
    }

    if ('mood' in body) {
      const moodError = validateOptionalString(body.mood, MAX_LENGTHS.MOOD, "Mood")
      if (moodError) {
        return NextResponse.json({ error: moodError }, { status: 400 })
      }
      allowedUpdates.mood = body.mood ? sanitizeString(body.mood) : undefined
    }

    if ('instruments' in body) {
      const sanitizedInstruments = validateStringArray(body.instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments")
      if (!sanitizedInstruments) {
        return NextResponse.json({ error: "Invalid instruments format" }, { status: 400 })
      }
      allowedUpdates.instruments = sanitizedInstruments
    }

    if ('referenceSinger' in body) {
      const refError = validateOptionalString(body.referenceSinger, MAX_LENGTHS.NAME, "Reference singer")
      if (refError) {
        return NextResponse.json({ error: refError }, { status: 400 })
      }
      allowedUpdates.referenceSinger = body.referenceSinger ? sanitizeString(body.referenceSinger) : undefined
    }

    if ('referenceSong' in body) {
      const refError = validateOptionalString(body.referenceSong, MAX_LENGTHS.TITLE, "Reference song")
      if (refError) {
        return NextResponse.json({ error: refError }, { status: 400 })
      }
      allowedUpdates.referenceSong = body.referenceSong ? sanitizeString(body.referenceSong) : undefined
    }

    if ('userNotes' in body) {
      const notesError = validateOptionalString(body.userNotes, MAX_LENGTHS.NOTES, "User notes")
      if (notesError) {
        return NextResponse.json({ error: notesError }, { status: 400 })
      }
      allowedUpdates.userNotes = body.userNotes ? sanitizeString(body.userNotes) : undefined
    }

    if ('isInstrumental' in body) {
      allowedUpdates.isInstrumental = body.isInstrumental === true || body.isInstrumental === "true"
    }

    if ('voiceId' in body) {
      const voiceError = validateOptionalString(body.voiceId, MAX_LENGTHS.NAME, "Voice ID")
      if (voiceError) {
        return NextResponse.json({ error: voiceError }, { status: 400 })
      }
      allowedUpdates.voiceId = body.voiceId ? sanitizeString(body.voiceId) : undefined
    }

    if ('status' in body) {
      const allowedStatuses = ['PENDING', 'GENERATING', 'COMPLETED', 'FAILED']
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      allowedUpdates.status = body.status
    }

    const updatedSong: Song = { ...song, ...allowedUpdates, id, updatedAt: new Date().toISOString() }

    // Update both database and cache
    try {
      await prisma.song.update({
        where: { id },
        data: {
          title: updatedSong.title,
          lyrics: updatedSong.lyrics,
          originalLyrics: updatedSong.originalLyrics,
          genre: updatedSong.genre,
          mood: updatedSong.mood,
          instruments: updatedSong.instruments,
          referenceSinger: updatedSong.referenceSinger,
          referenceSong: updatedSong.referenceSong,
          userNotes: updatedSong.userNotes,
          status: updatedSong.status,
          lyricsCompressionApplied: updatedSong.lyricsCompressionApplied || false,
          lyricsCompressionReason: updatedSong.lyricsCompressionReason || null,
          lyricsCompressionModel: updatedSong.lyricsCompressionModel || null,
          lyricsCompressionLimit: updatedSong.lyricsCompressionLimit || null,
        },
      })
    } catch (dbError) {
      console.error("Prisma update failed:", dbError)
    }

    // Update memory cache
    if (global.songs) {
      global.songs.set(id, updatedSong)
    }

    return NextResponse.json(updatedSong)
  } catch (error) {
    console.error("PATCH song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth check
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Try in-memory cache first, then fall back to database
    let song = global.songs ? global.songs.get(id) as Song | undefined : undefined
    if (!song) {
      try {
        const dbSong = await prisma.song.findUnique({ where: { id } })
        if (dbSong) {
          song = toSongRecord(dbSong)
        }
      } catch (dbError) {
        console.error("Prisma lookup failed:", dbError)
      }
    }

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin to delete
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete from database
    try {
      await prisma.song.delete({
        where: { id },
      })
    } catch (dbError) {
      console.error("Prisma delete failed:", dbError)
      return NextResponse.json({ error: "Failed to delete song from database" }, { status: 500 })
    }

    // Delete from memory cache
    if (global.songs) {
      global.songs.delete(id)
    }

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("DELETE song error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
