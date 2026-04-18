import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, DEFAULT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"

// API configuration - read once at module load
const API_KEY = process.env.MINIMAX_API_KEY
const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
const API_TIMEOUT_MS = 30000 // 30 second timeout

// Validation constants
const MAX_TITLE_LENGTH = 200
const MAX_LYRICS_LENGTH = 10000
const MAX_GENRE_COUNT = 5
const MAX_INSTRUMENTS_COUNT = 10
const MAX_REFERENCE_AUDIO_URL_LENGTH = 2048
const MAX_REFERENCE_AUDIO_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

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

// Validate URL format and check for internal/network addresses
function isValidAudioUrl(url: string): boolean {
  if (!url || url.length > MAX_REFERENCE_AUDIO_URL_LENGTH) return false
  try {
    const parsed = new URL(url)
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    // Block private IP ranges (basic SSRF prevention)
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.internal') ||
      /^(::1|fe80:|::ffff:)/i.test(hostname)
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

// Structured reference lyrics for learning songwriting style
interface ReferenceLyrics {
  text: string
  startTime?: number // Optional timestamp in seconds
  endTime?: number // Optional timestamp in seconds
  section?: string // e.g., "[Verse]", "[Chorus]"
}

// Enhanced cover generation parameters
interface CoverGenerationParams {
  title?: string
  lyrics?: string
  genre?: string[]
  mood?: string
  instruments?: string[]
  referenceSinger?: string
  referenceSong?: string
  userNotes?: string
  isInstrumental?: boolean
  voiceId?: string
  referenceAudio?: string
  referenceAudioUrl?: string
  referenceAudioId?: string
  // Enhanced Audio-to-Audio parameters
  timbreSimilarity?: number // 0.0 - 1.0, controls how similar the generated timbre is to reference
  mixMode?: boolean // When true, mixes vocals from reference with new background
  mixModeVocalVolume?: number // 0.0 - 1.0, volume of vocals in mix mode
  referenceLyrics?: ReferenceLyrics[] // Structured reference lyrics for style learning
  // Audio settings
  model?: 'music-2.6' | 'music-cover'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
}

// Validation error helper
interface ValidationError {
  field: string
  message: string
}

function validateParams(params: CoverGenerationParams): ValidationError[] {
  const errors: ValidationError[] = []

  if (params.title && params.title.length > MAX_TITLE_LENGTH) {
    errors.push({ field: 'title', message: `Title must be ${MAX_TITLE_LENGTH} characters or less` })
  }

  if (params.lyrics && params.lyrics.length > MAX_LYRICS_LENGTH) {
    errors.push({ field: 'lyrics', message: `Lyrics must be ${MAX_LYRICS_LENGTH} characters or less` })
  }

  if (params.genre && params.genre.length > MAX_GENRE_COUNT) {
    errors.push({ field: 'genre', message: `Maximum ${MAX_GENRE_COUNT} genres allowed` })
  }

  if (params.instruments && params.instruments.length > MAX_INSTRUMENTS_COUNT) {
    errors.push({ field: 'instruments', message: `Maximum ${MAX_INSTRUMENTS_COUNT} instruments allowed` })
  }

  if (params.referenceAudioUrl && !isValidAudioUrl(params.referenceAudioUrl)) {
    errors.push({ field: 'referenceAudioUrl', message: 'Invalid reference audio URL format' })
  }

  if (params.timbreSimilarity !== undefined && (params.timbreSimilarity < 0 || params.timbreSimilarity > 1)) {
    errors.push({ field: 'timbreSimilarity', message: 'timbreSimilarity must be between 0 and 1' })
  }

  if (params.mixModeVocalVolume !== undefined && (params.mixModeVocalVolume < 0 || params.mixModeVocalVolume > 1)) {
    errors.push({ field: 'mixModeVocalVolume', message: 'mixModeVocalVolume must be between 0 and 1' })
  }

  return errors
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "music-cover")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  // Check API key is configured
  if (!API_KEY) {
    console.error("MINIMAX_API_KEY is not configured")
    return applySecurityHeaders(NextResponse.json(
      { error: "Service configuration error" },
      { status: 500 }
    ))
  }

  try {
    const body = await request.json()
    const params: CoverGenerationParams = body

    // Validate input parameters
    const validationErrors = validateParams(params)
    if (validationErrors.length > 0) {
      return applySecurityHeaders(NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      ))
    }

    const {
      title,
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceAudio,
      referenceAudioUrl,
      referenceAudioId,
      timbreSimilarity,
      mixMode,
      mixModeVocalVolume,
      referenceLyrics,
      model,
      outputFormat,
      sampleRate,
      bitrate,
      aigcWatermark,
    } = params

    // Build prompt from song params
    const promptParts: string[] = []
    if (genre && genre.length > 0) promptParts.push(genre.join(', '))
    if (mood) promptParts.push(mood)
    if (instruments && instruments.length > 0) promptParts.push(`Instruments: ${instruments.join(', ')}`)
    if (referenceSinger) promptParts.push(`Reference Artist: ${referenceSinger}`)
    const prompt = promptParts.join(', ')

    // Check if instrumental
    const isInstrumental = !lyrics || lyrics.trim() === ''

    // Build request payload - use snake_case for MiniMax API consistency
    const payload: Record<string, unknown> = {
      model: model || 'music-cover',
      prompt,
      stream: false,
      output_format: 'url',
    }

    if (!isInstrumental && lyrics) {
      payload.lyrics = lyrics
    }
    payload.is_instrumental = isInstrumental

    // Reference audio - support multiple input methods
    if (referenceAudio) {
      // Validate base64 reference audio size
      if (referenceAudio.length > MAX_REFERENCE_AUDIO_SIZE_BYTES * 4 / 3) { // base64 is ~4/3 size
        return applySecurityHeaders(NextResponse.json(
          { error: "Reference audio too large. Maximum size is 50MB." },
          { status: 400 }
        ))
      }
      payload.reference_audio = referenceAudio
    } else if (referenceAudioUrl) {
      // URL-based reference audio - validated above
      payload.reference_audio_url = referenceAudioUrl
    }
    if (referenceAudioId) {
      payload.reference_audio_id = referenceAudioId
    }

    // Enhanced Audio-to-Audio: Timbre similarity control (0.0 - 1.0)
    if (timbreSimilarity !== undefined) {
      payload.timbre_similarity = timbreSimilarity
    }

    // Enhanced Audio-to-Audio: Mix mode for vocal + background music combination
    if (mixMode === true) {
      payload.mix_mode = true
      if (mixModeVocalVolume !== undefined) {
        payload.mix_mode_vocal_volume = mixModeVocalVolume
      }
    }

    // Enhanced Audio-to-Audio: Reference lyrics for structured style learning
    if (referenceLyrics && referenceLyrics.length > 0) {
      payload.reference_lyrics = referenceLyrics.map(rl => ({
        text: rl.text,
        start_time: rl.startTime,
        end_time: rl.endTime,
        section: rl.section,
      }))
    }

    if (title) payload.title = title

    // Audio quality settings
    payload.audio_setting = {
      sample_rate: sampleRate || 44100,
      bitrate: bitrate || 256000,
      format: outputFormat || 'mp3',
    }

    payload.aigc_watermark = aigcWatermark ?? false

    // Call MiniMax Music Generation API with cover model
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${API_URL}/v1/music_generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return applySecurityHeaders(NextResponse.json(
          { error: "Request timed out. Please try again." },
          { status: 504 }
        ))
      }
      throw fetchError
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`

      return applySecurityHeaders(NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    // Return task_id for polling
    const taskId = data.data?.task_id || data.task_id
    if (!taskId) {
      console.error("MiniMax API response missing task_id:", data)
      return applySecurityHeaders(NextResponse.json(
        { error: "Invalid response from music generation service" },
        { status: 500 }
      ))
    }

    return applySecurityHeaders(NextResponse.json({
      task_id: taskId,
      status: 'PENDING',
    }))
  } catch (error) {
    console.error("Cover generation error:", error)
    const message = error instanceof Error ? error.message : "Failed to start cover generation"
    return applySecurityHeaders(NextResponse.json(
      { error: message },
      { status: 500 }
    ))
  }
}