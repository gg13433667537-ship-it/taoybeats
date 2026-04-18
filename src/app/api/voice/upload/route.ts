import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, sanitizeString, validateEnum } from "@/lib/security"

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size: 50MB (MiniMax API limit for voice uploads) */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Allowed audio formats */
const ALLOWED_AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac']

/** Allowed purpose values for MiniMax File Upload API */
const ALLOWED_PURPOSES = ['prompt_audio', 'voice_cloning', 'audio_edit']

/** Audio file magic bytes (base64 prefix) for format detection */
const AUDIO_MAGIC_BYTES: Record<string, string[]> = {
  mp3: ['/uM', '/uQx', '//u', '//t'],
  wav: ['UklG'],
  flac: ['fKLa'],
  m4a: ['//t'],
  ogg: ['T2dn'],
  aac: ['//t'],
}

// ============================================================================
// Global Initialization
// ============================================================================

if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
if (!global.users) global.users = new Map()

// ============================================================================
// Helper Functions
// ============================================================================

function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

/**
 * Validate base64 string
 */
function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  try {
    const cleaned = str.replace(/\s/g, '')
    return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)
  } catch {
    return false
  }
}

/**
 * Detect audio format from base64 magic bytes
 */
function detectAudioFormat(base64Data: string): string | null {
  const prefix = base64Data.substring(0, 4)
  for (const [format, prefixes] of Object.entries(AUDIO_MAGIC_BYTES)) {
    if (prefixes.some(p => prefix.startsWith(p) || p.startsWith(prefix))) {
      return format
    }
  }
  return null
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string | undefined): string {
  if (!filename) return 'audio.mp3'

  const sanitized = sanitizeString(filename)

  // Remove path separators and null bytes
  const cleaned = sanitized.replace(/[\/\\\x00]/g, '')

  // Ensure it has a valid extension
  const hasValidExt = ALLOWED_AUDIO_FORMATS.some(ext =>
    cleaned.toLowerCase().endsWith(`.${ext}`)
  )

  if (hasValidExt) return cleaned

  // Default to mp3 if no valid extension
  return 'audio.mp3'
}

// ============================================================================
// Validation Functions
// ============================================================================

interface ValidationResult {
  valid: boolean
  error?: string
}

function validateFileData(fileData: unknown): ValidationResult {
  if (typeof fileData !== 'string') {
    return { valid: false, error: 'file_data must be a string' }
  }

  if (!isValidBase64(fileData)) {
    return { valid: false, error: 'Invalid base64 encoding in file_data' }
  }

  // Check size by estimating decoded bytes
  const estimatedSize = Math.ceil((fileData.length * 3) / 4)
  if (estimatedSize > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` }
  }

  // Validate audio format
  const format = detectAudioFormat(fileData)
  if (!format) {
    return { valid: false, error: 'Unable to detect audio format. Supported formats: mp3, wav, flac, m4a, ogg, aac' }
  }

  return { valid: true }
}

function validatePurpose(purpose: unknown): ValidationResult {
  const error = validateEnum(purpose, ALLOWED_PURPOSES, 'purpose')
  if (error) {
    return { valid: false, error }
  }
  return { valid: true }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { file_data, filename, purpose = 'prompt_audio' } = body

    // Validate file_data
    if (!file_data) {
      return applySecurityHeaders(NextResponse.json(
        { error: "file_data is required" },
        { status: 400 }
      ))
    }

    // Validate file data (format, size, base64)
    const fileValidation = validateFileData(file_data)
    if (!fileValidation.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      ))
    }

    // Validate purpose
    const purposeValidation = validatePurpose(purpose)
    if (!purposeValidation.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: purposeValidation.error },
        { status: 400 }
      ))
    }

    // Sanitize filename
    const safeFilename = sanitizeFilename(filename)

    // Use system API key for all requests
    const apiKey = global.systemApiKey
    const baseUrl = global.systemApiUrl

    // Call MiniMax File Upload API
    // file_data should be base64 encoded audio
    const response = await fetch(`${baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        file: file_data,
        filename: safeFilename,
        purpose,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ base_resp: { status_msg: response.statusText } }))
      const errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || `HTTP ${response.status}`

      // Handle specific error codes
      if (response.status === 2049) {
        return applySecurityHeaders(NextResponse.json(
          { error: "无效API Key", code: 2049 },
          { status: 401 }
        ))
      }
      if (response.status === 1002) {
        return applySecurityHeaders(NextResponse.json(
          { error: "请求过于频繁，请稍后再试", code: 1002 },
          { status: 429 }
        ))
      }

      return applySecurityHeaders(NextResponse.json(
        { error: `MiniMax API error: ${errorMessage}` },
        { status: response.status }
      ))
    }

    const data = await response.json()

    return applySecurityHeaders(NextResponse.json({
      file: {
        file_id: data.file?.file_id,
        bytes: data.file?.bytes,
        created_at: data.file?.created_at,
        filename: data.file?.filename,
        purpose: data.file?.purpose,
      },
      base_resp: data.base_resp,
    }))
  } catch (error) {
    console.error("Voice upload error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to upload voice file" },
      { status: 500 }
    ))
  }
}