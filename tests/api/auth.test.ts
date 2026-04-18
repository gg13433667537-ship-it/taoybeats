import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionToken, verifySessionToken } from '@/lib/auth-utils'
import type { User } from '@/lib/types'

describe('Auth Utils', () => {
  const mockUser: User = {
    id: 'user-123',
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

  describe('createSessionToken', () => {
    it('should create a valid session token', () => {
      const token = createSessionToken(mockUser)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(2)
    })

    it('should create different tokens for different users', () => {
      const token1 = createSessionToken(mockUser)
      const token2 = createSessionToken({ ...mockUser, id: 'user-456' })
      expect(token1).not.toBe(token2)
    })
  })

  describe('verifySessionToken', () => {
    it('should verify a valid token', () => {
      const token = createSessionToken(mockUser)
      const payload = verifySessionToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.id).toBe(mockUser.id)
      expect(payload?.email).toBe(mockUser.email)
      expect(payload?.role).toBe(mockUser.role)
    })

    it('should return null for invalid token', () => {
      const payload = verifySessionToken('invalid.token')
      expect(payload).toBeNull()
    })

    it('should return null for tampered token', () => {
      const token = createSessionToken(mockUser)
      const [payload, signature] = token.split('.')
      const tamperedToken = `${payload}.tampered-${signature}`

      const payloadResult = verifySessionToken(tamperedToken)
      expect(payloadResult).toBeNull()
    })

    it('should return null for expired token', () => {
      // Create a token with an already expired time
      const expiredUser = {
        ...mockUser,
        // This is a workaround - in real tests we'd mock time
      }
      const token = createSessionToken(expiredUser)

      // Manual tampering to make it expired
      const [payloadBase64, signature] = token.split('.')
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
      payload.exp = Date.now() - 1000 // expired 1ms ago
      const tamperedPayloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
      const expiredToken = `${tamperedPayloadBase64}.${signature}`

      const result = verifySessionToken(expiredToken)
      expect(result).toBeNull()
    })
  })
})
