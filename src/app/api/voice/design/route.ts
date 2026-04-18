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
    const { prompt, preview_text, voice_id, aigc_watermark } = body

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt (音色描述) is required" },
        { status: 400 }
      )
    }

    if (!preview_text) {
      return NextResponse.json(
        { error: "preview_text (试听文本) is required" },
        { status: 400 }
      )
    }

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Build request payload
    const payload: Record<string, unknown> = {
      prompt,
      preview_text,
    }

    if (voice_id) payload.voice_id = voice_id
    if (aigc_watermark !== undefined) payload.aigc_watermark = aigc_watermark

    // Call MiniMax Voice Design API
    const response = await fetch(`${baseUrl}/v1/voice_design`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      // Handle specific error codes
      if (response.status === 1008) {
        return NextResponse.json(
          { error: "余额不足，请充值后重试", code: 1008 },
          { status: 402 }
        )
      }
      if (response.status === 1002) {
        return NextResponse.json(
          { error: "请求过于频繁，请稍后再试", code: 1002 },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      voice_id: data.voice_id,
      trial_audio: data.trial_audio,
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Voice design error:", error)
    return NextResponse.json(
      { error: "Failed to design voice" },
      { status: 500 }
    )
  }
}