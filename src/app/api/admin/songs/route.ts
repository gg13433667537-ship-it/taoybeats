import { NextRequest, NextResponse } from "next/server"
import type { User, UserRole } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"

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
  const user = getSessionUser(request)

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
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

  return NextResponse.json({
    songs: paginatedSongs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
