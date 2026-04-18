import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"


if (!global.users) global.users = new Map()
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params

  try {
    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Find song by shareToken
    let foundSong: Song | undefined
    songsMap.forEach((song) => {
      if (song.shareToken === shareToken) {
        foundSong = song
      }
    })

    if (!foundSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    return NextResponse.json(foundSong)
  } catch (error) {
    console.error("Error fetching song by shareToken:", error)
    return NextResponse.json(
      { error: "Failed to fetch song" },
      { status: 500 }
    )
  }
}
