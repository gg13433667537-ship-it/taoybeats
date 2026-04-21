/**
 * GET /api/admin/users/[id]/songs
 * @description 管理员查看特定用户的歌曲列表
 */
import { NextRequest, NextResponse } from "next/server"
import { verifySessionTokenWithDB } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { applySecurityHeaders, STRICT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"

async function getSessionUser(request: NextRequest) {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    return await verifySessionTokenWithDB(sessionToken)
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, ":admin:users:songs")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  const session = await getSessionUser(request)
  if (!session || session.role !== 'ADMIN') {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
  }

  try {
    const { id: userId } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where: { userId },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          audioUrl: true,
          lyrics: true,
          genre: true,
          mood: true,
        },
      }),
      prisma.song.count({ where: { userId } }),
    ])

    return applySecurityHeaders(NextResponse.json({
      songs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error) {
    console.error("Admin user songs error:", error)
    return applySecurityHeaders(NextResponse.json({ error: "Failed to retrieve songs" }, { status: 500 }))
  }
}
