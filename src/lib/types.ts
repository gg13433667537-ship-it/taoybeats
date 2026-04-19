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
  sessionsRevokedAt?: string | null  // Timestamp when all sessions were revoked (for logout-all)
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
  referenceAudioUrl?: string
  // Enhanced Audio-to-Audio options
  timbreSimilarity?: number // 0.0 - 1.0
  mixMode?: boolean
  mixModeVocalVolume?: number // 0.0 - 1.0
  referenceLyrics?: ReferenceLyrics[]
  model?: 'music-2.6' | 'music-cover'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
  status: SongStatus
  moderationStatus: ModerationStatus
  audioUrl?: string
  videoUrl?: string
  coverUrl?: string
  shareToken?: string
  userId: string
  forkedFrom?: string
  originalOwnerId?: string  // Original song owner's ID for attribution
  partGroupId?: string      // Groups multi-part songs together
  part?: number             // Part number for multi-part songs (1 = first part)
  createdAt: string
  updatedAt: string
}

// Structured reference lyrics for learning songwriting style
export interface ReferenceLyrics {
  text: string
  startTime?: number // Optional timestamp in seconds
  endTime?: number // Optional timestamp in seconds
  section?: string // e.g., "[Verse]", "[Chorus]"
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

export interface Preset {
  id: string
  userId: string
  name: string
  genre: string[]
  mood: string
  instruments: string[]
  isInstrumental: boolean
  shareToken?: string
  createdAt: string
  updatedAt: string
}
