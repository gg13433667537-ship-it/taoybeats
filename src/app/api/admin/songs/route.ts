import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"


interface SessionUser {
  id: string
  email: string
  role: UserRole
}

interface AdminSong {
  id: string
  userId: string
  title: string
  status: string
  createdAt: string
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const songs = global.songs as Map<string, AdminSong>

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

// GET /api/admin/songs - List all songs
export async function GET(request: NextRequest) {
  // Rate limiting for admin endpoint
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:songs:list")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  const { searchParams } = new URL(request.url)
  // Validate pagination params
  const rawPage = searchParams.get('page')
  const rawLimit = searchParams.get('limit')
  const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1
  const limit = rawLimit ? Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20)) : 20
  const status = searchParams.get('status')
  const offset = (page - 1) * limit

  let allSongs = Array.from(songs.values())

  // Filter by status
  if (status) {
    allSongs = allSongs.filter(s => s.status === status)
  }

  // Sort by createdAt desc
  allSongs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = allSongs.length
  const paginatedSongs = allSongs.slice(offset, offset + limit).map(s => {
    const songUser = global.users?.get(s.userId)
    return {
      ...s,
      userEmail: songUser?.email,
      userName: songUser?.name,
    }
  })

  return applySecurityHeaders(NextResponse.json({
    songs: paginatedSongs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }))
}
