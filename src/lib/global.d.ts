// Global type declarations for Next.js API routes
// This file must be included in the TypeScript compilation

interface GlobalUser {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  tier: string
  dailyUsage: number
  monthlyUsage: number
  dailyResetAt: string
  monthlyResetAt: string
  createdAt: string
}

interface GlobalSong {
  id: string
  userId: string
  title: string
  lyrics?: string
  genre: string[]
  mood: string
  instruments: string[]
  referenceSinger?: string
  referenceSong?: string
  userNotes?: string
  isInstrumental: boolean
  voiceId?: string
  referenceAudio?: string
  model: string
  outputFormat: string
  lyricsOptimizer: boolean
  sampleRate: number
  bitrate: number
  aigcWatermark: boolean
  status: string
  moderationStatus: string
  shareToken: string
  createdAt: string
  updatedAt: string
}

interface GlobalThis {
  systemApiKey?: string
  systemApiUrl?: string
  users?: Map<string, GlobalUser>
  songs?: Map<string, GlobalSong>
  adminLogs?: Map<string, unknown>
}

declare const globalThis: GlobalThis
