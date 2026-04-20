/**
 * Security utilities for rate limiting, input sanitization, and CSRF protection
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { isIP } from "net"

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

/**
 * Get the client IP address from the request with proper validation.
 * Implements defense in depth to prevent IP spoofing attacks.
 *
 * Priority:
 * 1. x-vercel-forwarded-for (set by Vercel's trusted edge, most secure)
 * 2. request.ip (Next.js serverless environment variable, trustworthy)
 * 3. x-forwarded-for (cannot be fully trusted without known proxies, use rightmost IP)
 * 4. Secure fallback if no valid IP can be determined
 */
function getClientIP(request: NextRequest): string {
  // 1. Vercel's forwarded-for header (most trusted - set by Vercel edge)
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")
  if (vercelForwarded) {
    // Vercel header format: "client_ip, proxy1_ip, ..."
    // Take the first (client) IP
    const ip = vercelForwarded.split(",")[0].trim()
    if (isValidIP(ip)) {
      return ip
    }
  }

  // 2. Next.js built-in ip property (serverless environment variable)
  // This is set by the hosting platform and is generally trustworthy
  // Cast to access Vercel-injected property not in NextRequest type
  const requestIp = (request as { ip?: string }).ip
  if (requestIp && isValidIP(requestIp)) {
    return requestIp
  }

  // 3. X-Forwarded-For header (client-supplied, must be validated)
  // An attacker can set this to anything, so we validate strictly
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    // X-Forwarded-For format: "client_ip, proxy1_ip, proxy2_ip, ..."
    // The RIGHTMOST IP is the most recently added by an upstream proxy
    // If we know our proxy IPs, we should skip them and take the next one
    // Without known proxy config, use rightmost as it's most likely set by trusted proxy
    const parts = forwarded.split(",").map(p => p.trim()).filter(Boolean)
    if (parts.length > 0) {
      // Use rightmost IP - it's the last hop added by the outermost proxy
      // which is more likely to be a trusted proxy than the client
      const ip = parts[parts.length - 1]
      if (isValidIP(ip)) {
        return ip
      }
    }
  }

  // 4. Fallback - use a hash of headers that might indicate uniqueness
  // This is not ideal but better than accepting arbitrary input
  return "unknown"
}

/**
 * Validate an IP address format to prevent injection attacks.
 * Returns true only for valid IPv4 or IPv6 addresses.
 * Uses Node.js built-in isIP() for robust validation.
 */
function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== "string" || ip.length > 45) {
    return false
  }

  // Use Node.js built-in isIP() - returns 4 for IPv4, 6 for IPv6, 0 for invalid
  return isIP(ip) !== 0
}

