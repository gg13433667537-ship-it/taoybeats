import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { sanitizeString, validateOptionalString, applySecurityHeaders, MAX_LENGTHS } from "@/lib/security"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/db"
import crypto from "crypto"


if (!global.users) global.users = new Map()

async function getCurrentUser(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) return null

  try {
    return verifySessionToken(sessionToken)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/profile"

  logger.api.request("GET", endpoint, { requestId })

  try {
    const user = await getCurrentUser(request)
    console.log("[Profile API] getCurrentUser result:", user)
    if (!user) {
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 401, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    let existingUser = null
    try {
      existingUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, role: true, tier: true }
      })
      console.log("[Profile API] DB lookup for user.id:", user.id, "result:", existingUser)
    } catch (dbError) {
      console.error("[Profile API] Prisma lookup failed, falling back to memory:", dbError)
    }

    if (!existingUser) {
      const usersMap = global.users!
      const memoryUser = usersMap.get(user.id) || usersMap.get(user.email)
      if (memoryUser) {
        existingUser = {
          id: memoryUser.id,
          email: memoryUser.email,
          name: memoryUser.name || null,
          role: memoryUser.role,
          tier: memoryUser.tier,
        }
      }
    }

    if (!existingUser) {
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 404, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }))
    }

    const duration = Date.now() - startTime
    logger.api.response("GET", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      user: existingUser,
    }))
  } catch (error) {
    logger.api.error("GET", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to get profile" },
        { status: 500 }
      )
    )
  }
}

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/profile"

  logger.api.request("PUT", endpoint, { requestId })

  try {
    const user = await getCurrentUser(request)
    if (!user) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 401, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const { name } = await request.json()

    // Validate and sanitize name if provided
    if (name !== undefined) {
      const nameError = validateOptionalString(name, MAX_LENGTHS.NAME, "Name")
      if (nameError) {
        const duration = Date.now() - startTime
        logger.api.response("PUT", endpoint, 400, duration, { requestId, userId: user.id })
        return applySecurityHeaders(NextResponse.json({ error: nameError }, { status: 400 }))
      }
    }

    // Update user in global store
    const usersMap = global.users!
    const existingUser = usersMap.get(user.id)
    const sanitizedName = name ? sanitizeString(name) : existingUser?.name
    if (existingUser) {
      existingUser.name = sanitizedName
      usersMap.set(user.id, existingUser)
    }

    const duration = Date.now() - startTime
    logger.api.response("PUT", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: sanitizedName,
        role: user.role,
      },
    }))
  } catch (error) {
    logger.api.error("PUT", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      )
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/profile"

  logger.api.request("POST", endpoint, { requestId })

  // POST to profile requires authentication - add auth check
  const user = await getCurrentUser(request)
  if (!user) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 401, duration, { requestId })
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const { email, name } = await request.json()

    // Validate and sanitize email if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const sanitizedEmail = typeof email === "string" ? email.trim() : ""
      if (!emailRegex.test(sanitizedEmail)) {
        const duration = Date.now() - startTime
        logger.api.response("POST", endpoint, 400, duration, { requestId, userId: user.id })
        return applySecurityHeaders(NextResponse.json({ error: "Invalid email format" }, { status: 400 }))
      }
    }

    // Validate and sanitize name if provided
    if (name !== undefined) {
      const nameError = validateOptionalString(name, MAX_LENGTHS.NAME, "Name")
      if (nameError) {
        const duration = Date.now() - startTime
        logger.api.response("POST", endpoint, 400, duration, { requestId, userId: user.id })
        return applySecurityHeaders(NextResponse.json({ error: nameError }, { status: 400 }))
      }
    }

    // In production, update user in database
    // For demo, just return success
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      user: {
        email: typeof email === "string" ? sanitizeString(email) : email,
        name: name ? sanitizeString(name) : name,
      },
    }))
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      )
    )
  }
}
