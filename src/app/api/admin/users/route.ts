import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders } from "@/lib/security"

// In-memory user storage (shared with other routes for demo)

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

const users = global.users
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

// GET /api/admin/users - List users with pagination
export async function GET(request: NextRequest) {
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const offset = (page - 1) * limit

  let allUsers = Array.from(users.values())

  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase()
    allUsers = allUsers.filter(u =>
      u.email?.toLowerCase().includes(searchLower) ||
      u.name?.toLowerCase().includes(searchLower)
    )
  }

  const total = allUsers.length
  const paginatedUsers = allUsers.slice(offset, offset + limit).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    tier: u.tier,
    dailyUsage: u.dailyUsage,
    monthlyUsage: u.monthlyUsage,
    createdAt: u.createdAt,
  }))

  return NextResponse.json({
    users: paginatedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// PATCH /api/admin/users - Update user role/status
export async function PATCH(request: NextRequest) {
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  try {
    const body = await request.json()
    const { userId, role, isActive, tier } = body

    if (!userId) {
      return applySecurityHeaders(NextResponse.json({ error: "userId required" }, { status: 400 }))
    }

    const targetUser = users.get(userId)
    if (!targetUser) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (isActive !== undefined) updates.isActive = isActive
    if (tier !== undefined) updates.tier = tier

    Object.assign(targetUser, updates)

    logAdminAction(user.id, user.email, 'UPDATE_USER', userId, 'USER', updates)

    return NextResponse.json({ success: true, user: targetUser })
  } catch (error) {
    console.error("Admin update user error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to update user" }, { status: 500 }))
  }
}
