import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"


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

interface AdminSong {
  id: string
  userId: string
  title: string
  status: string
  createdAt: string
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users
const songs = global.songs as Map<string, AdminSong>
const adminLogs = global.adminLogs

function getSessionUser(request: NextRequest): SessionUser | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null

  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role as UserRole,
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

// GET /api/admin/users/[id] - Get user detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  const { id } = await params

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const targetUser = users.get(id)
  if (!targetUser) {
    return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
  }

  // Get user's songs
  const userSongs = Array.from(songs.values()).filter(s => s.userId === id)

  return NextResponse.json({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      isActive: targetUser.isActive,
      tier: targetUser.tier,
      dailyUsage: targetUser.dailyUsage,
      monthlyUsage: targetUser.monthlyUsage,
      createdAt: targetUser.createdAt,
    },
    songs: userSongs,
  })
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionUser(request)
  const { id } = await params

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  if (user.id === id) {
    return applySecurityHeaders(NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 }))
  }

  const targetUser = users.get(id)
  if (!targetUser) {
    return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
  }

  // Delete user's songs
  const userSongs = Array.from(songs.values()).filter(s => s.userId === id)
  userSongs.forEach(s => songs.delete(s.id))

  // Delete user
  users.delete(id)

  logAdminAction(user.id, user.email, 'DELETE_USER', id, 'USER', { deletedEmail: targetUser.email })

  return NextResponse.json({ success: true })
}
