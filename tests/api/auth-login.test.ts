/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'
import { POST as loginUser } from '@/app/api/auth/login/route'
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

describe('Auth Login API', () => {
  beforeEach(() => {
    if (global.users) global.users.clear()
    if (global.songs) global.songs.clear()
  })

  describe('POST /api/auth/login', () => {
    it('should require email and password', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {})

      const response = await loginUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('请输入邮箱和密码')
    })

    it('should reject login for non-existent user', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      const response = await loginUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('该邮箱尚未注册')
    })

    it('should reject login with wrong password', async () => {
      // First register a user
      const registerRequest = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'correctpassword',
      })
      await registerUser(registerRequest as any)

      // Try to login with wrong password
      const loginRequest = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      const response = await loginUser(loginRequest as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('密码错误')
    })

    it('should reject login for user without password (OAuth only user)', async () => {
      // Manually create a user without password
      const user = {
        id: 'oauth-user',
        email: 'oauth@example.com',
        name: 'OAuth User',
        role: 'USER' as const,
        isActive: true,
        tier: 'FREE' as const,
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: new Date().toISOString().split('T')[0],
        monthlyResetAt: new Date().toISOString().slice(0, 7),
        createdAt: new Date().toISOString(),
        // No password field
      }
      global.users!.set('oauth@example.com', user)
      global.users!.set('oauth-user', user)

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'oauth@example.com',
        password: 'anypassword',
      })

      const response = await loginUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('尚未设置密码')
    })

    it('should reject login for inactive user', async () => {
      // Create an inactive user
      const user = {
        id: 'inactive-user',
        email: 'inactive@example.com',
        name: 'Inactive User',
        password: await bcrypt.hash('password123', 10),
        role: 'USER' as const,
        isActive: false, // Inactive
        tier: 'FREE' as const,
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: new Date().toISOString().split('T')[0],
        monthlyResetAt: new Date().toISOString().slice(0, 7),
        createdAt: new Date().toISOString(),
      }
      global.users!.set('inactive@example.com', user)
      global.users!.set('inactive-user', user)

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'inactive@example.com',
        password: 'password123',
      })

      const response = await loginUser(request as any)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('已被禁用')
    })

    it('should login successfully with correct credentials', async () => {
      // First register a user
      const registerRequest = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })
      await registerUser(registerRequest as any)

      // Now login
      const loginRequest = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      })

      const response = await loginUser(loginRequest as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
    })

    it('should set session cookie on successful login', async () => {
      // Register first
      const registerRequest = createMockNextRequest('http://localhost:3000/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      })
      await registerUser(registerRequest as any)

      // Login
      const loginRequest = createMockNextRequest('http://localhost:3000/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      })

      const response = await loginUser(loginRequest as any)

      expect(response.headers.get('Set-Cookie')).toBeDefined()
      const setCookie = response.headers.get('Set-Cookie') || ''
      expect(setCookie).toContain('session-token')
      expect(setCookie).toContain('HttpOnly')
    })
  })
})
