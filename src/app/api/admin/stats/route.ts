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
  status: string
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const adminLogs = global.adminLogs as Map<string, AdminLog>

const users = global.users
const songs = global.songs

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

// GET /api/admin/stats - Get system statistics
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const allUsers = Array.from(users.values())
  const allSongs = Array.from((songs as Map<string, AdminSong>).values())
  const allLogs = Array.from(adminLogs.values())

  // Calculate stats
  const totalUsers = allUsers.length
  const totalSongs = allSongs.length
  const activeUsers = allUsers.filter(u => u.isActive !== false).length
  const adminUsers = allUsers.filter(u => u.role === 'ADMIN').length
  const proUsers = allUsers.filter(u => u.tier === 'PRO').length

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
