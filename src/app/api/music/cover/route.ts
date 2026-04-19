import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, DEFAULT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"

// API configuration - read once at module load
const API_KEY = process.env.MINIMAX_API_KEY
const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
const API_TIMEOUT_MS = 30000 // 30 second timeout

// Validation constants
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

interface CoverGenerationParams {
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
  // Audio settings
  model?: 'music-cover' | 'music-cover-free'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
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

  if (!params.referenceAudio && !params.referenceAudioUrl) {
    errors.push({ field: 'referenceAudio', message: 'Reference audio is required for cover generation' })
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
    console.error("API_KEY is not configured")
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
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceAudio,
      referenceAudioUrl,
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
    const rawPrompt = promptParts.join(', ').trim()
    const prompt = rawPrompt.length >= 10
      ? rawPrompt
      : 'Create a cover inspired by the provided reference audio.'

    // Check if instrumental
    const isInstrumental = !lyrics || lyrics.trim() === ''

    // Build request payload - use snake_case for API consistency
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
      payload.audio_base64 = referenceAudio.startsWith('data:')
        ? referenceAudio.split(',', 2)[1] || ''
        : referenceAudio
    } else if (referenceAudioUrl) {
      // URL-based reference audio - validated above
      payload.audio_url = referenceAudioUrl
    }

    // Audio quality settings
    payload.audio_setting = {
      sample_rate: sampleRate || 44100,
      bitrate: bitrate || 256000,
      format: outputFormat || 'mp3',
    }

    payload.aigc_watermark = aigcWatermark ?? false

    // Call Music Generation API with cover model
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
        { error: `API error: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    const audioUrl = typeof data.data?.audio === 'string' && data.data.audio.startsWith('http')
      ? data.data.audio
      : undefined

    if (data.data?.status === 2 && audioUrl) {
      return applySecurityHeaders(NextResponse.json({
        task_id: `audio:${audioUrl}`,
        status: 'COMPLETED',
        audioUrl,
      }))
    }

    // Return task_id for polling
    const taskId = data.data?.task_id || data.task_id
    if (!taskId) {
      console.error("API response missing task_id:", data)
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
