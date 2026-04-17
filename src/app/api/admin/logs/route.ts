import { NextRequest, NextResponse } from "next/server"

declare global {
  var users: Map<string, any> | undefined
  var songs: Map<string, any> | undefined
  var adminLogs: Map<string, any> | undefined
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const adminLogs = global.adminLogs

function getSessionUser(request: NextRequest): any | null {
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

function isAdmin(user: any): boolean {
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

  let allLogs = Array.from(adminLogs.values())

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
