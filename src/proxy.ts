import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/settings", "/generate"]

// Routes that require admin role
const adminRoutes = ["/admin"]

// Routes that redirect to dashboard if authenticated
const authRoutes = ["/login", "/register"]

// Security headers
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

// CSP for browser routes
// 'unsafe-inline' is required for Next.js React hydration and inline scripts
// Tailwind CSS 4 extracts styles at build time
const browserCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.minimax.io",
  "font-src 'self' data:",
  "connect-src 'self' https://api.minimaxi.com https://api.minimax.com https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ")

// Allowed origins for CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:3001",
]

// Edge-compatible HMAC verification using Web Crypto API
async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const dataBuffer = encoder.encode(data)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )

  const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
  const dataArrayBuffer = dataBuffer.buffer

  return await crypto.subtle.verify("HMAC", cryptoKey, signatureBuffer, dataArrayBuffer)
}

// Lightweight token verification for Edge Runtime (middleware only)
// Note: This only verifies the token structure and signature, not the full payload
async function verifyTokenEdge(token: string, secret: string): Promise<{ role: string } | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 2) return null

    const [payloadBase64, signature] = parts
    if (!payloadBase64 || !signature) return null

    // Verify signature using Web Crypto API
    const isValid = await hmacVerify(payloadBase64, signature, secret)
    if (!isValid) {
      console.error("Invalid session token signature")
      return null
    }

    // Decode payload
    const payload = JSON.parse(atob(payloadBase64)) as { id?: string; email?: string; role: string; exp: number }

    // Check expiration
    if (payload.exp < Date.now()) {
      console.error("Session token expired")
      return null
    }

    return { role: payload.role || "USER" }
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}

// Get AUTH_SECRET for middleware (fail-closed if not configured)
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    // Fail-closed: if AUTH_SECRET is not configured, return empty string
    // The calling code should reject the request when secret is empty
    return ""
  }
  return secret
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply security headers to all responses
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }

  // Apply CSP - use browser CSP for all routes (middleware serves HTML pages)
  // API routes get their own CSP via applySecurityHeaders in the API handlers
  if (!pathname.startsWith("/api/")) {
    response.headers.set("Content-Security-Policy", browserCSP)
  }

  // Handle CORS for API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin")
    if (origin && allowedOrigins.some(o => o === origin || new URL(origin).hostname === new URL(o).hostname)) {
      response.headers.set("Access-Control-Allow-Origin", origin)
      response.headers.set("Access-Control-Allow-Credentials", "true")
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token")
    }

    // Handle preflight
    if (request.method === "OPTIONS") {
      return response
    }
  }

  // Check for auth token
  const token = request.cookies.get("session-token")?.value

  // Verify token first, then set isAuthenticated based on verification result
  let isAuthenticated = false
  let userRole = 'USER'

  if (token) {
    try {
      const secret = getAuthSecret()
      const payload = await verifyTokenEdge(token, secret)
      if (payload) {
        isAuthenticated = true
        userRole = payload.role
      } else {
        // Invalid or expired token - clear cookie and treat as unauthenticated
        const response = NextResponse.redirect(new URL("/login", request.url))
        response.cookies.delete("session-token")
        return response
      }
    } catch {
      // Invalid token, treat as unauthenticated - clear cookie
      const response = NextResponse.redirect(new URL("/login", request.url))
      response.cookies.delete("session-token")
      return response
    }
  }

  // Admin routes - require ADMIN role
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    const secret = getAuthSecret()
    if (!secret) {
      // AUTH_SECRET not configured - fail closed, redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Check if user is ADMIN (verified from token)
    if (userRole !== 'ADMIN') {
      // Not admin - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return response
  }

  // Protected routes - require authentication
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Auth routes (login/register) - redirect to dashboard if authenticated
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
