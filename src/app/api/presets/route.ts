import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import type { Preset } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { sanitizeString, validateRequiredString, validateOptionalString, validateStringArray, validateNumber, validateUUID, validateBoolean, MAX_LENGTHS, applySecurityHeaders } from "@/lib/security"


if (!global.users) global.users = new Map()
if (!global.presets) global.presets = new Map()

const presets = global.presets!

const MAX_PRESETS_PER_USER = 10

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

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  // Get all presets for this user
  const userPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
  return applySecurityHeaders(NextResponse.json({ presets: userPresets }))
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { name, genre, mood, instruments, isInstrumental, duration, shareWith } = body

    // Validate and sanitize name
    const nameError = validateRequiredString(name, MAX_LENGTHS.NAME, "Preset name")
    if (nameError) {
      return applySecurityHeaders(NextResponse.json({ error: nameError }, { status: 400 }))
    }

    // Validate and sanitize mood if provided
    const moodError = validateOptionalString(mood, MAX_LENGTHS.MOOD, "Mood")
    if (moodError) {
      return applySecurityHeaders(NextResponse.json({ error: moodError }, { status: 400 }))
    }

    // Validate genre array if provided
    let sanitizedGenre: string[] = []
    if (genre !== undefined) {
      const genreResult = validateStringArray(genre, MAX_LENGTHS.GENRE, 10, "Genre")
      if (!genreResult) {
        return applySecurityHeaders(NextResponse.json({ error: "Invalid genre format" }, { status: 400 }))
      }
      sanitizedGenre = genreResult
    }

    // Validate instruments array if provided
    let sanitizedInstruments: string[] = []
    if (instruments !== undefined) {
      const instResult = validateStringArray(instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments")
      if (!instResult) {
        return applySecurityHeaders(NextResponse.json({ error: "Invalid instruments format" }, { status: 400 }))
      }
      sanitizedInstruments = instResult
    }

    // Validate isInstrumental if provided
    if (isInstrumental !== undefined) {
      const validatedInstrumental = validateBoolean(isInstrumental, "isInstrumental")
      if (validatedInstrumental === null) {
        return applySecurityHeaders(NextResponse.json({ error: "isInstrumental must be a boolean" }, { status: 400 }))
      }
    }

    // Validate duration if provided
    const validatedDuration = duration !== undefined ? validateNumber(duration, 10, 600, "Duration") : null
    if (duration !== undefined && validatedDuration === null) {
      return applySecurityHeaders(NextResponse.json({ error: "Duration must be between 10 and 600 seconds" }, { status: 400 }))
    }

    // Validate shareWith if provided
    if (shareWith !== undefined && typeof shareWith !== "boolean") {
      return applySecurityHeaders(NextResponse.json({ error: "shareWith must be a boolean" }, { status: 400 }))
    }

    // Check preset limit
    const userPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
    if (userPresets.length >= MAX_PRESETS_PER_USER) {
      return applySecurityHeaders(NextResponse.json(
        { error: `Maximum of ${MAX_PRESETS_PER_USER} presets reached`, code: "PRESET_LIMIT_REACHED" },
        { status: 400 }
      ))
    }

    const presetId = crypto.randomUUID()
    const shareToken = shareWith ? crypto.randomBytes(24).toString('base64') : undefined
    const now = new Date().toISOString()

    const preset: Preset = {
      id: presetId,
      userId: user.id,
      name: sanitizeString(name),
      genre: sanitizedGenre.length > 0 ? sanitizedGenre : [],
      mood: mood ? sanitizeString(mood) : '',
      instruments: sanitizedInstruments.length > 0 ? sanitizedInstruments : [],
      isInstrumental: isInstrumental === true || isInstrumental === "true",
      duration: validatedDuration || 60,
      shareToken,
      createdAt: now,
      updatedAt: now,
    }

    presets.set(presetId, preset)

    return applySecurityHeaders(NextResponse.json({ preset }, { status: 201 }))
  } catch (error) {
    console.error("Error creating preset:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to create preset" }, { status: 500 }))
  }
}

// Sync presets - merge local and server presets
export async function PUT(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { localPresets } = body

    if (!Array.isArray(localPresets)) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid request body" }, { status: 400 }))
    }

    // Get existing server presets for this user
    const serverPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
    const serverPresetIds = new Set(serverPresets.map(p => p.id))

    // Import local presets that don't exist on server
    const now = new Date().toISOString()
    let importedCount = 0

    for (const localPreset of localPresets) {
      if (!serverPresetIds.has(localPreset.id)) {
        // Check limit
        const currentCount = Array.from(presets.values()).filter(p => p.userId === user.id).length
        if (currentCount >= MAX_PRESETS_PER_USER) break

        // Validate and sanitize imported preset fields
        const nameError = validateRequiredString(localPreset.name, MAX_LENGTHS.NAME, "Preset name")
        if (nameError) continue // Skip invalid presets

        const idError = validateUUID(localPreset.id, "Preset ID")
        if (idError) continue // Skip invalid IDs

        const sanitizedGenre = validateStringArray(localPreset.genre, MAX_LENGTHS.GENRE, 10, "Genre") || []
        const sanitizedInstruments = validateStringArray(localPreset.instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments") || []
        const sanitizedMood = localPreset.mood ? sanitizeString(localPreset.mood) : ''
        const validatedDuration = localPreset.duration ? validateNumber(localPreset.duration, 10, 600, "Duration") : 60

        const preset: Preset = {
          id: localPreset.id,
          userId: user.id,
          name: sanitizeString(localPreset.name),
          genre: sanitizedGenre,
          mood: sanitizedMood,
          instruments: sanitizedInstruments,
          isInstrumental: localPreset.isInstrumental === true || localPreset.isInstrumental === "true",
          duration: validatedDuration || 60,
          shareToken: localPreset.shareToken ? sanitizeString(localPreset.shareToken) : undefined,
          createdAt: localPreset.createdAt || now,
          updatedAt: now,
        }
        presets.set(preset.id, preset)
        importedCount++
      }
    }

    // Get final list of all user presets
    const allUserPresets = Array.from(presets.values()).filter(p => p.userId === user.id)

    return applySecurityHeaders(NextResponse.json({
      presets: allUserPresets,
      imported: importedCount,
    }))
  } catch (error) {
    console.error("Error syncing presets:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to sync presets" }, { status: 500 }))
  }
}
