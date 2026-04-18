import { NextRequest, NextResponse } from "next/server"
import type { Song, User, Playlist } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    // Get user
    const usersMap = global.users as Map<string, User> | undefined
    const user = usersMap?.get(userId)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get user's public songs
    const songsMap = global.songs as Map<string, Song> | undefined
    const userSongs = Array.from(songsMap?.values() || [])
      .filter(song => song.userId === userId && song.status === 'COMPLETED' && song.audioUrl)
      .map(song => ({
        id: song.id,
        title: song.title,
        genre: song.genre,
        mood: song.mood,
        audioUrl: song.audioUrl,
        coverUrl: song.coverUrl,
        shareToken: song.shareToken,
        createdAt: song.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Get user's public playlists
    const playlistsMap = global.playlists as Map<string, Playlist> | undefined
    const userPlaylists = Array.from(playlistsMap?.values() || [])
      .filter(p => p.userId === userId && p.isPublic)
      .map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        songCount: p.songIds.length,
        isPublic: p.isPublic,
      }))

    return NextResponse.json({
      userId: user.id,
      name: user.name || user.email?.split('@')[0] || 'Anonymous',
      email: user.email,
      createdAt: user.createdAt,
      songs: userSongs,
      playlists: userPlaylists,
      totalSongs: userSongs.length,
    })
  } catch (error) {
    console.error("Profile error:", error)
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    )
  }
}
