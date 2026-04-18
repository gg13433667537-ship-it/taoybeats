import { PrismaClient } from '@prisma/client'

// Singleton pattern for Prisma Client
// Ensures only one instance exists across the application

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export { PrismaClient }
