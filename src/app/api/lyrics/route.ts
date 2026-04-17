import { NextRequest, NextResponse } from "next/server"

// Use system API key - hardcoded for all users
declare global {
  var systemApiKey: string | undefined
  var systemApiUrl: string | undefined
}

if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY || 'sk-cp-IM9XKrS2pUcf2w_ybwstx2D3n4YcYGroc6DSF8UHQowdvqsiBRkdPDGQ-qAGvIAqwL0j-HVHhKzpcg5m5QG2oX-HrfVniF_xbKCTFsnBEusnFFD-69nrWEU'
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode, prompt, lyrics, title } = body

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Build request payload
    const payload: Record<string, unknown> = {
      model: "music-2.6",
    }

    // mode: write_full_song or edit
    if (mode === 'edit' && lyrics) {
      payload.mode = 'edit'
      payload.lyrics = lyrics
      if (prompt) payload.prompt = prompt
    } else {
      payload.mode = 'write_full_song'
      if (prompt) payload.prompt = prompt
    }

    if (title) payload.title = title

    // Call MiniMax Lyrics Generation API
    const response = await fetch(`${baseUrl}/v1/lyrics_generation`, {
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
      if (response.status === 1026) {
        return NextResponse.json(
          { error: "内容包含敏感词，请修改后重试", code: 1026 },
          { status: 400 }
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
      song_title: data.song_title,
      style_tags: data.style_tags,
      lyrics: data.lyrics,
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Lyrics generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate lyrics" },
      { status: 500 }
    )
  }
}
