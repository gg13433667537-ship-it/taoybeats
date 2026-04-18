import { NextRequest, NextResponse } from "next/server"
import type { Preset } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

declare global {
  var presets: Map<string, Preset> | undefined
}

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

// Import a preset by share token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find preset by share token
  const sharedPreset = Array.from(presets.values()).find(p => p.shareToken === shareToken)
  if (!sharedPreset) {
    return NextResponse.json({ error: "Shared preset not found" }, { status: 404 })
  }

  // Can't import own preset
  if (sharedPreset.userId === user.id) {
    return NextResponse.json({ error: "Cannot import your own preset" }, { status: 400 })
  }

  // Check preset limit
  const userPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
  if (userPresets.length >= 10) {
    return NextResponse.json(
      { error: "Maximum of 10 presets reached. Please delete some presets first." },
      { status: 400 }
    )
  }

  // Create a copy for the current user
  const now = new Date().toISOString()
  const newPreset: Preset = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: sharedPreset.name,
    genre: [...sharedPreset.genre],
    mood: sharedPreset.mood,
    instruments: [...sharedPreset.instruments],
    isInstrumental: sharedPreset.isInstrumental,
    duration: sharedPreset.duration,
    shareToken: undefined, // Don't inherit share token
    createdAt: now,
    updatedAt: now,
  }

  presets.set(newPreset.id, newPreset)

  return NextResponse.json({ preset: newPreset }, { status: 201 })
}
