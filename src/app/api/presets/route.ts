import { NextRequest, NextResponse } from "next/server"
import type { Preset } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all presets for this user
  const userPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
  return NextResponse.json({ presets: userPresets })
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, genre, mood, instruments, isInstrumental, duration, shareWith } = body

    if (!name) {
      return NextResponse.json({ error: "Preset name is required" }, { status: 400 })
    }

    // Check preset limit
    const userPresets = Array.from(presets.values()).filter(p => p.userId === user.id)
    if (userPresets.length >= MAX_PRESETS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PRESETS_PER_USER} presets reached`, code: "PRESET_LIMIT_REACHED" },
        { status: 400 }
      )
    }

    const presetId = crypto.randomUUID()
    const shareToken = shareWith ? crypto.randomUUID().slice(0, 8) : undefined
    const now = new Date().toISOString()

    const preset: Preset = {
      id: presetId,
      userId: user.id,
      name,
      genre: genre || [],
      mood: mood || '',
      instruments: instruments || [],
      isInstrumental: isInstrumental || false,
      duration: duration || 60,
      shareToken,
      createdAt: now,
      updatedAt: now,
    }

    presets.set(presetId, preset)

    return NextResponse.json({ preset }, { status: 201 })
  } catch (error) {
    console.error("Error creating preset:", error)
    return NextResponse.json({ error: "Failed to create preset" }, { status: 500 })
  }
}

// Sync presets - merge local and server presets
export async function PUT(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { localPresets } = body

    if (!Array.isArray(localPresets)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
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

        const preset: Preset = {
          id: localPreset.id,
          userId: user.id,
          name: localPreset.name,
          genre: localPreset.genre || [],
          mood: localPreset.mood || '',
          instruments: localPreset.instruments || [],
          isInstrumental: localPreset.isInstrumental || false,
          duration: localPreset.duration || 60,
          shareToken: localPreset.shareToken,
          createdAt: localPreset.createdAt || now,
          updatedAt: now,
        }
        presets.set(preset.id, preset)
        importedCount++
      }
    }

    // Get final list of all user presets
    const allUserPresets = Array.from(presets.values()).filter(p => p.userId === user.id)

    return NextResponse.json({
      presets: allUserPresets,
      imported: importedCount,
    })
  } catch (error) {
    console.error("Error syncing presets:", error)
    return NextResponse.json({ error: "Failed to sync presets" }, { status: 500 })
  }
}
