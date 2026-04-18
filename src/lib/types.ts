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
  model?: 'music-2.6' | 'music-cover'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
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

export interface Playlist {
  id: string
  name: string
  description?: string
  userId: string
  songIds: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}
