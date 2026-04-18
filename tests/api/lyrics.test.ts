/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'
import { POST as generateLyrics } from '@/app/api/lyrics/route'
import { createSessionToken } from '@/lib/auth-utils'
import type { User } from '@/lib/types'

function createMockNextRequest(
  url: string,
  body: unknown,
  options: {
    method?: string
    cookies?: { name: string; value: string }[]
  } = {}
): Request & { cookies: { get: (name: string) => { value: string } | undefined } } {
  const cookieHeader = options.cookies
    ? options.cookies.map(c => `${c.name}=${c.value}`).join('; ')
    : ''

  const request = new Request(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as Request & { cookies: { get: (name: string) => { value: string } | undefined } }

  // Add cookies property for NextRequest compatibility
  const cookiesMap = new Map<string, string>()
  options.cookies?.forEach(c => cookiesMap.set(c.name, c.value))

  request.cookies = {
    get: (name: string) => {
      const value = cookiesMap.get(name)
      return value ? { value } : undefined
    },
  }

  return request
}

describe('Lyrics API', () => {
  const mockUser: User = {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    isActive: true,
    tier: 'FREE',
    dailyUsage: 0,
    monthlyUsage: 0,
    dailyResetAt: '2024-01-01',
    monthlyResetAt: '2024-01',
    createdAt: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    if (global.users) global.users.clear()
    if (global.songs) global.songs.clear()

    // Set up system API key
    process.env.MINIMAX_API_KEY = 'test-api-key'
    process.env.MINIMAX_API_URL = 'https://api.minimaxi.com'
  })

  describe('POST /api/lyrics', () => {
    it('should require authentication', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        prompt: 'A happy song',
      })

      const response = await generateLyrics(request as any)
      await response.json() // consume body

      expect(response.status).toBe(401)
    })

    it('should generate lyrics with valid session', async () => {
      const sessionToken = createSessionToken(mockUser)

      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        mode: 'write_full_song',
        prompt: 'A song about love',
        title: 'Love Song',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      // Mock the fetch call to MiniMax API
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          song_title: 'Love Song',
          style_tags: ['romantic', 'pop'],
          lyrics: 'Verse 1... Chorus...',
          base_resp: { status_code: 0, status_msg: 'success' },
        }),
      }) as any

      const response = await generateLyrics(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lyrics).toBeDefined()
      expect(data.song_title).toBe('Love Song')
    })

    it('should handle edit mode with lyrics', async () => {
      const sessionToken = createSessionToken(mockUser)

      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        mode: 'edit',
        lyrics: 'Original lyrics here',
        prompt: 'Make it happier',
        title: 'Happy Song',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          song_title: 'Happy Song',
          style_tags: ['upbeat'],
          lyrics: 'Edited lyrics...',
          base_resp: { status_code: 0, status_msg: 'success' },
        }),
      }) as any

      const response = await generateLyrics(request as any)
      await response.json()

      expect(response.status).toBe(200)
    })

    it('should handle sensitive content error (1026)', async () => {
      const sessionToken = createSessionToken(mockUser)

      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        prompt: 'Some sensitive content',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 1026,
        json: async () => ({
          base_resp: { status_code: 1026, status_msg: 'Sensitive content detected' },
        }),
      }) as any

      const response = await generateLyrics(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe(1026)
      expect(data.error).toContain('敏感词')
    })

    it('should handle insufficient balance error (1008)', async () => {
      const sessionToken = createSessionToken(mockUser)

      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        prompt: 'A song',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 1008,
        json: async () => ({
          base_resp: { status_code: 1008, status_msg: 'Insufficient balance' },
        }),
      }) as any

      const response = await generateLyrics(request as any)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe(1008)
      expect(data.error).toContain('余额不足')
    })

    it('should handle rate limit error (1002)', async () => {
      const sessionToken = createSessionToken(mockUser)

      const request = createMockNextRequest('http://localhost:3000/api/lyrics', {
        prompt: 'A song',
      }, {
        cookies: [{ name: 'session-token', value: sessionToken }],
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 1002,
        json: async () => ({
          base_resp: { status_code: 1002, status_msg: 'Rate limit exceeded' },
        }),
      }) as any

      const response = await generateLyrics(request as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe(1002)
      expect(data.error).toContain('过于频繁')
    })
  })
})
