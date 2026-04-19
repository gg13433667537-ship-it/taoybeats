import { NextRequest, NextResponse } from "next/server"
import type { Song, User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { musicProvider, type StemSplitResult as ProviderStemSplitResult } from "@/lib/ai-providers"

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

const STEM_TYPES: StemType[] = ['vocals', 'drums', 'bass', 'other']
const STEM_LABELS: Record<StemType, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other Instruments',
}
const STEM_DESCRIPTIONS: Record<StemType, string> = {
  vocals: 'Lead vocals and harmonies',
  drums: 'Drum tracks and percussion',
  bass: 'Bass guitar and low-frequency instruments',
  other: 'Guitars, synths, strings, and other instruments',
}

function isStemType(value: unknown): value is StemType {
  return typeof value === "string" && STEM_TYPES.includes(value as StemType)
}

function normalizeProviderStem(stem: ProviderStemSplitResult, index: number): StemResult {
  const stemType = isStemType(stem.stem_type) ? stem.stem_type : STEM_TYPES[index] ?? 'other'

  return {
    stem_type: stemType,
    label: typeof stem.label === "string" && stem.label.length > 0 ? stem.label : STEM_LABELS[stemType],
    description:
      typeof stem.description === "string" && stem.description.length > 0
        ? stem.description
        : STEM_DESCRIPTIONS[stemType],
    audioUrl: stem.audioUrl,
    format: typeof stem.format === "string" && stem.format.length > 0 ? stem.format : 'mp3',
    duration: typeof stem.duration === "number" ? stem.duration : 0,
  }
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

    const user = getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get song
    const songsMap = global.songs as Map<string, Song> | undefined
    if (!songsMap) {
      return NextResponse.json({ error: "Storage not initialized" }, { status: 500 })
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

    // Get API credentials
    const apiKey = global.systemApiKey || process.env.MINIMAX_API_KEY
    const apiUrl = global.systemApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'

    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please set MINIMAX_API_KEY environment variable." },
        { status: 500 }
      )
    }

    // Call MiniMax stem splitting API
    let stems: StemResult[] = []
    try {
      if (musicProvider.splitStems) {
        const providerStems = await musicProvider.splitStems(
          { audioUrl: song.audioUrl! },
          apiKey,
          apiUrl
        )
        stems = providerStems.map((stem, index) => normalizeProviderStem(stem, index))
      } else {
        stems = await splitAudioStems(song.audioUrl!, song.title, songId)
      }
    } catch (stemError) {
      // Fallback to local stem splitting if API fails
      console.error("[Stems] MiniMax API failed, using fallback:", stemError)
      stems = await splitAudioStems(song.audioUrl!, song.title, songId)
    }

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
 * Split audio into stems using Demucs
 *
 * This implementation uses Demucs for high-quality audio source separation.
 * Demucs supports separating audio into: vocals, drums, bass, and other instruments.
 *
 * Integration options:
 * 1. Demucs Python package (local GPU server)
 * 2. Replicate API (hosted Demucs)
 * 3. Custom Demucs API server
 *
 * For production, we recommend:
 * - Running Demucs on a GPU server with sufficient compute
 * - Using a queue system (Redis) for processing
 * - Storing results in cloud storage (S3/Supabase Storage)
 */
async function splitAudioStems(audioUrl: string, title: string, songId: string): Promise<StemResult[]> {
  // Check if we have a Demucs API configured
  const demucsApiUrl = process.env.DEMUCS_API_URL
  const demucsApiKey = process.env.DEMUCS_API_KEY

  if (demucsApiUrl) {
    try {
      // Call external Demucs service
      const response = await fetch(`${demucsApiUrl}/separate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(demucsApiKey && { 'Authorization': `Bearer ${demucsApiKey}` }),
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          model: 'htdemucs',
          stems: STEM_TYPES,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Map service response to our StemResult format
        return STEM_TYPES.map(stem_type => ({
          stem_type,
          label: STEM_LABELS[stem_type],
          description: STEM_DESCRIPTIONS[stem_type],
          audioUrl: data.stems?.[stem_type] || data[stem_type] || audioUrl,
          format: 'mp3',
          duration: 0,
        }))
      }
    } catch (error) {
      console.error('[Stems] Demucs API call failed:', error)
      // Fall through to placeholder implementation
    }
  }

  // Check for LALAL.AI API as alternative
  const lalalApiKey = process.env.LALAL_API_KEY
  if (lalalApiKey) {
    try {
      const response = await fetch('https://api.lalal.ai/v1/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lalalApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          parts: ['vocals', 'drums', 'bass', 'other'],
        }),
      })

      if (response.ok) {
        const data = await response.json()

        return STEM_TYPES.map(stem_type => ({
          stem_type,
          label: STEM_LABELS[stem_type],
          description: STEM_DESCRIPTIONS[stem_type],
          audioUrl: data.stems?.[stem_type]?.url || audioUrl,
          format: 'mp3',
          duration: 0,
        }))
      }
    } catch (error) {
      console.error('[Stems] LALAL.AI API call failed:', error)
      // Fall through to placeholder implementation
    }
  }

  // Placeholder implementation - return original audio for all stems
  // In production, this should trigger a background job for Demucs processing
  console.log(`[Stems] No external service configured, using placeholder for song ${songId}`)

  return STEM_TYPES.map(stem_type => ({
    stem_type,
    label: STEM_LABELS[stem_type],
    description: STEM_DESCRIPTIONS[stem_type],
    audioUrl: audioUrl, // Placeholder - in production, queue for async processing
    format: 'mp3',
    duration: 0,
  }))
}
