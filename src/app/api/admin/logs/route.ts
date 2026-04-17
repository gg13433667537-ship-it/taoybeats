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

const adminLogs = global.adminLogs as Map<string, AdminLog>

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

// GET /api/admin/logs - Get admin action logs
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
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
