import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"

// Edge-compatible HMAC verification using Web Crypto API
async function verifyTokenSignature(
  payloadBase64: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )

  const payloadBytes = encoder.encode(payloadBase64)
  const signatureBytes = Uint8Array.from(
    atob(signature),
    (c) => c.charCodeAt(0)
  )

  return crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes)
}

interface SessionPayload {
  id: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.warn("AUTH_SECRET not configured, admin route protection may not work correctly")
    return ""
  }
  return secret
}

async function verifySessionTokenEdge(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 2) return null

    const [payloadBase64, signature] = parts
    if (!payloadBase64 || !signature) return null

    // Verify signature using Web Crypto API
    const isValid = await verifyTokenSignature(payloadBase64, signature, secret)
    if (!isValid) {
      console.error("Invalid session token signature")
      return null
    }

    const payload = JSON.parse(
      atob(payloadBase64)
    ) as SessionPayload

    // Check expiration
    if (payload.exp < Date.now()) {
      console.error("Session token expired")
      return null
    }

    return payload
  } catch (error) {
    console.error("Session token verification failed:", error)
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes (but not /api/admin/* - those have their own auth)
  if (!pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return NextResponse.next()
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) {
    // No session token - redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Verify the session token
  const secret = getAuthSecret()
  if (!secret) {
    // If no AUTH_SECRET, allow request to proceed (fallback to API-level auth)
    return NextResponse.next()
  }

  const payload = await verifySessionTokenEdge(sessionToken, secret)

  if (!payload) {
    // Invalid or expired token - redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (payload.role !== "ADMIN") {
    // Not an admin - redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // User is authenticated and is an admin - allow request
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
