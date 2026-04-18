import { NextRequest, NextResponse } from "next/server"
import type { Preset } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const preset = presets.get(id)
  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 })
  }

  // Only allow access to own presets or public shared presets
  if (preset.userId !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  return NextResponse.json({ preset })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const preset = presets.get(id)
  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 })
  }

  if (preset.userId !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, genre, mood, instruments, isInstrumental, duration } = body

    const updatedPreset: Preset = {
      ...preset,
      name: name ?? preset.name,
      genre: genre ?? preset.genre,
      mood: mood ?? preset.mood,
      instruments: instruments ?? preset.instruments,
      isInstrumental: isInstrumental ?? preset.isInstrumental,
      duration: duration ?? preset.duration,
      updatedAt: new Date().toISOString(),
    }

    presets.set(id, updatedPreset)

    return NextResponse.json({ preset: updatedPreset })
  } catch (error) {
    console.error("Error updating preset:", error)
    return NextResponse.json({ error: "Failed to update preset" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const preset = presets.get(id)
  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 })
  }

  if (preset.userId !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  presets.delete(id)

  return NextResponse.json({ success: true })
}
