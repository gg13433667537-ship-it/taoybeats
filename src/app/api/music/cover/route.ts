import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
if (!global.users) global.users = new Map()

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

// Structured reference lyrics for learning songwriting style
interface ReferenceLyrics {
  text: string
  startTime?: number // Optional timestamp in seconds
  endTime?: number // Optional timestamp in seconds
  section?: string // e.g., "[Verse]", "[Chorus]"
}

export async function POST(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const params: CoverGenerationParams = body

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
      outputFormat,
      sampleRate,
      bitrate,
      aigcWatermark,
    } = params

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Build prompt from song params
    const promptParts: string[] = []
    if (genre && genre.length > 0) promptParts.push(genre.join(', '))
    if (mood) promptParts.push(mood)
    if (instruments && instruments.length > 0) promptParts.push(`Instruments: ${instruments.join(', ')}`)
    if (referenceSinger) promptParts.push(`Reference Artist: ${referenceSinger}`)
    const prompt = promptParts.join(', ')

    // Check if instrumental
    const isInstrumental = !lyrics || lyrics.trim() === ''

    // Build request payload
    const payload: Record<string, unknown> = {
      model: 'music-cover',
      prompt,
      stream: false,
      output_format: 'url',
    }

    if (!isInstrumental) {
      payload.lyrics = lyrics
    }
    payload.is_instrumental = isInstrumental

    // Reference audio - support multiple input methods
    if (referenceAudio) {
      payload.reference_audio = referenceAudio
    } else if (referenceAudioUrl) {
      // URL-based reference audio
      payload.reference_audio_url = referenceAudioUrl
    }
    if (referenceAudioId) {
      payload.reference_audio_id = referenceAudioId
    }

    // Enhanced Audio-to-Audio: Timbre similarity control (0.0 - 1.0)
    if (timbreSimilarity !== undefined && timbreSimilarity >= 0 && timbreSimilarity <= 1) {
      payload.timbre_similarity = timbreSimilarity
    }

    // Enhanced Audio-to-Audio: Mix mode for vocal + background music combination
    if (mixMode === true) {
      payload.mix_mode = true
      if (mixModeVocalVolume !== undefined && mixModeVocalVolume >= 0 && mixModeVocalVolume <= 1) {
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
    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`

      return NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Return task_id for polling
    return NextResponse.json({
      task_id: data.data?.task_id || data.task_id,
      status: 'PENDING',
    })
  } catch (error) {
    console.error("Cover generation error:", error)
    return NextResponse.json(
      { error: "Failed to start cover generation" },
      { status: 500 }
    )
  }
}