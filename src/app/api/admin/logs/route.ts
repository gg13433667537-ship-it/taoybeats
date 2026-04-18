import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
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

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const adminLogs = global.adminLogs as Map<string, AdminLog>

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

// GET /api/admin/logs - Get admin action logs
export async function GET(request: NextRequest) {
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:logs:list")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const { searchParams } = new URL(request.url)
  // Validate and sanitize pagination params
  const rawPage = searchParams.get('page')
  const rawLimit = searchParams.get('limit')
  const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1
  const limit = rawLimit ? Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 50)) : 50
  const offset = (page - 1) * limit

  const allLogs = Array.from(adminLogs.values())

  // Sort by createdAt desc
  allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = allLogs.length
  const paginatedLogs = allLogs.slice(offset, offset + limit)

  return NextResponse.json({
    logs: paginatedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