export function getRateLimitKey(request: NextRequest, suffix: string = ""): string {
  const ip = getClientIP(request)
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

  // RFC 5322-compliant email regex validation (simplified but robust)
  // Allows: user@domain.com, user.name@domain.co.uk, user+tag@domain.org
  // Rejects: test@.com, test@@com, @domain.com, user@
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
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
// Input Validation Helpers
// ============================================================================

/** Maximum lengths for common fields */
export const MAX_LENGTHS = {
  TITLE: 200,
  DESCRIPTION: 1000,
  NAME: 100,
  EMAIL: 254,
  NOTES: 2000,
  LYRICS: 10000,
  GENRE: 50,
  MOOD: 50,
  INSTRUMENT: 50,
  PROMPT: 2000,
}

/** Validate a UUID parameter */
export function validateUUID(id: unknown, fieldName: string = "ID"): string | null {
  if (typeof id !== "string") {
    return `${fieldName} must be a string`
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return `Invalid ${fieldName} format`
  }
  return null
}

/** Validate string length */
export function validateLength(value: unknown, maxLength: number, fieldName: string): string | null {
  if (typeof value !== "string") {
    return `${fieldName} must be a string`
  }
  if (value.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters`
  }
  return null
}

/** Validate required string with sanitization */
export function validateRequiredString(input: unknown, maxLength: number, fieldName: string): string | null {
  if (input === undefined || input === null) {
    return `${fieldName} is required`
  }
  if (typeof input !== "string") {
    return `${fieldName} must be a string`
  }
  const sanitized = sanitizeString(input)
  if (sanitized.length === 0) {
    return `${fieldName} cannot be empty`
  }
  if (sanitized.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters`
  }
  return null
}

/** Validate optional string with sanitization */
export function validateOptionalString(input: unknown, maxLength: number, fieldName: string): string | null {
  if (input === undefined || input === null) {
    return null
  }
  if (typeof input !== "string") {
    return `${fieldName} must be a string`
  }
  const sanitized = sanitizeString(input)
  if (sanitized.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters`
  }
  return null
}

/** Validate enum value */
export function validateEnum(value: unknown, allowedValues: string[], fieldName: string): string | null {
  if (typeof value !== "string") {
    return `${fieldName} must be a string`
  }
  if (!allowedValues.includes(value)) {
    return `${fieldName} must be one of: ${allowedValues.join(", ")}`
  }
  return null
}

/** Validate array of strings with sanitization */
export function validateStringArray(input: unknown, maxLength: number, maxItems: number, _fieldName: string): string[] | null {
  if (!Array.isArray(input)) {
    return null
  }
  if (input.length > maxItems) {
    return null
  }
  const result: string[] = []
  for (const item of input) {
    if (typeof item !== "string") {
      return null
    }
    const sanitized = sanitizeString(item)
    if (sanitized.length > maxLength) {
      return null
    }
    result.push(sanitized)
  }
  return result
}

/** Validate boolean */
export function validateBoolean(value: unknown, _fieldName: string): boolean | null {
  if (typeof value === "boolean") {
    return value
  }
  if (value === "true" || value === "false") {
    return value === "true"
  }
  return null
}

/** Validate number within range */
export function validateNumber(value: unknown, min: number, max: number, _fieldName: string): number | null {
  if (typeof value === "number" && !isNaN(value)) {
    if (value < min || value > max) {
      return null
    }
    return value
  }
  if (typeof value === "string") {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= min && num <= max) {
      return num
    }
  }
  return null
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
// Content Security Policy (CSP)
// ============================================================================

/**
 * CSP configuration for API routes (JSON responses - no inline scripts/styles needed)
 *
 * RESTRICTED CSP - for API routes that return JSON
 * - No 'unsafe-inline' for scripts (APIs don't serve HTML)
 * - No 'unsafe-eval' (no dynamic code execution in this codebase)
 * - No 'unsafe-inline' for styles (APIs don't contain inline styles)
 */
const API_CSP = [
  "default-src 'self'",
  // No script-src needed for JSON APIs - add specific sources if needed
  "script-src 'self'",
  // Styles not needed in JSON responses
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Allow Music API connections
  "connect-src 'self' https://api.minimaxi.com https://api.minimax.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ")

/**
 * CSP configuration for browser (HTML pages)
 *
 * PRODUCTION CSP - designed to work with Tailwind CSS 4
 * - Uses 'self' for scripts and styles
 * - Tailwind CSS 4 generates styles at build time, so 'unsafe-inline' not needed in production
 * - Does NOT include 'unsafe-eval' (no dynamic code evaluation found in codebase)
 *
 * NOTE: During development with `npm run dev`, Next.js HMR may inject styles.
 * If you encounter HMR issues, you may temporarily add 'unsafe-inline' to style-src.
 * For production, test thoroughly without 'unsafe-inline' as Tailwind 4 extracts all styles.
 */
const BROWSER_CSP = [
  "default-src 'self'",
  // No unsafe-eval: codebase has no eval(), new Function(), or dynamic code execution
  "script-src 'self'",
  // Tailwind CSS 4 with JIT extracts styles at build time
  // If using CSS-in-JS (styled-components, emotion), add 'unsafe-inline' back
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.minimax.io",
  "font-src 'self' data:",
  // Allow Music API and Supabase connections
  "connect-src 'self' https://api.minimaxi.com https://api.minimax.com https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ")

/**
 * Get the appropriate CSP based on whether the response is an API route
 */
export function getCSP(isApiRoute: boolean = false): string {
  return isApiRoute ? API_CSP : BROWSER_CSP
}

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Security headers to apply to responses
 * Note: CSP is now separate and applied via getCSP()
 */
export const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}

/**
 * Apply security headers to a response
 * @param response - The NextResponse to apply headers to
 * @param cspType - Set to 'api' for API routes (JSON), 'browser' for HTML pages
 * @default 'api' - Most callers are API routes returning JSON
 */
export function applySecurityHeaders(response: NextResponse, cspType: 'api' | 'browser' = 'api'): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  // Apply CSP based on route type
  response.headers.set("Content-Security-Policy", getCSP(cspType === 'api'))
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
    "http://localhost:3001",
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
