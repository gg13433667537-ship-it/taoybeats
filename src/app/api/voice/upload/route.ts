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
    const { file_data, filename, purpose = 'prompt_audio' } = body

    if (!file_data) {
      return NextResponse.json(
        { error: "file_data is required" },
        { status: 400 }
      )
    }

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Call MiniMax File Upload API
    // file_data should be base64 encoded audio
    const response = await fetch(`${baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        file: file_data,
        filename: filename || 'audio.mp3',
        purpose,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      // Handle specific error codes
      if (response.status === 2049) {
        return NextResponse.json(
          { error: "无效API Key", code: 2049 },
          { status: 401 }
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
      file: {
        file_id: data.file?.file_id,
        bytes: data.file?.bytes,
        created_at: data.file?.created_at,
        filename: data.file?.filename,
        purpose: data.file?.purpose,
      },
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Voice upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload voice file" },
      { status: 500 }
    )
  }
}