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
import { prisma } from "@/lib/db"

// Initialize global songs map if not exists
if (typeof global.songs === 'undefined') global.songs = new Map()

// Helper to get song from database or memory cache
async function getSongById(id: string): Promise<Song | null> {
  // Try memory cache first
  const cachedSong = global.songs?.get(id) as Song | undefined
  if (cachedSong) {
    return cachedSong
  }

  // Fall back to database
  try {
    const dbSong = await prisma.song.findUnique({
      where: { id },
    })
    if (dbSong) {
      const song: Song = {
        id: dbSong.id,
        title: dbSong.title,
        lyrics: dbSong.lyrics || undefined,
        genre: dbSong.genre,
        mood: dbSong.mood || undefined,
        instruments: dbSong.instruments,
        referenceSinger: dbSong.referenceSinger || undefined,
        referenceSong: dbSong.referenceSong || undefined,
        userNotes: dbSong.userNotes || undefined,
        isInstrumental: false,
        status: dbSong.status as Song['status'],
        moderationStatus: "APPROVED" as const,
        audioUrl: dbSong.audioUrl || undefined,
        coverUrl: dbSong.coverUrl || undefined,
        shareToken: dbSong.shareToken || undefined,
        userId: dbSong.userId,
        createdAt: dbSong.createdAt.toISOString(),
        updatedAt: dbSong.updatedAt.toISOString(),
      }
      // Update cache
      global.songs?.set(id, song)
      return song
    }
  } catch (dbError) {
    console.error("Database lookup failed:", dbError)
  }

  return null
}


function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return null
  }
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) {
      return null
    }
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
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

  // Look up song from database or memory cache
  const song = await getSongById(id)
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

      // Send initial status (song is guaranteed to exist here)
      sendEvent({
        id,
        status: song.status,
        progress: song.status === 'PENDING' ? 5 : song.status === 'GENERATING' ? 50 : song.status === 'COMPLETED' ? 100 : 0,
        stage: song.status === 'PENDING' ? 'Queued...' : song.status === 'GENERATING' ? 'Creating your music...' : song.status === 'COMPLETED' ? 'Complete!' : 'Unknown',
        audioUrl: song.audioUrl,
        timestamp: new Date().toISOString(),
      })

      // Poll for updates until completed/failed or timeout
      while (Date.now() - startTime < maxDuration) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        // Re-read from database or memory cache to get latest status
        const currentSong = await getSongById(id)
        if (!currentSong) {
          sendEvent({ id, status: 'FAILED', error: 'Song not found', timestamp: new Date().toISOString() })
          break
        }

        let progress = 50
        let stage = 'Creating your music...'

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
            // Use a dedicated error message - audioUrl is not an error field
            const errorMessage = (currentSong as Song & { error?: string }).error || currentSong.audioUrl || 'Generation failed'
            sendEvent({
              id,
              status: 'FAILED',
              progress: 0,
              stage: 'Generation failed',
              error: errorMessage,
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
      "X-Accel-Buffering": "no",
      "Retry": "3000",
    },
  })
}