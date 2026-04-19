import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"


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

function getStartOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function getStartOfMonth(): Date {
  const date = getStartOfToday()
  date.setDate(1)
  return date
}

// GET /api/admin/stats - Get system statistics
export async function GET(request: NextRequest) {
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:stats")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  try {
    const startOfToday = getStartOfToday()
    const startOfMonth = getStartOfMonth()

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      proUsers,
      usageUsers,
      totalSongs,
      pendingSongs,
      generatingSongs,
      completedSongs,
      failedSongs,
      successfulToday,
      successfulThisMonth,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { tier: 'PRO' } }),
      prisma.user.findMany({
        select: {
          dailyUsage: true,
          monthlyUsage: true,
        },
      }),
      prisma.song.count(),
      prisma.song.count({ where: { status: 'PENDING' } }),
      prisma.song.count({ where: { status: 'GENERATING' } }),
      prisma.song.count({ where: { status: 'COMPLETED' } }),
      prisma.song.count({ where: { status: 'FAILED' } }),
      prisma.song.count({ where: { status: 'COMPLETED', createdAt: { gte: startOfToday } } }),
      prisma.song.count({ where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } } }),
      prisma.adminLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const totalDailyUsage = usageUsers.reduce((sum, current) => sum + (current.dailyUsage || 0), 0)
    const totalMonthlyUsage = usageUsers.reduce((sum, current) => sum + (current.monthlyUsage || 0), 0)

    return applySecurityHeaders(NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
        pro: proUsers,
      },
      songs: {
        total: totalSongs,
        byStatus: {
          PENDING: pendingSongs,
          GENERATING: generatingSongs,
          COMPLETED: completedSongs,
          FAILED: failedSongs,
        },
        successfulToday,
        successfulThisMonth,
      },
      usage: {
        daily: totalDailyUsage,
        monthly: totalMonthlyUsage,
      },
      logs: recentLogs,
    }))
  } catch (error) {
    console.error("Admin stats error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to retrieve admin stats" }, { status: 500 }))
  }
}
