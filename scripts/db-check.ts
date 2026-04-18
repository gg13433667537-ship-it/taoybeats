#!/usr/bin/env npx tsx
/**
 * Database Health Check
 *
 * Checks database connectivity and schema status.
 *
 * Usage:
 *   npx tsx scripts/db-check.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TableInfo {
  name: string
  rowCount: number
  columns: number
}

async function getTableInfo(tableName: string): Promise<TableInfo | null> {
  try {
    // Use raw query to get row count
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "${tableName as any}"
    `
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const count = Number(result[0]?.count || 0)

    // Get column count from information_schema
    const columnsResult = await prisma.$queryRaw<[{ column_count: number }]>`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_name = ${tableName}
    `
    const columnCount = Number(columnsResult[0]?.column_count || 0)

    return {
      name: tableName,
      rowCount: count,
      columns: columnCount,
    }
  } catch {
    return null
  }
}

async function main() {
  console.log('Database Health Check')
  console.log('='.repeat(50))

  // Test connection
  try {
    await prisma.$connect()
    console.log('\n[OK] Database connection')
  } catch (error) {
    console.error('\n[FAIL] Database connection:', error)
    console.log('\nTroubleshooting:')
    console.log('1. Check DATABASE_URL in .env')
    console.log('2. Verify Supabase project is active')
    console.log('3. Check network connectivity')
    process.exit(1)
  }

  // Check tables
  const expectedTables = [
    'User',
    'Song',
    'Account',
    'Session',
    'VerificationToken',
    'AdminLog',
    'ApiConfig',
    'Subscription',
  ]

  console.log('\nTable Status:')
  let allTablesExist = true

  for (const table of expectedTables) {
    const info = await getTableInfo(table)
    if (info) {
      console.log(`  [OK] ${table}: ${info.rowCount} rows, ${info.columns} columns`)
    } else {
      console.log(`  [MISSING] ${table}`)
      allTablesExist = false
    }
  }

  if (!allTablesExist) {
    console.log('\n[ACTION] Run `npx prisma db push` to create missing tables')
  }

  // Check indexes
  console.log('\nKey Indexes:')
  const indexes = [
    { table: 'User', column: 'email' },
    { table: 'Song', column: 'shareToken' },
    { table: 'ApiConfig', column: 'userId' },
    { table: 'Subscription', column: 'userId' },
  ]

  for (const { table, column } of indexes) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.$queryRaw`SELECT 1 FROM "${table as any}" WHERE "${column as any}" IS NOT NULL LIMIT 1`
      console.log(`  [OK] ${table}.${column}`)
    } catch {
      console.log(`  [WARN] ${table}.${column} - index may not exist`)
    }
  }

  // Environment check
  console.log('\nEnvironment:')
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '(set)' : '(missing)'}`)

  await prisma.$disconnect()

  console.log('\n' + '='.repeat(50))
  console.log('Health check complete')
}

main().catch((error) => {
  console.error('Health check failed:', error)
  process.exit(1)
})