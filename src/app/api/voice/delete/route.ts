import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { voice_type, voice_id, apiKey, apiUrl } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    if (!voice_type || !voice_id) {
      return NextResponse.json(
        { error: "voice_type and voice_id are required" },
        { status: 400 }
      )
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

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

      return NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      voice_id: data.voice_id,
      created_time: data.created_time,
      base_resp: data.base_resp,
    })
  } catch (error) {
    console.error("Voice delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete voice" },
      { status: 500 }
    )
  }
}
