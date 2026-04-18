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

export async function GET(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const voiceType = searchParams.get('voice_type') || 'all'

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Call MiniMax Voice List API
    const response = await fetch(`${baseUrl}/v1/voice?voice_type=${voiceType}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      return NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      system_voice: data.system_voice || [],
      voice_cloning: data.voice_cloning || [],
      voice_generation: data.voice_generation || [],
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Voice list error:", error)
    return NextResponse.json(
      { error: "Failed to fetch voice list" },
      { status: 500 }
    )
  }
}