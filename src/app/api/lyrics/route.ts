import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, DEFAULT_RATE_LIMIT, rateLimitMiddleware, MAX_LENGTHS } from "@/lib/security"


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
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "lyrics")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { mode, prompt, lyrics, title } = body

    // Validate prompt length
    if (prompt && typeof prompt === 'string' && prompt.length > 2000) {
      return applySecurityHeaders(NextResponse.json({ error: "prompt exceeds maximum length of 2000 characters" }, { status: 400 }))
    }

    // Validate lyrics length if provided
    if (lyrics && typeof lyrics === 'string' && lyrics.length > 10000) {
      return applySecurityHeaders(NextResponse.json({ error: "lyrics exceeds maximum length of 10000 characters" }, { status: 400 }))
    }

    // Validate title length if provided
    if (title && typeof title === 'string' && title.length > MAX_LENGTHS.TITLE) {
      return applySecurityHeaders(NextResponse.json({ error: `title exceeds maximum length of ${MAX_LENGTHS.TITLE} characters` }, { status: 400 }))
    }

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Check if API key is configured
    if (!apiKey) {
      console.error("MINIMAX_API_KEY is not configured")
      return applySecurityHeaders(NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      ))
    }

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
        return applySecurityHeaders(NextResponse.json(
          { error: "内容包含敏感词，请修改后重试", code: 1026 },
          { status: 400 }
        ))
      }
      if (response.status === 1008) {
        return applySecurityHeaders(NextResponse.json(
          { error: "余额不足，请充值后重试", code: 1008 },
          { status: 402 }
        ))
      }
      if (response.status === 1002) {
        return applySecurityHeaders(NextResponse.json(
          { error: "请求过于频繁，请稍后再试", code: 1002 },
          { status: 429 }
        ))
      }

      return applySecurityHeaders(NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    return applySecurityHeaders(NextResponse.json({
      song_title: data.song_title,
      style_tags: data.style_tags,
      lyrics: data.lyrics,
      base_resp: data.base_resp,
    }))
  } catch (error) {
    console.error("Lyrics generation error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to generate lyrics" },
      { status: 500 }
    ))
  }
}