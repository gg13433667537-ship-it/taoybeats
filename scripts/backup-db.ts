#!/usr/bin/env npx tsx
/**
 * Database Backup Script
 *
 * Creates a JSON backup of all database tables.
 * Should be run before any major database changes.
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts [output-dir]
 *
 * Default output directory: ./backups
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface Backup {
  timestamp: string
  version: string
  tables: {
    users: unknown[]
    songs: unknown[]
    accounts: unknown[]
    sessions: unknown[]
    subscriptions: unknown[]
    apiConfigs: unknown[]
    adminLogs: unknown[]
  }
}

async function backupTable<T>(table: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    const data = await fn()
    console.log(`  ${table}: ${data.length} records`)
    return data
  } catch (error) {
    console.error(`  ${table}: ERROR - ${error}`)
    return []
  }
}

async function main() {
  const outputDir = process.argv[2] || './backups'

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = join(outputDir, `backup-${timestamp}.json`)

  console.log('Starting database backup...')
  console.log(`Output: ${filename}\n`)

  try {
    await prisma.$connect()
    console.log('Database connection successful\n')
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }

  const backup: Backup = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tables: {
      users: await backupTable('users', () => prisma.user.findMany()),
      songs: await backupTable('songs', () => prisma.song.findMany()),
      accounts: await backupTable('accounts', () => prisma.account.findMany()),
      sessions: await backupTable('sessions', () => prisma.session.findMany()),
      subscriptions: await backupTable('subscriptions', () => prisma.subscription.findMany()),
      apiConfigs: await backupTable('apiConfigs', () => prisma.apiConfig.findMany()),
      adminLogs: await backupTable('adminLogs', () => prisma.adminLog.findMany()),
    },
  }

  writeFileSync(filename, JSON.stringify(backup, null, 2))

  const totalRecords = Object.values(backup.tables).reduce(
    (sum, table) => sum + table.length,
    0
  )

  console.log(`\nBackup complete!`)
  console.log(`Total records: ${totalRecords}`)
  console.log(`File: ${filename}`)

  // Also create a latest symlink/copy
  const latestPath = join(outputDir, 'backup-latest.json')
  writeFileSync(latestPath, JSON.stringify(backup, null, 2))
  console.log(`Latest backup: ${latestPath}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Backup failed:', error)
  process.exit(1)
})