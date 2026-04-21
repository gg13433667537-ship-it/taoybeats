import { NextRequest, NextResponse } from "next/server"
import { verifySessionTokenWithDB } from "@/lib/auth-utils"
import { sanitizeString, validateOptionalString, applySecurityHeaders, MAX_LENGTHS, validateCSRFDoubleSubmit } from "@/lib/security"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/db"
import crypto from "crypto"

async function getCurrentUser(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) return null

  try {
    return await verifySessionTokenWithDB(sessionToken)
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
        select: { id: true, email: true, name: true, role: true, tier: true, dailyUsage: true, monthlyUsage: true, dailyResetAt: true, monthlyResetAt: true, createdAt: true }
      })
      console.log("[Profile API] DB lookup for user.id:", user.id, "result:", existingUser)
    } catch (dbError) {
      logger.error(`[Profile API] Prisma lookup failed: ${dbError}`)
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "服务器繁忙，请稍后重试" }, { status: 503 }))
    }

    if (!existingUser) {
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 404, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "用户不存在" }, { status: 404 }))
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

    // Validate CSRF token (Double Submit Cookie pattern)
    if (!validateCSRFDoubleSubmit(request)) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 403, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }))
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

    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { name: name ? sanitizeString(name) : undefined },
        select: { id: true, email: true, name: true, role: true, tier: true }
      })

      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 200, duration, { requestId, userId: user.id })

      return applySecurityHeaders(NextResponse.json({
        success: true,
        user: updatedUser,
      }))
    } catch (dbError) {
      logger.error(`[Profile API] Prisma update failed: ${dbError}`)
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "更新失败，请稍后重试" }, { status: 500 }))
    }
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

  // Validate CSRF token (Double Submit Cookie pattern)
  if (!validateCSRFDoubleSubmit(request)) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 403, duration, { requestId })
    return applySecurityHeaders(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }))
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

    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(email !== undefined ? { email: typeof email === "string" ? sanitizeString(email) : email } : {}),
          ...(name !== undefined ? { name: sanitizeString(name) } : {}),
        },
        select: { id: true, email: true, name: true, role: true, tier: true }
      })

      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 200, duration, { requestId, userId: user.id })

      return applySecurityHeaders(NextResponse.json({
        success: true,
        user: updatedUser,
      }))
    } catch (dbError) {
      logger.error(`[Profile API] Prisma update failed: ${dbError}`)
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "更新失败，请稍后重试" }, { status: 500 }))
    }
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
