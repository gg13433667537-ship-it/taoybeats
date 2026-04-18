import { prisma } from '../prisma'
import type { Song as PrismaSong } from '@prisma/client'

// Song service for database operations
export const songService = {
  async findById(id: string) {
    return prisma.song.findUnique({
      where: { id },
    })
  },

  async findByShareToken(shareToken: string) {
    return prisma.song.findUnique({
      where: { shareToken },
    })
  },

  async findByUserId(userId: string, options?: {
    skip?: number
    take?: number
    status?: string
  }) {
    return prisma.song.findMany({
      where: {
        userId,
        ...(options?.status && { status: options.status as any }),
      },
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    })
  },

  async create(data: {
    id?: string
    userId: string
    title: string
    lyrics?: string
    genre?: string[]
    mood?: string
    instruments?: string[]
    referenceSinger?: string
    referenceSong?: string
    userNotes?: string
    status?: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
    audioUrl?: string
    coverUrl?: string
    shareToken?: string
  }) {
    return prisma.song.create({
      data: {
        id: data.id || crypto.randomUUID(),
        userId: data.userId,
        title: data.title,
        lyrics: data.lyrics,
        genre: data.genre || [],
        mood: data.mood,
        instruments: data.instruments || [],
        referenceSinger: data.referenceSinger,
        referenceSong: data.referenceSong,
        userNotes: data.userNotes,
        status: data.status || 'PENDING',
        audioUrl: data.audioUrl,
        coverUrl: data.coverUrl,
        shareToken: data.shareToken || crypto.randomUUID().slice(0, 8),
      },
    })
  },

  async update(id: string, data: Partial<PrismaSong>) {
    return prisma.song.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  },

  async updateStatus(
    id: string,
    status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED',
    additionalData?: {
      audioUrl?: string
      coverUrl?: string
    }
  ) {
    return prisma.song.update({
      where: { id },
      data: {
        status,
        audioUrl: additionalData?.audioUrl,
        coverUrl: additionalData?.coverUrl,
        updatedAt: new Date(),
      },
    })
  },

  async delete(id: string) {
    return prisma.song.delete({
      where: { id },
    })
  },

  async count(userId?: string, status?: string) {
    return prisma.song.count({
      where: {
        ...(userId && { userId }),
        ...(status && { status: status as any }),
      },
    })
  },

  async findAll(options?: {
    skip?: number
    take?: number
    where?: Record<string, unknown>
  }) {
    return prisma.song.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    })
  },
}

// Type for internal use
export type DbSong = PrismaSong