// Shared types for in-memory storage

export type UserRole = 'USER' | 'ADMIN'
export type UserTier = 'FREE' | 'PRO'
export type SongStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'

export interface User {
  id: string
  email: string
  name?: string
  password?: string
  role: UserRole
  isActive: boolean
  tier: UserTier
  dailyUsage: number
  monthlyUsage: number
  dailyResetAt: string
  monthlyResetAt: string
  createdAt: string
}

export interface Song {
  id: string
  title: string
  lyrics?: string
  genre: string[]
  mood?: string
  instruments: string[]
  referenceSinger?: string
  referenceSong?: string
  userNotes?: string
  status: SongStatus
  audioUrl?: string
  coverUrl?: string
  shareToken?: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface SessionPayload {
  id: string
  email: string
  role: UserRole
  exp: number
}
