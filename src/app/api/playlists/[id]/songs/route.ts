import { NextRequest, NextResponse } from "next/server"
import type { Playlist } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { playlistCache } from "@/lib/cache"
import { validateUUID, applySecurityHeaders } from "@/lib/security"
import { prisma } from "@/lib/db"


if (!global.users) global.users = new Map()
if (!global.playlists) global.playlists = new Map()

function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

// GET /api/playlists/[id]/songs - Resolve playlist songs from cache plus Prisma
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const { id } = await params
  const playlist = global.playlists?.get(id) as Playlist | undefined

  if (!playlist) {
    return applySecurityHeaders(NextResponse.json({ error: "Playlist not found" }, { status: 404 }))
  }

  if (playlist.userId !== user.id && user.role !== "ADMIN") {
    return applySecurityHeaders(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  try {
    const cachedSongs = playlist.songIds
      .map((songId) => global.songs?.get(songId))
      .filter((song): song is NonNullable<typeof song> => Boolean(song))
    const cachedSongIds = new Set(cachedSongs.map((song) => song.id))
    const missingIds = playlist.songIds.filter((songId) => !cachedSongIds.has(songId))
    const dbSongs = missingIds.length
      ? await prisma.song.findMany({
          where: { id: { in: missingIds } },
        })
      : []

    const songsById = new Map<string, unknown>()
    cachedSongs.forEach((song) => songsById.set(song.id, song))
    dbSongs.forEach((song) => songsById.set(song.id, song))

    const songs = playlist.songIds
      .map((songId) => songsById.get(songId))
      .filter(Boolean)

    return applySecurityHeaders(NextResponse.json({ songs }))
  } catch (error) {
    console.error("Get playlist songs error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to load playlist songs" }, { status: 500 }))
  }
}

// POST /api/playlists/[id]/songs - Add a song to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const { id } = await params
  const playlist = global.playlists?.get(id) as Playlist | undefined

  if (!playlist) {
    return applySecurityHeaders(NextResponse.json({ error: "Playlist not found" }, { status: 404 }))
  }

  // Check ownership
  if (playlist.userId !== user.id && user.role !== 'ADMIN') {
    return applySecurityHeaders(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  try {
    const { songId } = await request.json()

    if (!songId) {
      return applySecurityHeaders(NextResponse.json({ error: "Song ID is required" }, { status: 400 }))
    }

    // Validate songId is a valid UUID
    const songIdError = validateUUID(songId, "Song ID")
    if (songIdError) {
      return applySecurityHeaders(NextResponse.json({ error: songIdError }, { status: 400 }))
    }

    const cachedSong = global.songs?.get(songId)
    const dbSong = cachedSong
      ? null
      : await prisma.song.findUnique({
          where: { id: songId },
        })

    // Check if song exists
    if (!cachedSong && !dbSong) {
      return applySecurityHeaders(NextResponse.json({ error: "Song not found" }, { status: 404 }))
    }

    // Check if song is already in playlist
    if (playlist.songIds.includes(songId)) {
      return applySecurityHeaders(NextResponse.json({ error: "Song already in playlist" }, { status: 409 }))
    }

    const updated: Playlist = {
      ...playlist,
      songIds: [...playlist.songIds, songId],
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(id, updated)

    // Invalidate playlist cache for owner
    playlistCache.delete(`playlists:${playlist.userId}`)

    return applySecurityHeaders(NextResponse.json({ playlist: updated }))
  } catch (error) {
    console.error("Add song to playlist error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to add song to playlist" }, { status: 500 }))
  }
}

// DELETE /api/playlists/[id]/songs - Remove a song from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const { id } = await params
  const playlist = global.playlists?.get(id) as Playlist | undefined

  if (!playlist) {
    return applySecurityHeaders(NextResponse.json({ error: "Playlist not found" }, { status: 404 }))
  }

  // Check ownership
  if (playlist.userId !== user.id && user.role !== 'ADMIN') {
    return applySecurityHeaders(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (!songId) {
      return applySecurityHeaders(NextResponse.json({ error: "Song ID is required" }, { status: 400 }))
    }

    // Validate songId is a valid UUID
    const songIdError = validateUUID(songId, "Song ID")
    if (songIdError) {
      return applySecurityHeaders(NextResponse.json({ error: songIdError }, { status: 400 }))
    }

    const updated: Playlist = {
      ...playlist,
      songIds: playlist.songIds.filter(sid => sid !== songId),
      updatedAt: new Date().toISOString(),
    }

    global.playlists?.set(id, updated)

    // Invalidate playlist cache for owner
    playlistCache.delete(`playlists:${playlist.userId}`)

    return applySecurityHeaders(NextResponse.json({ playlist: updated }))
  } catch (error) {
    console.error("Remove song from playlist error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to remove song from playlist" }, { status: 500 }))
  }
}
