import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"

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

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const personas = personaStore.get(user.id) || []
  return NextResponse.json({ personas })
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      description,
      voiceId,
      voiceName,
      referenceSinger,
      referenceSong,
      referenceAudio,
      vocalTone,
      vocalStyle,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Persona name is required" }, { status: 400 })
    }

    const persona: Persona = {
      id: crypto.randomUUID(),
      name,
      description,
      voiceId,
      voiceName,
      referenceSinger,
      referenceSong,
      referenceAudio,
      vocalTone,
      vocalStyle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const existingPersonas = personaStore.get(user.id) || []
    personaStore.set(user.id, [...existingPersonas, persona])

    return NextResponse.json({ persona })
  } catch (error) {
    console.error("Create persona error:", error)
    return NextResponse.json({ error: "Failed to create persona" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const personaId = searchParams.get('id')

    if (!personaId) {
      return NextResponse.json({ error: "Persona ID is required" }, { status: 400 })
    }

    const existingPersonas = personaStore.get(user.id) || []
    const filteredPersonas = existingPersonas.filter(p => p.id !== personaId)
    personaStore.set(user.id, filteredPersonas)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete persona error:", error)
    return NextResponse.json({ error: "Failed to delete persona" }, { status: 500 })
  }
}
