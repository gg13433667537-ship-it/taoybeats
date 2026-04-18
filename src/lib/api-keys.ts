// API Key Management with Automatic Failover

export interface APIKeyConfig {
  key: string
  model: 'music-2.6' | 'music-2.7'
  isHighSpeed: boolean
  isActive: boolean
  lastError?: string
  lastErrorTime?: number
}

// API Key configurations - ordered by priority
// Primary: High-speed key (music-2.6)
// Secondary: Standard key (music-2.7)
const apiKeyConfigs: APIKeyConfig[] = [
  {
    // Primary key - High speed version
    key: process.env.MINIMAX_API_KEY || '',
    model: 'music-2.6',
    isHighSpeed: true,
    isActive: true,
  },
  {
    // Fallback key - Standard version (no high speed)
    key: process.env.MINIMAX_API_KEY_FALLBACK || '',
    model: 'music-2.7',
    isHighSpeed: false,
    isActive: true,
  },
]

// Error codes that indicate key exhaustion/quota issues
const QUOTA_ERROR_CODES = [1008, 1010, 1011, 1012]

// Temporary error codes (rate limiting)
const TEMPORARY_ERROR_CODES = [1002, 1003, 1004]

// Cooldown period after quota error (5 minutes)
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000

// Cooldown period after temporary error (30 seconds)
const TEMPORARY_COOLDOWN_MS = 30 * 1000

/**
 * Get the currently active API key, with automatic failover
 */
export function getActiveAPIKey(): { key: string; model: 'music-2.6' | 'music-2.7'; isHighSpeed: boolean } {
  const now = Date.now()

  // Find first active key that's not in cooldown
  for (const config of apiKeyConfigs) {
    if (!config.key) continue

    // Check if this key is in cooldown due to recent error
    if (config.lastErrorTime) {
      const cooldownMs = QUOTA_ERROR_CODES.includes(getErrorCode(config.lastError || ''))
        ? QUOTA_COOLDOWN_MS
        : TEMPORARY_COOLDOWN_MS

      if (now - config.lastErrorTime < cooldownMs) {
        continue // Skip this key, it's in cooldown
      }
    }

    if (config.isActive) {
      return {
        key: config.key,
        model: config.model,
        isHighSpeed: config.isHighSpeed,
      }
    }
  }

  // All keys exhausted - return first key (will fail gracefully)
  return {
    key: apiKeyConfigs[0].key,
    model: apiKeyConfigs[0].model,
    isHighSpeed: apiKeyConfigs[0].isHighSpeed,
  }
}

/**
 * Report an error for a specific key - used for failover logic
 */
export function reportAPIKeyError(errorMessage: string): void {
  const errorCode = getErrorCode(errorMessage)

  // Mark the first active key as having an error
  for (const config of apiKeyConfigs) {
    if (config.isActive && config.key) {
      config.lastError = errorMessage
      config.lastErrorTime = Date.now()

      // If it's a quota error, deactivate the key temporarily
      if (QUOTA_ERROR_CODES.includes(errorCode)) {
        console.log(`[API Key] Key quota exhausted (${config.model}), deactivating for ${QUOTA_COOLDOWN_MS / 1000}s`)
        config.isActive = false

        // Reactivate after cooldown
        setTimeout(() => {
          config.isActive = true
          config.lastError = undefined
          config.lastErrorTime = undefined
          console.log(`[API Key] Key (${config.model}) reactivated after cooldown`)
        }, QUOTA_COOLDOWN_MS)
      }

      break // Only mark first active key
    }
  }
}

/**
 * Report successful API call - keeps key active
 */
export function reportAPISuccess(): void {
  // Reset error state for first active key
  for (const config of apiKeyConfigs) {
    if (config.isActive && config.key) {
      if (config.lastErrorTime) {
        config.lastError = undefined
        config.lastErrorTime = undefined
      }
      break
    }
  }
}

/**
 * Extract error code from error message
 */
function getErrorCode(errorMessage: string): number {
  const match = errorMessage.match(/\b(\d{4})\b/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Check if error indicates quota exhaustion
 */
export function isQuotaExhausted(errorMessage: string): boolean {
  return QUOTA_ERROR_CODES.includes(getErrorCode(errorMessage))
}

/**
 * Get all configured keys info (for debugging)
 */
export function getAPIKeyStatus(): { model: string; isHighSpeed: boolean; isActive: boolean; lastError?: string }[] {
  return apiKeyConfigs
    .filter(c => c.key)
    .map(c => ({
      model: c.model,
      isHighSpeed: c.isHighSpeed,
      isActive: c.isActive,
      lastError: c.lastError,
    }))
}

/**
 * Manually switch to fallback key (for emergency use)
 */
export function switchToFallback(): void {
  if (apiKeyConfigs[1].key) {
    apiKeyConfigs[0].isActive = false
    apiKeyConfigs[1].isActive = true
    console.log('[API Key] Manually switched to fallback key')
  }
}

/**
 * Reset to primary key
 */
export function resetToPrimary(): void {
  apiKeyConfigs[0].isActive = true
  apiKeyConfigs[1].isActive = true
  apiKeyConfigs[0].lastError = undefined
  apiKeyConfigs[0].lastErrorTime = undefined
  apiKeyConfigs[1].lastError = undefined
  apiKeyConfigs[1].lastErrorTime = undefined
  console.log('[API Key] Reset to primary key')
}
