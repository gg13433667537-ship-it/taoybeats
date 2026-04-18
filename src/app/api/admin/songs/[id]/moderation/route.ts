import { NextRequest, NextResponse } from "next/server"
import type { Song, ModerationStatus, UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
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
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:songs:moderation")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const { id } = await params

  // Validate UUID format
  const uuidError = validateUUID(id, "Song ID")
  if (uuidError) {
    return applySecurityHeaders(NextResponse.json({ error: uuidError }, { status: 400 }))
  }

  let body: { status?: ModerationStatus }
  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }))
  }

  const { status } = body

  if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Invalid moderation status. Must be PENDING, APPROVED, or REJECTED' },
      { status: 400 }
    ))
  }

  const songsMap = global.songs as Map<string, Song> | undefined
  if (!songsMap) {
    return applySecurityHeaders(NextResponse.json({ error: "Songs not found" }, { status: 404 }))
  }

  const song = songsMap.get(id)
  if (!song) {
    return applySecurityHeaders(NextResponse.json({ error: "Song not found" }, { status: 404 }))
  }

  // Update moderation status
  const updatedSong = { ...song, moderationStatus: status }
  songsMap.set(id, updatedSong)

  // Log admin action
  logAdminAction(user.id, user.email, 'MODERATION_UPDATE', id, 'SONG', { newStatus: status })

  return applySecurityHeaders(NextResponse.json(updatedSong))
}
