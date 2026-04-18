import { NextRequest, NextResponse } from "next/server"
import type { Song, ModerationStatus } from "@/lib/types"
import { applySecurityHeaders } from "@/lib/security"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { status } = body as { status: ModerationStatus }

    if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Invalid moderation status. Must be PENDING, APPROVED, or REJECTED' },
        { status: 400 }
      ))
    }

    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return applySecurityHeaders(NextResponse.json({ error: "Songs not found" }, { status: 404 }))
    }

    const song = songsMap.get(id)
    if (!song) {
      return applySecurityHeaders(NextResponse.json({ error: "Song not found" }, { status: 404 }))
    }

    // Update moderation status
    const updatedSong = { ...song, moderationStatus: status }
    songsMap.set(id, updatedSong)

    // Log admin action
    if (global.adminLogs) {
      const logEntry = {
        action: 'MODERATION_UPDATE',
        songId: id,
        newStatus: status,
        timestamp: new Date().toISOString(),
      }
      global.adminLogs.set(crypto.randomUUID(), logEntry)
    }

    return NextResponse.json(updatedSong)
  } catch (error) {
    console.error("Moderation error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to update moderation status" },
      { status: 500 }
    ))
  }
}
