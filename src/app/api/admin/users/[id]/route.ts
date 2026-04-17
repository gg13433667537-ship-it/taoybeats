import { NextRequest, NextResponse } from "next/server"

declare global {
  var users: Map<string, any> | undefined
  var songs: Map<string, any> | undefined
  var adminLogs: Map<string, any> | undefined
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users
const songs = global.songs
const adminLogs = global.adminLogs

function getSessionUser(request: NextRequest): any | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null

  try {
    const payload = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
    return users.get(payload.id) || null
  } catch {
    return null
  }
}

function isAdmin(user: any): boolean {
  return user?.role === 'ADMIN'
}

function logAdminAction(adminId: string, adminEmail: string, action: string, targetId?: string, targetType?: string, details?: any) {
  const log = {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const targetUser = users.get(id)
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (user.id === id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
  }

  const targetUser = users.get(id)
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Delete user's songs
  const userSongs = Array.from(songs.values()).filter(s => s.userId === id)
  userSongs.forEach(s => songs.delete(s.id))

  // Delete user
  users.delete(id)

  logAdminAction(user.id, user.email, 'DELETE_USER', id, 'USER', { deletedEmail: targetUser.email })

  return NextResponse.json({ success: true })
}
