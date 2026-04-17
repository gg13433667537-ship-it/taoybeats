import { NextRequest, NextResponse } from "next/server"
import type { User, UserRole } from "@/lib/types"

declare global {
  var users: Map<string, User> | undefined
  var songs: Map<string, unknown> | undefined
  var adminLogs: Map<string, unknown> | undefined
}

interface SessionUser {
  id: string
  email: string
  role: UserRole
}

interface AdminLog {
  id: string
  adminId: string
  adminEmail: string
  action: string
  targetId?: string
  targetType?: string
  details?: Record<string, unknown>
  createdAt: string
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const songs = global.songs
const adminLogs = global.adminLogs

function getSessionUser(request: NextRequest): SessionUser | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null

  try {
    const payload = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'ADMIN'
}

function logAdminAction(adminId: string, adminEmail: string, action: string, targetId?: string, targetType?: string, details?: Record<string, unknown>) {
  const log: AdminLog = {
    id: crypto.randomUUID(),
    adminId,
    adminEmail,
    action,
    targetId,
    targetType,
    details,
    createdAt: new Date().toISOString(),
  }
  adminLogs.set(log.id, log)
}

// DELETE /api/admin/songs/[id] - Delete song
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  const { id } = await params

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const song = songs.get(id) as { title?: string } | undefined
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  songs.delete(id)

  logAdminAction(user.id, user.email, 'DELETE_SONG', id, 'SONG', { title: song.title })

  return NextResponse.json({ success: true })
}
