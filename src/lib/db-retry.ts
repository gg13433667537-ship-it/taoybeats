// Prisma error codes that are typically transient and safe to retry
const RETRYABLE_ERROR_CODES = [
  "P1001", // Can't reach database server
  "P1002", // Database server was reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
]

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const err = error as Error & { code?: string }

  if (err.code && RETRYABLE_ERROR_CODES.includes(err.code)) {
    return true
  }

  const message = err.message.toLowerCase()
  return (
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("pool") ||
    message.includes("can't reach database server") ||
    message.includes("server has closed the connection") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  )
}

/**
 * Execute a Prisma query with exponential backoff retry.
 * Retries on transient connection errors up to 3 times.
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 150
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error
      }

      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
