import { NextRequest, NextResponse } from "next/server"
import { miniMaxProvider } from "@/lib/ai-providers"

// In-memory store for demo (replace with database in production)
const songs: Map<string, any> = new Map()

export async function GET(request: NextRequest) {
  // Return all songs for demo
  const allSongs = Array.from(songs.values())
  return NextResponse.json({ songs: allSongs })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceSong,
      userNotes,
      apiKey,
      apiUrl,
    } = body

    // Validation
    if (!title || !lyrics || !genre?.length || !mood) {
      return NextResponse.json(
        { error: "Missing required fields: title, lyrics, genre, mood" },
        { status: 400 }
      )
    }

    // Create song record
    const songId = crypto.randomUUID()
    const song = {
      id: songId,
      title,
      lyrics,
      genre,
      mood,
      instruments: instruments || [],
      referenceSinger,
      referenceSong,
      userNotes,
      status: "GENERATING",
      audioUrl: null,
      shareToken: crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    }

    songs.set(songId, song)

    // Start generation in background
    generateMusic(songId, song, apiKey, apiUrl).catch(console.error)

    return NextResponse.json({
      id: songId,
      shareToken: song.shareToken,
      status: "GENERATING",
    })
  } catch (error) {
    console.error("Error creating song:", error)
    return NextResponse.json(
      { error: "Failed to create song" },
      { status: 500 }
    )
  }
}

async function generateMusic(
  songId: string,
  song: any,
  apiKey?: string,
  apiUrl?: string
) {
  try {
    // Update to generating
    songs.set(songId, { ...song, status: "GENERATING" })

    // Simulate MiniMax API call
    // In production, use: miniMaxProvider.generate({...}, apiKey, apiUrl, 'music-2.6')
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate completion
    songs.set(songId, {
      ...song,
      status: "COMPLETED",
      audioUrl: "/sample-audio.mp3", // Placeholder
    })
  } catch (error) {
    console.error("Generation error:", error)
    songs.set(songId, {
      ...song,
      status: "FAILED",
      error: "Generation failed",
    })
  }
}
