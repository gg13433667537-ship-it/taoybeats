import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, validateOptionalString, validateEnum, MAX_LENGTHS, validateCSRFDoubleSubmit } from "@/lib/security"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/db"
import crypto from "crypto"


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
  const endpoint = "/api/user/api-config"

  logger.api.request("GET", endpoint, { requestId })

  try {
    const user = await getCurrentUser(request)
    if (!user) {
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 401, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const apiConfig = await prisma.apiConfig.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        apiUrl: true,
        modelId: true,
        createdAt: true,
        updatedAt: true,
        // Never return the actual apiKey in GET - only metadata
      }
    })

    const duration = Date.now() - startTime
    logger.api.response("GET", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      apiConfig: apiConfig ? {
        id: apiConfig.id,
        provider: apiConfig.provider,
        apiUrl: apiConfig.apiUrl,
        modelId: apiConfig.modelId,
        hasApiKey: true, // Indicates an API key is stored (but not the key itself)
        createdAt: apiConfig.createdAt,
        updatedAt: apiConfig.updatedAt,
      } : null
    }))
  } catch (error) {
    logger.api.error("GET", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json({ error: "Failed to get API config" }, { status: 500 })
    )
  }
}

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/user/api-config"

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

    const { provider, apiKey, apiUrl, modelId } = await request.json()

    // Validate provider
    const providerError = validateEnum(provider, ["minimax", "suno", "udio", "custom"], "Provider")
    if (providerError) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 400, duration, { requestId, userId: user.id })
      return applySecurityHeaders(NextResponse.json({ error: providerError }, { status: 400 }))
    }

    // Validate apiKey (required for PUT)
    if (!apiKey || typeof apiKey !== "string" || apiKey.length === 0) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 400, duration, { requestId, userId: user.id })
      return applySecurityHeaders(NextResponse.json({ error: "API key is required" }, { status: 400 }))
    }

    // Validate apiUrl
    const apiUrlError = validateOptionalString(apiUrl, MAX_LENGTHS.PROMPT, "API URL")
    if (apiUrlError) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 400, duration, { requestId, userId: user.id })
      return applySecurityHeaders(NextResponse.json({ error: apiUrlError }, { status: 400 }))
    }

    // Validate modelId (optional)
    const modelIdError = validateOptionalString(modelId, MAX_LENGTHS.NAME, "Model ID")
    if (modelIdError) {
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 400, duration, { requestId, userId: user.id })
      return applySecurityHeaders(NextResponse.json({ error: modelIdError }, { status: 400 }))
    }

    // Upsert the API config - store server-side only, never expose back to client
    const apiConfig = await prisma.apiConfig.upsert({
      where: { userId: user.id },
      update: {
        provider,
        apiKey, // Stored server-side only
        apiUrl: apiUrl || "",
        modelId: modelId || null,
      },
      create: {
        userId: user.id,
        provider,
        apiKey, // Stored server-side only
        apiUrl: apiUrl || "",
        modelId: modelId || null,
      },
      select: {
        id: true,
        provider: true,
        apiUrl: true,
        modelId: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    const duration = Date.now() - startTime
    logger.api.response("PUT", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      apiConfig: {
        id: apiConfig.id,
        provider: apiConfig.provider,
        apiUrl: apiConfig.apiUrl,
        modelId: apiConfig.modelId,
        hasApiKey: true,
        createdAt: apiConfig.createdAt,
        updatedAt: apiConfig.updatedAt,
      }
    }))
  } catch (error) {
    logger.api.error("PUT", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json({ error: "Failed to save API config" }, { status: 500 })
    )
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/user/api-config"

  logger.api.request("DELETE", endpoint, { requestId })

  try {
    const user = await getCurrentUser(request)
    if (!user) {
      const duration = Date.now() - startTime
      logger.api.response("DELETE", endpoint, 401, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    // Validate CSRF token (Double Submit Cookie pattern)
    if (!validateCSRFDoubleSubmit(request)) {
      const duration = Date.now() - startTime
      logger.api.response("DELETE", endpoint, 403, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }))
    }

    await prisma.apiConfig.deleteMany({
      where: { userId: user.id }
    })

    const duration = Date.now() - startTime
    logger.api.response("DELETE", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    logger.api.error("DELETE", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json({ error: "Failed to delete API config" }, { status: 500 })
    )
  }
}