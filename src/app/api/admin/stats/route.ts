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
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

function isAdmin(user: any): boolean {
  return user?.role === 'ADMIN'
}

// GET /api/admin/stats - Get system statistics
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const allUsers = Array.from(users.values())
  const allSongs = Array.from(songs.values())
  const allLogs = Array.from(adminLogs.values())

  // Calculate stats
  const totalUsers = allUsers.length
  const totalSongs = allSongs.length
  const activeUsers = allUsers.filter(u => u.isActive !== false).length
  const adminUsers = allUsers.filter(u => u.role === 'ADMIN').length
  const proUsers = allUsers.filter(u => u.role === 'PRO').length

  // Songs by status
  const songsByStatus = {
    PENDING: allSongs.filter(s => s.status === 'PENDING').length,
    GENERATING: allSongs.filter(s => s.status === 'GENERATING').length,
    COMPLETED: allSongs.filter(s => s.status === 'COMPLETED').length,
    FAILED: allSongs.filter(s => s.status === 'FAILED').length,
  }

  // Recent logs (last 20)
  const recentLogs = allLogs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  // Daily/Monthly usage totals
  const totalDailyUsage = allUsers.reduce((sum, u) => sum + (u.dailyUsage || 0), 0)
  const totalMonthlyUsage = allUsers.reduce((sum, u) => sum + (u.monthlyUsage || 0), 0)

  return NextResponse.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      admins: adminUsers,
      pro: proUsers,
    },
    songs: {
      total: totalSongs,
      byStatus: songsByStatus,
    },
    usage: {
      daily: totalDailyUsage,
      monthly: totalMonthlyUsage,
    },
    logs: recentLogs,
  })
}
