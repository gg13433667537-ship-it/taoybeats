import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const songsMap = global.songs as Map<string, Song> | undefined
  if (!songsMap) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  const song = songsMap.get(id)
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  // Create SSE stream that polls for song status
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const maxDuration = 10 * 60 * 1000 // 10 minutes max
      const pollInterval = 3000 // 3 seconds
      const startTime = Date.now()

      // Send initial status
      sendEvent({
        id,
        status: song.status,
        progress: song.status === 'PENDING' ? 5 : song.status === 'GENERATING' ? 50 : song.status === 'COMPLETED' ? 100 : 0,
        audioUrl: song.audioUrl,
        timestamp: new Date().toISOString(),
      })

      // Poll for updates until completed/failed or timeout
      while (Date.now() - startTime < maxDuration) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const currentSong = songsMap.get(id)
        if (!currentSong) {
          sendEvent({ id, status: 'FAILED', error: 'Song not found', timestamp: new Date().toISOString() })
          break
        }

        let progress = 50
        let stage = 'Generating music...'

        switch (currentSong.status) {
          case 'PENDING':
            progress = 10
            stage = 'Initializing...'
            break
          case 'GENERATING':
            progress = 50
            stage = 'Creating your music...'
            break
          case 'COMPLETED':
            progress = 100
            stage = 'Complete!'
            sendEvent({
              id,
              status: 'COMPLETED',
              progress: 100,
              stage: 'Complete!',
              audioUrl: currentSong.audioUrl,
              timestamp: new Date().toISOString(),
            })
            controller.close()
            return
          case 'FAILED':
            sendEvent({
              id,
              status: 'FAILED',
              progress: 0,
              stage: 'Generation failed',
              error: currentSong.audioUrl || 'Unknown error',
              timestamp: new Date().toISOString(),
            })
            controller.close()
            return
        }

        sendEvent({
          id,
          status: currentSong.status,
          progress,
          stage,
          audioUrl: currentSong.audioUrl,
          timestamp: new Date().toISOString(),
        })
      }

      // Timeout
      sendEvent({
        id,
        status: 'FAILED',
        progress: 0,
        stage: 'Timeout - generation took too long',
        error: 'Generation timeout',
        timestamp: new Date().toISOString(),
      })
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
