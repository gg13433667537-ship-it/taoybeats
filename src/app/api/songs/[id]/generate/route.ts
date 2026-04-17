import { NextRequest, NextResponse } from "next/server"
import type { Song } from "@/lib/types"
import { miniMaxProvider } from "@/lib/ai-providers"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { apiKey, apiUrl, modifications } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const existingSong = songsMap.get(id)
    if (!existingSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Apply modifications or keep existing
    const updatedSong: Song = {
      ...existingSong,
      ...modifications,
      id: existingSong.id, // Keep original ID
      status: "PENDING",
      updatedAt: new Date().toISOString(),
    }

    songsMap.set(id, updatedSong)

    // Start generation in background
    const baseUrl = apiUrl || 'https://api.minimaxi.com'
    generateMusic(id, updatedSong, apiKey, baseUrl).catch(console.error)

    return NextResponse.json({
      id,
      status: "PENDING",
      message: "Regeneration started",
    })
  } catch (error) {
    console.error("Generate error:", error)
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    )
  }
}

async function generateMusic(
  songId: string,
  song: Song,
  apiKey: string,
  apiUrl: string
) {
  const songsMap = global.songs as Map<string, Song>

  try {
    // Update status to GENERATING
    songsMap.set(songId, { ...song, status: "GENERATING", updatedAt: new Date().toISOString() })

    // Call MiniMax API
    const taskId = await miniMaxProvider.generate({
      title: song.title,
      lyrics: song.lyrics || '',
      genre: song.genre,
      mood: song.mood || '',
      instruments: song.instruments,
      referenceSinger: song.referenceSinger,
      referenceSong: song.referenceSong,
      userNotes: song.userNotes,
    }, apiKey, apiUrl)

    // Poll for progress
    const maxWaitTime = 10 * 60 * 1000 // 10 minutes max
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const progress = await miniMaxProvider.getProgress(taskId, apiKey, apiUrl)

      // Update song with latest status
      const currentSong = songsMap.get(songId)
      if (!currentSong) break

      songsMap.set(songId, {
        ...currentSong,
        status: progress.status,
        audioUrl: progress.audioUrl,
        updatedAt: new Date().toISOString(),
      })

      if (progress.status === 'COMPLETED') {
        console.log(`[Regenerate] Song ${songId} completed, audioUrl: ${progress.audioUrl}`)
        break
      }

      if (progress.status === 'FAILED') {
        console.error(`[Regenerate] Song ${songId} failed:`, progress.error)
        break
      }
    }

    // Final status check
    const finalSong = songsMap.get(songId)
    if (finalSong && finalSong.status !== 'COMPLETED' && finalSong.status !== 'FAILED') {
      songsMap.set(songId, {
        ...finalSong,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error(`[Regenerate] Song ${songId} error:`, error)
    songsMap.set(songId, {
      ...song,
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
    })
  }
}
