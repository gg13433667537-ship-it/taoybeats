import { NextRequest, NextResponse } from "next/server"
import type { User, UserRole } from "@/lib/types"
import { verifySessionToken, createSessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware, validateUUID } from "@/lib/security"

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
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:users:role:update")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const { id } = await params

  // Validate UUID format
  const uuidError = validateUUID(id, "User ID")
  if (uuidError) {
    return applySecurityHeaders(NextResponse.json({ error: uuidError }, { status: 400 }))
  }

  let body: { role?: string }
  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }))
  }

  const { role } = body

  if (typeof role !== 'string' || !["USER", "ADMIN"].includes(role)) {
    return applySecurityHeaders(NextResponse.json({ error: "无效的角色" }, { status: 400 }))
  }

  const targetUser = users.get(id)
  if (!targetUser) {
    return applySecurityHeaders(NextResponse.json({ error: "用户不存在" }, { status: 404 }))
  }

  targetUser.role = role
  users.set(id, targetUser)

  logAdminAction(user.id, user.email, 'UPDATE_USER_ROLE', id, 'USER', { newRole: role })

  // Update session if changing own role
  if (user.id === id || user.email === id) {
    const newToken = createSessionToken({
      ...targetUser,
      password: undefined,
    } as User)
    const response = NextResponse.json({ success: true, user: targetUser })
    response.cookies.set(
      "session-token",
      newToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    )
    return response
  }

  return applySecurityHeaders(NextResponse.json({ success: true, user: targetUser }))
}
