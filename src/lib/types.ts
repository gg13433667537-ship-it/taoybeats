// Shared types for in-memory storage

export type UserRole = 'USER' | 'ADMIN'
export type UserTier = 'FREE' | 'PRO'
export type SongStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

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
  stripeCustomerId?: string
  stripeSubscriptionId?: string
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
  isInstrumental?: boolean
  voiceId?: string
  referenceAudio?: string
  status: SongStatus
  moderationStatus: ModerationStatus
  audioUrl?: string
  coverUrl?: string
  shareToken?: string
  userId: string
  forkedFrom?: string
  createdAt: string
  updatedAt: string
}

export interface SessionPayload {
  id: string
  email: string
  role: UserRole
  tier: UserTier
  exp: number
}
