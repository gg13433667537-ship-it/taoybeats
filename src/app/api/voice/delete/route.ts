import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"


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

const VALID_VOICE_TYPES = ['system_voice', 'voice_cloning', 'voice_generation']

function isValidVoiceIdFormat(voiceId: string): boolean {
  // Voice ID should be a non-empty string, alphanumeric with underscores/hyphens, 1-64 chars
  return typeof voiceId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(voiceId)
}

export async function POST(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { voice_type, voice_id } = body

    if (!voice_type || !voice_id) {
      return applySecurityHeaders(NextResponse.json(
        { error: "voice_type and voice_id are required" },
        { status: 400 }
      ))
    }

    // Validate voice_type
    if (!VALID_VOICE_TYPES.includes(voice_type)) {
      return applySecurityHeaders(NextResponse.json(
        { error: `Invalid voice_type. Must be one of: ${VALID_VOICE_TYPES.join(', ')}` },
        { status: 400 }
      ))
    }

    // Validate voice_id format
    if (!isValidVoiceIdFormat(voice_id)) {
      return applySecurityHeaders(NextResponse.json(
        { error: "Invalid voice_id format" },
        { status: 400 }
      ))
    }

    // Prevent deletion of system voices (they are not owned by users)
    if (voice_type === 'system_voice') {
      return applySecurityHeaders(NextResponse.json(
        { error: "Cannot delete system voices" },
        { status: 403 }
      ))
    }

    // For voice_cloning and voice_generation, ownership should be verified via MiniMax API
    // The user's identity is already authenticated via session token
    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Call MiniMax Delete Voice API
    const response = await fetch(`${baseUrl}/v1/delete_voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        voice_type,
        voice_id,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      return applySecurityHeaders(NextResponse.json(
        { error: `删除音色失败: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    return applySecurityHeaders(NextResponse.json({
      voice_id: data.voice_id,
      created_time: data.created_time,
      base_resp: data.base_resp,
    }))
  } catch (error) {
    console.error("Voice delete error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to delete voice" },
      { status: 500 }
    ))
  }
}