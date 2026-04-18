import { NextRequest, NextResponse } from "next/server"
import type { Preset } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { sanitizeString, validateOptionalString, validateStringArray, validateNumber, validateBoolean, MAX_LENGTHS, applySecurityHeaders } from "@/lib/security"


const presets = global.presets!

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = getSessionUser(request)

  // Check for share token in query parameter
  const shareToken = request.nextUrl.searchParams.get('shareToken')

  // If no share token provided, require authentication
  if (!user) {
    if (shareToken) {
      // Allow access via share token without authentication
      const preset = Array.from(presets.values()).find(p => p.id === id && p.shareToken === shareToken)
      if (!preset) {
        return applySecurityHeaders(NextResponse.json({ error: "Preset not found or invalid share token" }, { status: 404 }))
      }
      // Return preset without userId for shared access
      const { userId: _userId, ...sharedPreset } = preset
      return applySecurityHeaders(NextResponse.json({ preset: sharedPreset }))
    }
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const preset = presets.get(id)
  if (!preset) {
    return applySecurityHeaders(NextResponse.json({ error: "Preset not found" }, { status: 404 }))
  }

  // Allow access to own presets or presets with valid share token
  if (preset.userId !== user.id && preset.shareToken !== shareToken) {
    return applySecurityHeaders(NextResponse.json({ error: "Access denied" }, { status: 403 }))
  }

  return applySecurityHeaders(NextResponse.json({ preset }))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const preset = presets.get(id)
  if (!preset) {
    return applySecurityHeaders(NextResponse.json({ error: "Preset not found" }, { status: 404 }))
  }

  if (preset.userId !== user.id) {
    return applySecurityHeaders(NextResponse.json({ error: "Access denied" }, { status: 403 }))
  }

  try {
    const body = await request.json()
    const { name, genre, mood, instruments, isInstrumental, duration } = body

    // Validate and sanitize name if provided
    if (name !== undefined) {
      const nameError = validateOptionalString(name, MAX_LENGTHS.NAME, "Preset name")
      if (nameError) {
        return applySecurityHeaders(NextResponse.json({ error: nameError }, { status: 400 }))
      }
    }

    // Validate and sanitize mood if provided
    if (mood !== undefined) {
      const moodError = validateOptionalString(mood, MAX_LENGTHS.MOOD, "Mood")
      if (moodError) {
        return applySecurityHeaders(NextResponse.json({ error: moodError }, { status: 400 }))
      }
    }

    // Validate genre array if provided
    let validatedGenre: string[] | undefined
    if (genre !== undefined) {
      const genreResult = validateStringArray(genre, MAX_LENGTHS.GENRE, 10, "Genre")
      if (!genreResult || genreResult.length === 0) {
        return applySecurityHeaders(NextResponse.json({ error: "Invalid genre format" }, { status: 400 }))
      }
      validatedGenre = genreResult
    }

    // Validate instruments array if provided
    let validatedInstruments: string[] | undefined
    if (instruments !== undefined) {
      const instResult = validateStringArray(instruments, MAX_LENGTHS.INSTRUMENT, 20, "Instruments")
      if (!instResult || instResult.length === 0) {
        return applySecurityHeaders(NextResponse.json({ error: "Invalid instruments format" }, { status: 400 }))
      }
      validatedInstruments = instResult
    }

    // Validate isInstrumental if provided
    if (isInstrumental !== undefined) {
      const validatedInstrumental = validateBoolean(isInstrumental, "isInstrumental")
      if (validatedInstrumental === null) {
        return applySecurityHeaders(NextResponse.json({ error: "isInstrumental must be a boolean" }, { status: 400 }))
      }
    }

    // Validate duration if provided
    let validatedDuration: number | null = null
    if (duration !== undefined) {
      validatedDuration = validateNumber(duration, 10, 600, "Duration")
      if (validatedDuration === null) {
        return applySecurityHeaders(NextResponse.json({ error: "Duration must be between 10 and 600 seconds" }, { status: 400 }))
      }
    }

    const updatedPreset: Preset = {
      ...preset,
      name: name !== undefined ? sanitizeString(name) : preset.name,
      genre: validatedGenre !== undefined ? validatedGenre : preset.genre,
      mood: mood !== undefined ? sanitizeString(mood) : preset.mood,
      instruments: validatedInstruments !== undefined ? validatedInstruments : preset.instruments,
      isInstrumental: isInstrumental !== undefined ? (isInstrumental === true || isInstrumental === "true") : preset.isInstrumental,
      duration: validatedDuration !== null ? validatedDuration : preset.duration,
      updatedAt: new Date().toISOString(),
    }

    presets.set(id, updatedPreset)

    return applySecurityHeaders(NextResponse.json({ preset: updatedPreset }))
  } catch (error) {
    console.error("Error updating preset:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to update preset" }, { status: 500 }))
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const preset = presets.get(id)
  if (!preset) {
    return applySecurityHeaders(NextResponse.json({ error: "Preset not found" }, { status: 404 }))
  }

  if (preset.userId !== user.id) {
    return applySecurityHeaders(NextResponse.json({ error: "Access denied" }, { status: 403 }))
  }

  presets.delete(id)

  return applySecurityHeaders(NextResponse.json({ success: true }))
}
