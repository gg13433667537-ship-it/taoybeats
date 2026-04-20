import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware, validateCSRFDoubleSubmit } from "@/lib/security"
import { sanitizeString, validateEnum } from "@/lib/security"
import { prisma } from "@/lib/db"
import { ensureCurrentAdminVisible } from "./visibility"

interface SessionUser {
  id: string
  email: string
  role: UserRole
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

function normalizeAdminUser<T extends { email: string | null }>(user: T): Omit<T, "email"> & { email: string } {
  return {
    ...user,
    email: user.email ?? "",
  }
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

    // Build where clause for search
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}

    // Fetch users from Prisma with pagination
    const [allUsers, total, currentAdmin] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          tier: true,
          dailyUsage: true,
          monthlyUsage: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
      page === 1
        ? prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              tier: true,
              dailyUsage: true,
              monthlyUsage: true,
              createdAt: true,
            },
          })
        : Promise.resolve(null),
    ])

    const normalizedUsers = allUsers.map((listedUser) => normalizeAdminUser(listedUser))
    const normalizedCurrentAdmin = currentAdmin ? normalizeAdminUser(currentAdmin) : null

    return NextResponse.json({
      users: ensureCurrentAdminVisible({
        users: normalizedUsers,
        currentUser: normalizedCurrentAdmin,
        page,
        limit,
        search,
      }),
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

// PATCH /api/admin/users - Update user role/status/tier/credits
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

  // Validate CSRF token (Double Submit Cookie pattern)
  if (!validateCSRFDoubleSubmit(request)) {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }))
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

    // Check if user exists in Prisma
    const targetUser = await prisma.user.findUnique({
      where: { id: sanitizedUserId },
    })

    if (!targetUser) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    // Build update data for Prisma
    const updateData: Record<string, unknown> = {}

    if (role !== undefined) {
      // Map role string to Role enum
      updateData.role = role
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (tier !== undefined) updateData.tier = tier

    // Handle credits - add to monthlyUsage (credits spent)
    // addCredits reduces the usage counter (giving user more generations available)
    if (typeof addCredits === "number" && addCredits > 0) {
      // Subtract from monthlyUsage to give user more available generations
      const newMonthlyUsage = Math.max(0, targetUser.monthlyUsage - addCredits)
      updateData.monthlyUsage = newMonthlyUsage
    }

    if (resetDailyUsage) {
      updateData.dailyUsage = 0
    }

    if (resetMonthlyUsage) {
      updateData.monthlyUsage = 0
    }

    // Update user in Prisma
    const updatedUser = await prisma.user.update({
      where: { id: sanitizedUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        tier: true,
        dailyUsage: true,
        monthlyUsage: true,
        createdAt: true,
      },
    })

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: user.id,
        adminEmail: user.email,
        action: 'UPDATE_USER',
        targetId: sanitizedUserId,
        targetType: 'USER',
        details: JSON.parse(JSON.stringify(updateData)),
      },
    })

    console.log(`[ADMIN PATCH] Updated user ${sanitizedUserId} tier to ${updatedUser.tier}`)
    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error("Admin update user error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to update user" }, { status: 500 }))
  }
}
