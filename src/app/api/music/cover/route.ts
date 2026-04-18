import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var systemApiKey: string | undefined
  var systemApiUrl: string | undefined
  var users: Map<string, User> | undefined
}

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

export async function POST(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      title,
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceAudio,
      referenceAudioId,
    } = body

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Build prompt from song params
    const promptParts: string[] = []
    if (genre?.length > 0) promptParts.push(genre.join(', '))
    if (mood) promptParts.push(mood)
    if (instruments?.length > 0) promptParts.push(`Instruments: ${instruments.join(', ')}`)
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

    if (referenceAudio) {
      payload.reference_audio = referenceAudio
    }
    if (referenceAudioId) {
      payload.reference_audio_id = referenceAudioId
    }

    if (title) payload.title = title

    payload.audio_setting = {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    }

    payload.aigc_watermark = false

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