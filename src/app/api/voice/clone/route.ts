import { NextRequest, NextResponse } from "next/server"
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

export async function POST(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { file_id, voice_id, clone_prompt, text, model, language_boost, need_noise_reduction, need_volume_normalization, aigc_watermark } = body

    if (!file_id) {
      return NextResponse.json(
        { error: "file_id is required" },
        { status: 400 }
      )
    }

    if (!voice_id) {
      return NextResponse.json(
        { error: "voice_id is required" },
        { status: 400 }
      )
    }

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Build request payload
    const payload: Record<string, unknown> = {
      file_id,
      voice_id,
    }

    if (clone_prompt) payload.clone_prompt = clone_prompt
    if (text) payload.text = text
    if (model) payload.model = model
    if (language_boost) payload.language_boost = language_boost
    if (need_noise_reduction !== undefined) payload.need_noise_reduction = need_noise_reduction
    if (need_volume_normalization !== undefined) payload.need_volume_normalization = need_volume_normalization
    if (aigc_watermark !== undefined) payload.aigc_watermark = aigc_watermark

    // Call MiniMax Voice Clone API
    const response = await fetch(`${baseUrl}/v1/voice_clone`, {
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
      if (response.status === 2038) {
        return NextResponse.json(
          { error: "无克隆权限，请检查账号认证", code: 2038 },
          { status: 403 }
        )
      }
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
      demo_audio: data.demo_audio,
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Voice clone error:", error)
    return NextResponse.json(
      { error: "Failed to clone voice" },
      { status: 500 }
    )
  }
}