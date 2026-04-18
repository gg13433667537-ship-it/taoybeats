import { prisma } from '../prisma'
import type { User as PrismaUser, Song as PrismaSong } from '@prisma/client'

// User service for database operations
export const userService = {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    })
  },

  async create(data: {
    id?: string
    email?: string
    name?: string
    password?: string
    role?: 'USER' | 'PRO' | 'ADMIN'
    tier?: string
  }) {
    return prisma.user.create({
      data: {
        id: data.id || crypto.randomUUID(),
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role || 'USER',
        tier: data.tier || 'FREE',
        dailyUsage: 0,
        monthlyUsage: 0,
      },
    })
  },

  async update(id: string, data: Partial<PrismaUser>) {
    return prisma.user.update({
      where: { id },
      data,
    })
  },

  async updateUsage(
    id: string,
    increment: { daily?: number; monthly?: number } = {}
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        dailyUsage: increment.daily
          ? { increment: increment.daily }
          : undefined,
        monthlyUsage: increment.monthly
          ? { increment: increment.monthly }
          : undefined,
        dailyResetAt: increment.daily ? new Date().toISOString().split('T')[0] : undefined,
        monthlyResetAt: increment.monthly
          ? new Date().toISOString().slice(0, 7)
          : undefined,
      },
    })
  },

  async findAll(options?: {
    skip?: number
    take?: number
    where?: Record<string, unknown>
  }) {
    return prisma.user.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
    })
  },

  async count(where?: Record<string, unknown>) {
    return prisma.user.count({ where })
  },
}

// Type for internal use
export type DbUser = PrismaUser
export type DbSong = PrismaSong