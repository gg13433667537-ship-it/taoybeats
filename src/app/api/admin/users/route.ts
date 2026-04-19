import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"
import { sanitizeString, validateEnum } from "@/lib/security"
import { prisma } from "@/lib/db"

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
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:users:list")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    // Validate pagination params
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1
    const limit = rawLimit ? Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20)) : 20
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
  } catch (error) {
    console.error("Admin list users error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to retrieve users" }, { status: 500 }))
  }
}

// PATCH /api/admin/users - Update user role/status
export async function PATCH(request: NextRequest) {
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:users:update")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  try {
    const body = await request.json()
    const { userId, role, isActive, tier, addCredits, resetDailyUsage, resetMonthlyUsage } = body

    // Validate userId format
    if (!userId) {
      return applySecurityHeaders(NextResponse.json({ error: "userId is required" }, { status: 400 }))
    }
    // userId should be UUID or string identifier, just sanitize it
    const sanitizedUserId = sanitizeString(String(userId))
    if (sanitizedUserId.length === 0) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid userId" }, { status: 400 }))
    }

    // Validate role enum if provided
    if (role !== undefined) {
      const roleError = validateEnum(role, ["USER", "PRO", "ADMIN"], "Role")
      if (roleError) {
        return applySecurityHeaders(NextResponse.json({ error: roleError }, { status: 400 }))
      }
    }

    // Validate tier enum if provided
    if (tier !== undefined) {
      const tierError = validateEnum(tier, ["FREE", "PRO"], "Tier")
      if (tierError) {
        return applySecurityHeaders(NextResponse.json({ error: tierError }, { status: 400 }))
      }
    }

    // Validate isActive boolean if provided
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return applySecurityHeaders(NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 }))
    }

    // Validate addCredits if provided
    if (addCredits !== undefined && (typeof addCredits !== "number" || addCredits < 0 || !Number.isInteger(addCredits))) {
      return applySecurityHeaders(NextResponse.json({ error: "addCredits must be a non-negative integer" }, { status: 400 }))
    }

    // Validate reset flags
    if (resetDailyUsage !== undefined && typeof resetDailyUsage !== "boolean") {
      return applySecurityHeaders(NextResponse.json({ error: "resetDailyUsage must be a boolean" }, { status: 400 }))
    }
    if (resetMonthlyUsage !== undefined && typeof resetMonthlyUsage !== "boolean") {
      return applySecurityHeaders(NextResponse.json({ error: "resetMonthlyUsage must be a boolean" }, { status: 400 }))
    }

    const targetUser = users.get(sanitizedUserId)
    if (!targetUser) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (isActive !== undefined) updates.isActive = isActive
    if (tier !== undefined) updates.tier = tier

    // Handle credits management
    if (typeof addCredits === "number" && addCredits > 0) {
      // Add credits to monthly usage (negative values reduce usage)
      targetUser.monthlyUsage = Math.max(0, targetUser.monthlyUsage - addCredits)
      updates.addedCredits = addCredits
    }

    if (resetDailyUsage) {
      targetUser.dailyUsage = 0
      updates.resetDailyUsage = true
    }

    if (resetMonthlyUsage) {
      targetUser.monthlyUsage = 0
      updates.resetMonthlyUsage = true
    }

    Object.assign(targetUser, updates)

    // Persist tier changes to Prisma database (for usage API which reads from DB)
    if (tier !== undefined) {
      try {
        await prisma.user.update({
          where: { id: sanitizedUserId },
          data: { tier },
        })
      } catch (prismaError) {
        console.error("Failed to update tier in Prisma:", prismaError)
        // Continue anyway - in-memory update is still valid
      }
    }

    logAdminAction(user.id, user.email, 'UPDATE_USER', sanitizedUserId, 'USER', updates)

    return NextResponse.json({ success: true, user: targetUser })
  } catch (error) {
    console.error("Admin update user error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to update user" }, { status: 500 }))
  }
}
