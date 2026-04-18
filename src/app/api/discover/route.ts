import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"
import { discoverCache } from "@/lib/cache"


// Build cache key from query params
function buildDiscoverCacheKey(page: number, limit: number, genre: string | null, mood: string | null, search: string | null, sort: string): string {
  return `discover:${page}:${limit}:${genre || ''}:${mood || ''}:${search || ''}:${sort}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const genre = searchParams.get('genre')
    const mood = searchParams.get('mood')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest'

    // Check cache first (only for first page without filters)
    const cacheKey = buildDiscoverCacheKey(page, limit, genre, mood, search, sort)
    if (page === 1 && !genre && !mood && !search && discoverCache.has(cacheKey)) {
      return NextResponse.json(discoverCache.get(cacheKey))
    }

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap || songsMap.size === 0) {
      return NextResponse.json({
        songs: [],
        page,
        limit,
        total: 0,
        totalPages: 0,
      })
    }

    // Get all completed public songs with user info
    let publicSongs = Array.from(songsMap.values())
      .filter(song => {
        // Only show completed songs
        if (song.status !== 'COMPLETED') return false
        // Check if song has audio (is actually playable)
        if (!song.audioUrl) return false
        return true
      })
      .map(song => {
        // Get user info
        const usersMap = global.users as Map<string, User> | undefined
        const user = usersMap?.get(song.userId)
        return {
          ...song,
          userName: user?.name || user?.email?.split('@')[0] || 'Anonymous',
          userEmail: user?.email,
        }
      })

    // Filter by genre if specified
    if (genre) {
      publicSongs = publicSongs.filter(song =>
        song.genre?.some(g => g.toLowerCase().includes(genre.toLowerCase()))
      )
    }

    // Filter by mood if specified
    if (mood) {
      publicSongs = publicSongs.filter(song =>
        song.mood?.toLowerCase().includes(mood.toLowerCase())
      )
    }

    // Filter by search query (searches title, genre, mood, instruments)
    if (search) {
      const searchLower = search.toLowerCase()
      publicSongs = publicSongs.filter(song =>
        song.title?.toLowerCase().includes(searchLower) ||
        song.genre?.some(g => g.toLowerCase().includes(searchLower)) ||
        song.mood?.toLowerCase().includes(searchLower) ||
        song.instruments?.some(i => i.toLowerCase().includes(searchLower)) ||
        song.userName?.toLowerCase().includes(searchLower)
      )
    }

    // Sort songs
    switch (sort) {
      case 'oldest':
        publicSongs.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        break
      case 'title':
        publicSongs.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '')
        )
        break
      case 'newest':
      default:
        publicSongs.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }

    // Paginate
    const total = publicSongs.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedSongs = publicSongs.slice(startIndex, startIndex + limit)

    const response = {
      songs: paginatedSongs.map(song => ({
        id: song.id,
        title: song.title,
        genre: song.genre,
        mood: song.mood,
        instruments: song.instruments,
        audioUrl: song.audioUrl,
        coverUrl: song.coverUrl,
        shareToken: song.shareToken,
        userName: song.userName,
        createdAt: song.createdAt,
      })),
      page,
      limit,
      total,
      totalPages,
    }

    // Cache first page results without filters for 10 seconds
    if (page === 1 && !genre && !mood && !search) {
      discoverCache.set(cacheKey, response, 10000)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Discover error:", error)
    return NextResponse.json(
      { error: "Failed to fetch discover songs" },
      { status: 500 }
    )
  }
}
