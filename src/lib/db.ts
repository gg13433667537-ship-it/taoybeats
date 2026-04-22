import { PrismaClient } from "@prisma/client"
import { isRetryableError } from "./db-retry"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const basePrisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma
}

/**
 * Prisma client with automatic retry on transient connection errors.
 * Uses $extends to wrap all model operations.
 */
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const maxRetries = 3
        const baseDelayMs = 150

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await query(args)
          } catch (error) {
            if (!isRetryableError(error) || attempt === maxRetries) {
              throw error
            }

            const delay = baseDelayMs * Math.pow(2, attempt)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      },
    },
  },
})

// Re-export retry utilities for convenience
export { withPrismaRetry, isRetryableError } from "./db-retry"
