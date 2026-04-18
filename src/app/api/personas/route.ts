import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, DEFAULT_RATE_LIMIT, rateLimitMiddleware, sanitizeString, validateLength, validateOptionalString } from "@/lib/security"

export interface Persona {
  id: string
  name: string
  description?: string
  // Voice settings
  voiceId?: string
  voiceName?: string
  // Reference settings
  referenceSinger?: string
  referenceSong?: string
  // Audio settings
  referenceAudio?: string
  // Vocal characteristics
  vocalTone?: string
  vocalStyle?: string
  // Created
  createdAt: string
  updatedAt: string
}

// In-memory persona storage (would be database in production)
const personaStore = new Map<string, Persona[]>()

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

// Validate persona ID format (UUID v4)
function isValidPersonaId(id: unknown): id is string {
  if (typeof id !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// Validate persona input fields
interface PersonaInput {
  name: string
  description?: string
  voiceId?: string
  voiceName?: string
  referenceSinger?: string
  referenceSong?: string
  referenceAudio?: string
  vocalTone?: string
  vocalStyle?: string
}

function validatePersonaInput(body: unknown): { valid: true; data: PersonaInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: "Invalid request body" }
  }

  const b = body as Record<string, unknown>

  // Validate required name field
  const nameError = validateLength(b.name, 100, "Persona name")
  if (nameError) {
    return { valid: false, error: nameError }
  }

  // Sanitize and validate all string fields
  const data: PersonaInput = {
    name: sanitizeString(b.name),
  }

  // Validate optional fields with length limits
  if (b.description !== undefined) {
    const descError = validateOptionalString(b.description, 1000, "Description")
    if (descError) return { valid: false, error: descError }
    data.description = sanitizeString(b.description)
  }

  if (b.voiceId !== undefined) {
    const voiceIdError = validateOptionalString(b.voiceId, 100, "Voice ID")
    if (voiceIdError) return { valid: false, error: voiceIdError }
    data.voiceId = sanitizeString(b.voiceId)
  }

  if (b.voiceName !== undefined) {
    const voiceNameError = validateOptionalString(b.voiceName, 100, "Voice name")
    if (voiceNameError) return { valid: false, error: voiceNameError }
    data.voiceName = sanitizeString(b.voiceName)
  }

  if (b.referenceSinger !== undefined) {
    const refSingerError = validateOptionalString(b.referenceSinger, 100, "Reference singer")
    if (refSingerError) return { valid: false, error: refSingerError }
    data.referenceSinger = sanitizeString(b.referenceSinger)
  }

  if (b.referenceSong !== undefined) {
    const refSongError = validateOptionalString(b.referenceSong, 200, "Reference song")
    if (refSongError) return { valid: false, error: refSongError }
    data.referenceSong = sanitizeString(b.referenceSong)
  }

  if (b.referenceAudio !== undefined) {
    const refAudioError = validateOptionalString(b.referenceAudio, 500, "Reference audio URL")
    if (refAudioError) return { valid: false, error: refAudioError }
    data.referenceAudio = sanitizeString(b.referenceAudio)
  }

  if (b.vocalTone !== undefined) {
    const vocalToneError = validateOptionalString(b.vocalTone, 50, "Vocal tone")
    if (vocalToneError) return { valid: false, error: vocalToneError }
    data.vocalTone = sanitizeString(b.vocalTone)
  }

  if (b.vocalStyle !== undefined) {
    const vocalStyleError = validateOptionalString(b.vocalStyle, 50, "Vocal style")
    if (vocalStyleError) return { valid: false, error: vocalStyleError }
    data.vocalStyle = sanitizeString(b.vocalStyle)
  }

  return { valid: true, data }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "personas")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const personas = personaStore.get(user.id) || []
  return applySecurityHeaders(NextResponse.json({ personas }))
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "personas")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const validation = validatePersonaInput(body)

    if (!validation.valid) {
      return applySecurityHeaders(NextResponse.json({ error: validation.error }, { status: 400 }))
    }

    const persona: Persona = {
      id: crypto.randomUUID(),
      name: validation.data.name,
      description: validation.data.description,
      voiceId: validation.data.voiceId,
      voiceName: validation.data.voiceName,
      referenceSinger: validation.data.referenceSinger,
      referenceSong: validation.data.referenceSong,
      referenceAudio: validation.data.referenceAudio,
      vocalTone: validation.data.vocalTone,
      vocalStyle: validation.data.vocalStyle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const existingPersonas = personaStore.get(user.id) || []
    personaStore.set(user.id, [...existingPersonas, persona])

    return applySecurityHeaders(NextResponse.json({ persona }))
  } catch (error) {
    console.error("Create persona error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to create persona" }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "personas")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    const personaId = searchParams.get('id')

    if (!personaId) {
      return applySecurityHeaders(NextResponse.json({ error: "Persona ID is required" }, { status: 400 }))
    }

    // Validate persona ID format to prevent injection
    if (!isValidPersonaId(personaId)) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid Persona ID format" }, { status: 400 }))
    }

    const existingPersonas = personaStore.get(user.id) || []
    const filteredPersonas = existingPersonas.filter(p => p.id !== personaId)

    // Check if persona actually existed and was deleted
    if (filteredPersonas.length === existingPersonas.length) {
      return applySecurityHeaders(NextResponse.json({ error: "Persona not found" }, { status: 404 }))
    }

    personaStore.set(user.id, filteredPersonas)

    return applySecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error("Delete persona error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to delete persona" }, { status: 500 }))
  }
}
