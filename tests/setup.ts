/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Set required environment variables BEFORE any imports
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-for-testing-only-32chars'
process.env.MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || 'test-minimax-api-key'
process.env.MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db'

// Initialize global state BEFORE any imports that might use it
if (typeof global.users === 'undefined') global.users = new Map()
if (typeof global.songs === 'undefined') global.songs = new Map()
if (typeof global.adminLogs === 'undefined') global.adminLogs = new Map()
global.systemApiKey = process.env.MINIMAX_API_KEY
global.systemApiUrl = process.env.MINIMAX_API_URL

// In-memory database for Prisma mock
const mockDb = {
  users: new Map<string, any>(),
  songs: new Map<string, any>(),
  playlists: new Map<string, any>(),
  presets: new Map<string, any>(),
  adminLogs: [] as any[],
}

// Mock Prisma Client with all commonly used methods
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return mockDb.users.get(where.email) || null
        if (where.id) return mockDb.users.get(where.id) || null
        return null
      }),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(mockDb.users.size),
      create: vi.fn(({ data }: { data: any }) => {
        const user = { ...data, createdAt: new Date().toISOString() }
        mockDb.users.set(data.email, user)
        mockDb.users.set(data.id, user)
        return user
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: any }) => {
        const user = mockDb.users.get(where.id)
        if (user) {
          const updated = { ...user, ...data }
          mockDb.users.set(where.id, updated)
          if (user.email) mockDb.users.delete(user.email)
          if (data.email) mockDb.users.set(data.email, updated)
          return updated
        }
        return null
      }),
      delete: vi.fn(),
    },
    song: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    playlist: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    preset: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    adminLog: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    usage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}))

// Export mockDb for test access
export { mockDb }

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockImplementation((password: string, hash: string) => {
      // For testing: any password that starts with 'test' or 'wrong' behaves as expected
      if (password.startsWith('test')) {
        return Promise.resolve(hash === '$2b$12$hashedpassword')
      }
      if (password.startsWith('wrong')) {
        return Promise.resolve(false)
      }
      return Promise.resolve(true)
    }),
    getRounds: vi.fn().mockReturnValue(12),
  },
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: vi.fn().mockResolvedValue(true),
}))

// Add bcrypt as a global for tests that use it directly
globalThis.bcrypt = {
  hash: async (_password: string, _salt: number) => '$2b$12$hashedpassword',
  compare: async (password: string, _hash: string) => password.startsWith('test'),
}

// Mock Next.js headers/cookies - return object directly, not a function
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockReturnValue(undefined),
    delete: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: () => ({
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
  }),
}))

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
  }
}

// Mock rate limiting for tests - allow unlimited requests
vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual('@/lib/security')
  return {
    ...actual,
    rateLimitMiddleware: vi.fn().mockReturnValue(null), // Disable rate limiting
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 999, resetAt: Date.now() + 60000 }),
  }
})

// Reset global state before each test
beforeEach(() => {
  // Re-initialize global Maps if they were cleared
  if (!(global as any).users || !(global as any).users instanceof Map) {
    (global as any).users = new Map()
  }
  if (!(global as any).songs || !(global as any).songs instanceof Map) {
    (global as any).songs = new Map()
  }
  if (!(global as any).adminLogs || !(global as any).adminLogs instanceof Map) {
    (global as any).adminLogs = new Map()
  }

  // Clear global Maps used for in-memory storage
  ;(global as any).users.clear()
  ;(global as any).songs.clear()
  ;(global as any).adminLogs.clear()

  // Clear mock database
  mockDb.users.clear()
  mockDb.songs.clear()
  mockDb.playlists.clear()
  mockDb.presets.clear()
  mockDb.adminLogs = []

  // Clear rate limit store
  if ((global as any).rateLimitStore) {
    ;(global as any).rateLimitStore.clear()
  }

  // Reset Prisma mocks
  vi.clearAllMocks()
})

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
})
