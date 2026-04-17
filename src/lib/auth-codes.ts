// Shared verification codes store (in-memory)
// In production, use Redis for this

export const verificationCodes: Map<string, { code: string; expires: number }> = new Map()

// Generate 6-digit code
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
