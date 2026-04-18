/**
 * Security utilities for rate limiting, input sanitization, and CSRF protection
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
}

export const STRICT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute (for sensitive endpoints)
}

export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 failed attempts per 15 minutes
}

export function getRateLimitKey(request: NextRequest, suffix: string = ""): string {
  // Use IP address as the key, with fallback
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown"
  return `rate_limit:${ip}${suffix ? ":" + suffix : ""}`
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    cleanupExpiredEntries(now)
  }

  if (!entry || now > entry.resetAt) {
    // Start new window
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

export function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  suffix: string = ""
): NextResponse | null {
  const key = getRateLimitKey(request, suffix)
  const { allowed, resetAt } = checkRateLimit(key, config)

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: "请求过于频繁，请稍后再试",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      }
    )
  }

  return null // No rate limit hit
}

/**
 * Apply rate limit to an API route handler
 */
type HandlerWithRequest = (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>

export function withRateLimit<T extends HandlerWithRequest>(
  handler: T,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  suffix: string = ""
): T {
  return (async (request: NextRequest, ...args: unknown[]) => {
    const rateLimitResponse = rateLimitMiddleware(request, config, suffix)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    return handler(request, ...args)
  }) as T
}

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Sanitize a string to prevent XSS attacks
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") {
    return ""
  }

  // Remove null bytes and control characters (except newlines/tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  // HTML entity encoding for potential XSS
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")

  return sanitized.trim()
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: unknown): string | null {
  if (typeof email !== "string") {
    return null
  }

  // Basic email sanitization - remove dangerous characters
  const sanitized = email
    .toLowerCase()
    .trim()
    .replace(/[<>(){}[\]\\]/g, "")
    .slice(0, 254) // Max email length

  // Simple email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Sanitize an object with string fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): Partial<T> {
  const sanitized: Partial<T> = {}
  for (const field of fields) {
    const value = obj[field]
    if (typeof value === "string") {
      (sanitized as Record<string, string>)[field as string] = sanitizeString(value)
    } else if (value !== undefined) {
      (sanitized as Record<string, unknown>)[field as string] = value
    }
  }
  return sanitized
}

/**
 * Validate and sanitize user input for common fields
 */
export function validateInput(input: unknown, type: "email" | "text" | "uuid" | "number"): string | null {
  if (typeof input !== "string") {
    return null
  }

  switch (type) {
    case "email":
      return sanitizeEmail(input)
    case "text":
      return sanitizeString(input)
    case "uuid":
      // UUID v4 regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(input) ? input : null
    case "number":
      const num = parseInt(input, 10)
      return !isNaN(num) && num > 0 ? String(num) : null
    default:
      return null
  }
}

// ============================================================================
// CSRF Protection
// ============================================================================

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.AUTH_SECRET
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(sessionId: string): string {
  if (!CSRF_SECRET) {
    throw new Error("CSRF_SECRET or AUTH_SECRET environment variable is required")
  }

  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex")
  const data = `${sessionId}:${timestamp}:${randomBytes}`
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(data)
    .digest("hex")

  return `${timestamp}:${randomBytes}:${signature}`
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(token: string, sessionId: string): boolean {
  if (!token || !sessionId) {
    return false
  }

  try {
    const parts = token.split(":")
    if (parts.length !== 3) {
      return false
    }

    const [timestampStr, randomBytes, signature] = parts
    const timestamp = parseInt(timestampStr, 10)

    // Check token age (max 1 hour)
    const age = Date.now() - timestamp
    if (age > 60 * 60 * 1000 || age < 0) {
      return false
    }

    // Verify signature
    const data = `${sessionId}:${timestamp}:${randomBytes}`
    const expectedSignature = crypto
      .createHmac("sha256", CSRF_SECRET!)
      .update(data)
      .digest("hex")

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Extract and validate CSRF token from request
 */
export function getCSRFToken(request: NextRequest): string | null {
  // Check Authorization header first, then X-CSRF-Token header
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  return request.headers.get("x-csrf-token")
}

/**
 * Validate CSRF token from request
 */
export function validateCSRF(request: NextRequest, sessionId: string): boolean {
  const token = getCSRFToken(request)
  if (!token) {
    return false
  }
  return verifyCSRFToken(token, sessionId)
}

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Security headers to apply to responses
 */
export const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.minimaxi.com https://api.minimax.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

// ============================================================================
// CORS Configuration
// ============================================================================

interface CORSConfig {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
}

const DEFAULT_CORS: CORSConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "https://taoybeats.com",
  ],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Requested-With",
  ],
  exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
  credentials: true,
  maxAge: 86400, // 24 hours
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CORSConfig = DEFAULT_CORS): boolean {
  if (!origin) {
    return false
  }
  return config.allowedOrigins.some(
    (allowed) => allowed === "*" || allowed === origin || new URL(origin).hostname === new URL(allowed).hostname
  )
}

/**
 * Handle CORS preflight request
 */
export function handleCORS(request: NextRequest, config: CORSConfig = DEFAULT_CORS): NextResponse | null {
  const origin = request.headers.get("origin")
  const method = request.method

  if (method === "OPTIONS") {
    if (!isOriginAllowed(origin, config)) {
      return new NextResponse(null, { status: 403 })
    }

    const response = new NextResponse(null, { status: 204 })
    response.headers.set("Access-Control-Allow-Origin", origin || "")
    response.headers.set("Access-Control-Allow-Methods", config.allowedMethods.join(", "))
    response.headers.set("Access-Control-Allow-Headers", config.allowedHeaders.join(", "))
    response.headers.set("Access-Control-Allow-Credentials", String(config.credentials))
    response.headers.set("Access-Control-Max-Age", String(config.maxAge))

    if (config.exposedHeaders.length > 0) {
      response.headers.set("Access-Control-Expose-Headers", config.exposedHeaders.join(", "))
    }

    return response
  }

  return null // Not a preflight request
}

/**
 * Add CORS headers to response
 */
export function applyCORSHeaders(response: NextResponse, request: NextRequest, config: CORSConfig = DEFAULT_CORS): NextResponse {
  const origin = request.headers.get("origin")

  if (isOriginAllowed(origin, config)) {
    response.headers.set("Access-Control-Allow-Origin", origin || "")
    if (config.credentials) {
      response.headers.set("Access-Control-Allow-Credentials", "true")
    }
    if (config.exposedHeaders.length > 0) {
      response.headers.set("Access-Control-Expose-Headers", config.exposedHeaders.join(", "))
    }
  }

  return response
}
