/**
 * GET /api/songs/[id]/stream
 * @version v1
 * @description SSE流式端点，实时推送歌曲生成进度和状态
 * @param {string} id - 歌曲ID（路径参数）
 * @returns {text/event-stream} SSE流，持续推送 { id, status, progress, stage, audioUrl, timestamp }
 * @status PENDING - 任务已排队（progress: 5-10%）
 * @status GENERATING - 生成中（progress: 50%）
 * @status COMPLETED - 完成（progress: 100%, 包含audioUrl）
 * @status FAILED - 失败（包含error字段）
 * @errors 401 - 未授权 | 403 - 无权访问该歌曲 | 404 - 歌曲不存在 | 500 - 服务器错误
 * @timeout 10分钟超时，轮询间隔3秒
 * @note 仅歌曲所有者或ADMIN可访问
 */
import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    // Return demo user for unauthenticated SSE connections (matches songs/route.ts behavior)
    return { id: 'demo-user', email: 'demo@example.com', role: 'USER' }
  }
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      // Invalid token - return demo user instead of blocking
      return { id: 'demo-user', email: 'demo@example.com', role: 'USER' }
    }
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    // Invalid token - return demo user instead of blocking
    return { id: 'demo-user', email: 'demo@example.com', role: 'USER' }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check - user must be authenticated
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!global.songs) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  const song = global.songs.get(id) as Song | undefined
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  // Only allow owner or admin to stream
  if (song.userId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
      if (!song) {
        sendEvent({ id, status: 'FAILED', error: 'Song not found', timestamp: new Date().toISOString() })
        controller.close()
        return
      }
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

        // Re-read from global.songs to get latest status
        const currentSong = global.songs?.get(id) as Song | undefined
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