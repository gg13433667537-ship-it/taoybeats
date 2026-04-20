/**
 * GET /api/auth/csrf
 * @description Returns the current CSRF token for form protection
 * Uses Double Submit Cookie pattern - token is set in cookie and returned in body
 */
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.AUTH_SECRET
const CSRF_COOKIE_NAME = "csrf-token"
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a stateless CSRF token
 * Token format: timestamp:randomBytes:signature
 */
function generateCSRFToken(): string {
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex")
  const data = `${timestamp}:${randomBytes}`
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET || "fallback-secret")
    .update(data)
    .digest("hex")

  return `${timestamp}:${randomBytes}:${signature}`
}

export async function GET(request: NextRequest) {
  // Check if there's an existing valid token in cookies
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

  // If token exists and is still valid (less than 1 hour old), return it
  if (existingToken) {
    const parts = existingToken.split(":")
    if (parts.length === 3) {
      const timestamp = parseInt(parts[0], 10)
      const age = Date.now() - timestamp
      if (age > 0 && age < 60 * 60 * 1000) {
        // Token is still valid, return it
        const response = NextResponse.json({ csrfToken: existingToken })
        return response
      }
    }
  }

  // Generate new token
  const token = generateCSRFToken()

  const response = NextResponse.json({ csrfToken: token })

  // Set CSRF cookie (not httpOnly so JS can read it)
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for double-submit
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // Strict to prevent CSRF
    maxAge: 60 * 60, // 1 hour
    path: "/",
  })

  return response
}