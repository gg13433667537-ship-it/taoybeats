import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const voiceType = searchParams.get('voice_type') || 'all'
    const apiKey = searchParams.get('apiKey')
    const apiUrl = searchParams.get('apiUrl')

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

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
