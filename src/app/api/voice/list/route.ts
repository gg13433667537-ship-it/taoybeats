import { NextRequest, NextResponse } from "next/server"

// Use system API key - hardcoded for all users
declare global {
  var systemApiKey: string | undefined
  var systemApiUrl: string | undefined
}

if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY || 'sk-cp-IM9XKrS2pUcf2w_ybwstx2D3n4YcYGroc6DSF8UHQowdvqsiBRkdPDGQ-qAGvIAqwL0j-HVHhKzpcg5m5QG2oX-HrfVniF_xbKCTFsnBEusnFFD-69nrWEU'
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

export async function GET(request: NextRequest) {
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
