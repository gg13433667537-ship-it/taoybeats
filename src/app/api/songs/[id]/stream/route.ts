import { NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Simulate progress updates
      const stages = [
        { progress: 5, stage: "initializing", message: "Initializing..." },
        { progress: 20, stage: "generating_melody", message: "Generating melody..." },
        { progress: 45, stage: "generating_lyrics", message: "Processing lyrics..." },
        { progress: 70, stage: "rendering_audio", message: "Rendering audio..." },
        { progress: 90, stage: "finalizing", message: "Finalizing..." },
        { progress: 100, stage: "completed", message: "Complete!", audioUrl: "/sample-audio.mp3" },
      ]

      for (const stage of stages) {
        await new Promise((resolve) => setTimeout(resolve, 1500))

        const data = JSON.stringify({
          id,
          ...stage,
          timestamp: new Date().toISOString(),
        })

        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
