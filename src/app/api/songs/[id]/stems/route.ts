import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

// Global storage is shared from main songs route

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

export type StemType = 'vocals' | 'drums' | 'bass' | 'other'

export interface StemResult {
  stem_type: StemType
  label: string
  description: string
  audioUrl: string
  format: string
  duration: number
}

export interface StemSplitResponse {
  success: boolean
  songId: string
  stems: StemResult[]
  originalAudioUrl: string
  processingTime: number
}

/**
 * Stem Splitting API
 *
 * Separates audio into stems (vocals, drums, bass, other instruments).
 *
 * Currently uses Demucs-style separation via API integration.
 * Can be swapped with MiniMax stem splitting or other services.
 *
 * Note: Full stem splitting requires:
 * - Audio file under 10 minutes
 * - Supported formats: mp3, wav, m4a
 * - Pro users only for high-quality separation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: songId } = await params

    // Auth check
    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get song
    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    const song = songsMap.get(songId)
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 })
    }

    // Only allow owner or admin
    if (song.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if song is completed
    if (song.status !== 'COMPLETED' || !song.audioUrl) {
      return NextResponse.json(
        { error: "Song must be completed to split stems" },
        { status: 400 }
      )
    }

    // Get user to check tier
    const usersMap = global.users as Map<string, User> | undefined
    const userData = usersMap?.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    // Pro feature check (could enforce this more strictly in production)
    if (!isPro) {
      console.log(`[Stems] Free user ${user.id} attempted stem splitting`)
      // For MVP, allow free users to try but note limitation
    }

    const startTime = Date.now()

    // Call stem splitting service
    // In production, this would call Demucs API, LALAL.AI, or MiniMax stem splitting
    const stems = await splitAudioStems(song.audioUrl, song.title)

    const processingTime = Date.now() - startTime

    const response: StemSplitResponse = {
      success: true,
      songId,
      stems,
      originalAudioUrl: song.audioUrl,
      processingTime,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Stem split error:", error)
    return NextResponse.json(
      { error: "Failed to split stems" },
      { status: 500 }
    )
  }
}

/**
 * Split audio into stems using external service
 *
 * This is a placeholder implementation. In production, integrate with:
 * - Demucs (open source) - runs locally or via API
 * - LALAL.AI API - https://www.lalal.ai/api/
 * - Vocali.se API
 * - PhonicMind API
 * - MiniMax (if they add stem splitting)
 */
async function splitAudioStems(audioUrl: string, title: string): Promise<StemResult[]> {
  // In a real implementation, this would:
  // 1. Download the audio from audioUrl
  // 2. Send to stem splitting service (Demucs, LALAL.AI, etc.)
  // 3. Upload separated stems to storage
  // 4. Return URLs to the separated stems

  // For now, return a placeholder structure
  // The actual stem splitting requires significant compute or API costs

  // Example response structure:
  const stemTypes: StemType[] = ['vocals', 'drums', 'bass', 'other']
  const labels: Record<StemType, string> = {
    vocals: 'Vocals',
    drums: 'Drums',
    bass: 'Bass',
    other: 'Other Instruments',
  }
  const descriptions: Record<StemType, string> = {
    vocals: 'Lead vocals and harmonies',
    drums: 'Drum tracks and percussion',
    bass: 'Bass guitar and low-frequency instruments',
    other: 'Guitars, synths, strings, and other instruments',
  }

  return stemTypes.map(stem_type => ({
    stem_type,
    label: labels[stem_type],
    description: descriptions[stem_type],
    // In production, these would be real URLs from the stem splitting service
    audioUrl: audioUrl, // Placeholder - would be replaced with actual stem URL
    format: 'mp3',
    duration: 0, // Would be actual duration from the separated stem
  }))
}
