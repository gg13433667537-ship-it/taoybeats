import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js headers/cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
  })),
}))

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
  }
}

// Reset global state before each test
beforeEach(() => {
  // Reset global Maps used for in-memory storage
  if (global.users) global.users.clear()
  if (global.songs) global.songs.clear()
  if (global.adminLogs) global.adminLogs.clear()
})

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
})
