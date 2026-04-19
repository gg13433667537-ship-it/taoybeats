/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as getSongs, POST as createSong } from '@/app/api/songs/route'
import { musicProvider } from '@/lib/ai-providers'
import { createSessionToken } from '@/lib/auth-utils'
import { prisma } from '@/lib/db'

// Helper to create NextRequest - keeping for potential future use
function _createMockRequest(body: unknown, options: RequestInit = {}): Request {
  return new Request('http://localhost:3000/api/test', {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  })
}

function createMockNextRequest(
  url: string,
  body: unknown,
  options: {
    method?: string
    cookies?: { name: string; value: string }[]
    headers?: Record<string, string>
  } = {}
): Request {
  const cookieHeader = options.cookies
    ? options.cookies.map(c => `${c.name}=${c.value}`).join('; ')
    : ''

  const request = new Request(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request & { cookies: { get: (name: string) => { value: string } | undefined } }

  // Add cookies mock
  const cookieMap = new Map<string, string>()
  options.cookies?.forEach(c => cookieMap.set(c.name, c.value))
  request.cookies = {
    get: (name: string) => {
      const value = cookieMap.get(name)
      return value ? { value } : undefined
    },
  } as any

  return request
}

// Create a valid session token for tests
function createTestSessionToken(userId: string, email: string, role: string = 'USER') {
  const mockUser = {
    id: userId,
    email,
    name: 'Test User',
    role,
    isActive: true,
    tier: 'FREE',
    dailyUsage: 0,
    monthlyUsage: 0,
    dailyResetAt: new Date().toISOString().split('T')[0],
    monthlyResetAt: new Date().toISOString().slice(0, 7),
    createdAt: new Date().toISOString(),
  }
  return createSessionToken(mockUser)
}

describe('Songs API', () => {
  beforeEach(() => {
    // Clear global storage
    if (global.users) global.users.clear()
    if (global.songs) global.songs.clear()

    // Reset environment
    process.env.MINIMAX_API_KEY = 'test-api-key'
    process.env.MINIMAX_API_URL = 'https://api.minimaxi.com'
    vi.spyOn(musicProvider, 'generate').mockResolvedValue('test-task-123')
  })

  describe('GET /api/songs', () => {
    it('should return empty array when no songs exist', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', null, {
        method: 'GET',
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await getSongs(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.songs).toEqual([])
    })

    it('should return songs for demo user', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')

      // First create a song
      const createRequest = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      await createSong(createRequest as any)

      // Then get songs
      const getRequest = createMockNextRequest('http://localhost:3000/api/songs', null, {
        method: 'GET',
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await getSongs(getRequest as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.songs)).toBe(true)
    })
  })

  describe('POST /api/songs', () => {
    it('should require title, lyrics, genre, and mood', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: '',
        genre: [],
        mood: '',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Title')
    })

    it('should require genre array to have items', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: [],
        mood: 'happy',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      await response.json()

      expect(response.status).toBe(400)
    })

    it('should create a song successfully with valid data', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'My Song',
        lyrics: 'These are my lyrics',
        genre: ['pop', 'rock'],
        mood: 'energetic',
        instruments: ['guitar', 'drums'],
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
      expect(data.shareToken).toBeDefined()
      expect(data.status).toBe('GENERATING')
      expect(data.multiPart).toBeUndefined()
    })

    it('should create instrumental song without lyrics', async () => {
      const sessionToken = createTestSessionToken('test-user', 'test@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Instrumental Song',
        genre: ['classical'],
        mood: 'peaceful',
        isInstrumental: true,
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
    })

    it('should compress very long lyrics instead of creating multipart songs', async () => {
      const sessionToken = createTestSessionToken('long-user', 'long@example.com')
      const originalLyrics = Array.from({ length: 120 }, (_, index) => `Line ${index + 1} should compress.`).join('\n')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Long Song',
        lyrics: originalLyrics,
        genre: ['pop'],
        mood: 'epic',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()
      const createdSong = global.songs?.get(data.id)

      expect(response.status).toBe(200)
      expect(data.multiPart).toBeUndefined()
      expect(data.compression).toMatchObject({
        applied: true,
        reason: 'lyrics_too_long',
      })
      expect(vi.mocked(prisma.song.create).mock.calls.length).toBe(1)
      expect(createdSong?.lyrics?.length).toBeLessThan(originalLyrics.length)
      expect(createdSong?.partGroupId).toBeUndefined()
    })

    it('should fall back to memory storage when Prisma is unavailable', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('db unavailable'))
      vi.mocked(prisma.user.create).mockRejectedValueOnce(new Error('db unavailable'))
      vi.mocked(prisma.song.create).mockRejectedValue(new Error('db unavailable'))
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('db unavailable'))
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 2,
            audio: 'https://cdn.minimax.example/song.mp3',
          },
          base_resp: {
            status_code: 0,
            status_msg: 'success',
          },
        }),
      }))

      const sessionToken = createTestSessionToken('memory-user', 'memory-user@example.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Memory Song',
        lyrics: 'Memory lyrics',
        genre: ['pop'],
        mood: 'happy',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
      expect(global.songs?.get(data.id)).toMatchObject({
        title: 'Memory Song',
        userId: 'memory-user',
      })
    })

    it('should enforce free tier daily limit', async () => {
      // Set up a user with high usage
      const demoUser = {
        id: 'demo-user',
        email: 'demo@taoybeats.com',
        name: 'Demo',
        role: 'USER' as const,
        isActive: true,
        tier: 'FREE' as const,
        dailyUsage: 3, // Already at limit
        monthlyUsage: 0,
        dailyResetAt: new Date().toISOString().split('T')[0],
        monthlyResetAt: new Date().toISOString().slice(0, 7),
        createdAt: new Date().toISOString(),
      }
      global.users!.set('demo-user', demoUser)
      global.users!.set('demo@taoybeats.com', demoUser)

      const sessionToken = createTestSessionToken('demo-user', 'demo@taoybeats.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('DAILY_LIMIT_REACHED')
    })

    it('should enforce free tier monthly limit', async () => {
      // Set up a user with high monthly usage
      const demoUser = {
        id: 'demo-user',
        email: 'demo@taoybeats.com',
        name: 'Demo',
        role: 'USER' as const,
        isActive: true,
        tier: 'FREE' as const,
        dailyUsage: 0,
        monthlyUsage: 10, // Already at limit
        dailyResetAt: new Date().toISOString().split('T')[0],
        monthlyResetAt: new Date().toISOString().slice(0, 7),
        createdAt: new Date().toISOString(),
      }
      global.users!.set('demo-user', demoUser)
      global.users!.set('demo@taoybeats.com', demoUser)

      const sessionToken = createTestSessionToken('demo-user', 'demo@taoybeats.com')
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Monthly Limit Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('MONTHLY_LIMIT_REACHED')
    })
  })
})
