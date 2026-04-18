import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST as registerUser } from '@/app/api/auth/register/route'
import { POST as loginUser } from '@/app/api/auth/login/route'
import { GET as getSongs, POST as createSong } from '@/app/api/songs/route'

// Helper to create NextRequest
function createMockRequest(body: unknown, options: RequestInit = {}): Request {
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

  return new Request(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request
}

describe('Songs API', () => {
  beforeEach(() => {
    // Clear global storage
    if (global.users) global.users.clear()
    if (global.songs) global.songs.clear()

    // Reset environment
    process.env.MINIMAX_API_KEY = 'test-api-key'
    process.env.MINIMAX_API_URL = 'https://api.minimaxi.com'
  })

  describe('GET /api/songs', () => {
    it('should return empty array when no songs exist', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/songs', null, {
        method: 'GET',
      })

      const response = await getSongs(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.songs).toEqual([])
    })

    it('should return songs for demo user', async () => {
      // First create a song
      const createRequest = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
      })

      await createSong(createRequest as any)

      // Then get songs
      const getRequest = createMockNextRequest('http://localhost:3000/api/songs', null, {
        method: 'GET',
      })

      const response = await getSongs(getRequest as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.songs)).toBe(true)
    })
  })

  describe('POST /api/songs', () => {
    it('should require title, lyrics, genre, and mood', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: '',
        genre: [],
        mood: '',
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should require genre array to have items', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: [],
        mood: 'happy',
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should create a song successfully with valid data', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'My Song',
        lyrics: 'These are my lyrics',
        genre: ['pop', 'rock'],
        mood: 'energetic',
        instruments: ['guitar', 'drums'],
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
      expect(data.shareToken).toBeDefined()
      expect(data.status).toBe('PENDING')
    })

    it('should create instrumental song without lyrics', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Instrumental Song',
        genre: ['classical'],
        mood: 'peaceful',
        isInstrumental: true,
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
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

      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
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

      const request = createMockNextRequest('http://localhost:3000/api/songs', {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: ['pop'],
        mood: 'happy',
      })

      const response = await createSong(request as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('MONTHLY_LIMIT_REACHED')
    })
  })
})
