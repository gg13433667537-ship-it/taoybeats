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

const VALID_VOICE_TYPES = ['all', 'system_voice', 'voice_cloning', 'voice_generation']

export async function GET(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    const voiceType = searchParams.get('voice_type') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    // Validate voice_type
    if (!VALID_VOICE_TYPES.includes(voiceType)) {
      return applySecurityHeaders(NextResponse.json(
        { error: "Invalid voice_type. Must be one of: all, system_voice, voice_cloning, voice_generation" },
        { status: 400 }
      ))
    }

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Call MiniMax Voice List API with pagination
    const response = await fetch(`${baseUrl}/v1/voice?voice_type=${encodeURIComponent(voiceType)}&page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      return applySecurityHeaders(NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    return applySecurityHeaders(NextResponse.json({
      system_voice: data.system_voice || [],
      voice_cloning: data.voice_cloning || [],
      voice_generation: data.voice_generation || [],
      base_resp: data.base_resp,
    }))
  } catch (error) {
    console.error("Voice list error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to fetch voice list" },
      { status: 500 }
    ))
  }
}