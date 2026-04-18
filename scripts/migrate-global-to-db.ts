#!/usr/bin/env npx tsx
/**
 * Migration Script: Global Map to PostgreSQL
 *
 * This script migrates data from in-memory global Maps to Supabase PostgreSQL.
 * Run this ONCE when database connection is restored.
 *
 * Usage:
 *   npx tsx scripts/migrate-global-to-db.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Global Map types (must match src/app/api/songs/route.ts)
declare global {
  var users: Map<string, any> | undefined
  var songs: Map<string, any> | undefined
  var adminLogs: Map<string, any> | undefined
}

interface InMemoryUser {
  id: string
  email: string
  name?: string
  password?: string
  role: 'USER' | 'ADMIN'
  isActive: boolean
  tier: 'FREE' | 'PRO'
  dailyUsage: number
  monthlyUsage: number
  dailyResetAt: string
  monthlyResetAt: string
  createdAt: string
}

interface InMemorySong {
  id: string
  userId: string
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
  model?: string
  outputFormat?: string
  lyricsOptimizer?: boolean
  sampleRate?: number
  bitrate?: number
  aigcWatermark?: boolean
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  audioUrl?: string
  videoUrl?: string
  coverUrl?: string
  shareToken?: string
  forkedFrom?: string
  createdAt: string
  updatedAt: string
}

async function migrateUsers(): Promise<number> {
  const globalUsers = global.users as Map<string, InMemoryUser> | undefined
  if (!globalUsers || globalUsers.size === 0) {
    console.log('No users to migrate')
    return 0
  }

  console.log(`Migrating ${globalUsers.size} users...`)
  let migrated = 0

  for (const [id, user] of globalUsers) {
    try {
      await prisma.user.upsert({
        where: { id },
        update: {
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          tier: user.tier,
          dailyUsage: user.dailyUsage,
          monthlyUsage: user.monthlyUsage,
          dailyResetAt: user.dailyResetAt,
          monthlyResetAt: user.monthlyResetAt,
        },
        create: {
          id,
          email: user.email,
          name: user.name,
          role: user.role || 'USER',
          isActive: user.isActive ?? true,
          tier: user.tier || 'FREE',
          dailyUsage: user.dailyUsage || 0,
          monthlyUsage: user.monthlyUsage || 0,
          dailyResetAt: user.dailyResetAt,
          monthlyResetAt: user.monthlyResetAt,
        },
      })
      migrated++
    } catch (error) {
      console.error(`Failed to migrate user ${id}:`, error)
    }
  }

  return migrated
}

async function migrateSongs(): Promise<number> {
  const globalSongs = global.songs as Map<string, InMemorySong> | undefined
  if (!globalSongs || globalSongs.size === 0) {
    console.log('No songs to migrate')
    return 0
  }

  console.log(`Migrating ${globalSongs.size} songs...`)
  let migrated = 0

  for (const [id, song] of globalSongs) {
    try {
      await prisma.song.upsert({
        where: { id },
        update: {
          title: song.title,
          lyrics: song.lyrics,
          genre: song.genre,
          mood: song.mood,
          instruments: song.instruments,
          referenceSinger: song.referenceSinger,
          referenceSong: song.referenceSong,
          userNotes: song.userNotes,
          status: song.status,
          audioUrl: song.audioUrl,
          coverUrl: song.coverUrl,
        },
        create: {
          id,
          userId: song.userId,
          title: song.title,
          lyrics: song.lyrics,
          genre: song.genre || [],
          mood: song.mood,
          instruments: song.instruments || [],
          referenceSinger: song.referenceSinger,
          referenceSong: song.referenceSong,
          userNotes: song.userNotes,
          status: song.status || 'PENDING',
          audioUrl: song.audioUrl,
          coverUrl: song.coverUrl,
          shareToken: song.shareToken,
        },
      })
      migrated++
    } catch (error) {
      console.error(`Failed to migrate song ${id}:`, error)
    }
  }

  return migrated
}

async function main() {
  console.log('Starting migration from Global Map to PostgreSQL...')

  try {
    // Test connection
    await prisma.$connect()
    console.log('Database connection successful')
  } catch (error) {
    console.error('Database connection failed:', error)
    console.log('\nPlease ensure:')
    console.log('1. DATABASE_URL is configured in .env')
    console.log('2. Supabase project is active (not paused)')
    console.log('3. Run `npx prisma db push` to sync schema first')
    process.exit(1)
  }

  const usersMigrated = await migrateUsers()
  const songsMigrated = await migrateSongs()

  console.log(`\nMigration complete!`)
  console.log(`- Users migrated: ${usersMigrated}`)
  console.log(`- Songs migrated: ${songsMigrated}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})