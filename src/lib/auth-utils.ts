import crypto from "crypto"
import type { User } from "./types"

export function getSecretKey(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required. Set it in your .env file.")
  }
  // Ensure minimum key length for HMAC-SHA256
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters for adequate security.")
  }
  return secret
}

function createHmac(data: string): string {
  return crypto.createHmac("sha256", getSecretKey()).update(data).digest("hex")
}

export function createSessionToken(user: User): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp,
  }
  const payloadStr = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadStr).toString("base64")
  const signature = createHmac(payloadBase64)
  return `${payloadBase64}.${signature}`
}

export interface SessionPayload {
  id: string
  email: string
  role: string
  exp: number
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadBase64, signature] = token.split(".")
    if (!payloadBase64 || !signature) return null

    const expectedSignature = createHmac(payloadBase64)
    if (signature !== expectedSignature) {
      console.error("Invalid session token signature")
      return null
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8")) as SessionPayload

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

// Client-side only: decode token without verification (for reading user info only)
// Security note: This only decodes the payload. Signature verification still happens server-side.
export function decodeSessionToken(token: string): SessionPayload | null {
  try {
    const [payloadBase64] = token.split(".")
    if (!payloadBase64) return null
    return JSON.parse(atob(payloadBase64)) as SessionPayload
  } catch {
    return null
  }
}