import { describe, it, expect, beforeEach } from 'vitest'
import { POST as registerUser } from '@/app/api/auth/register/route'

function createMockNextRequest(
  url: string,
  body: unknown,
  options: {
    method?: string
    cookies?: { name: string; value: string }[]
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
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request
}

describe('Auth Register API', () => {
  beforeEach(() => {
    if (global.users) global.users.clear()
    if (global.songs) global.songs.clear()
  })

  describe('POST /api/auth/register', () => {
    it('should require email and password', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {})

      const response = await registerUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('请提供邮箱和密码')
    })

    it('should require password to be at least 6 characters', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: '12345',
      })

      const response = await registerUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('密码长度至少为6个字符')
    })

    it('should not allow duplicate email registration', async () => {
      // First registration
      const request1 = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })

      await registerUser(request1 as any)

      // Second registration with same email
      const request2 = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'password456',
      })

      const response = await registerUser(request2 as any)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('该邮箱已被注册')
    })

    it('should register a new user successfully', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      })

      const response = await registerUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('newuser@example.com')
      expect(data.user.name).toBe('New User')
      expect(data.user.role).toBe('ADMIN') // First user should be admin
      expect(data.user.id).toBeDefined()
    })

    it('should make second user a regular USER role', async () => {
      // First user
      const request1 = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'admin@example.com',
        password: 'password123',
      })
      await registerUser(request1 as any)

      // Second user
      const request2 = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'user@example.com',
        password: 'password123',
      })

      const response = await registerUser(request2 as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.role).toBe('USER')
    })

    it('should set session cookie on successful registration', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      })

      const response = await registerUser(request as any)

      expect(response.headers.get('Set-Cookie')).toBeDefined()
      const setCookie = response.headers.get('Set-Cookie') || ''
      expect(setCookie).toContain('session-token')
      expect(setCookie).toContain('HttpOnly')
    })
  })
})
