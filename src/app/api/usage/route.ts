import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, rateLimitMiddleware, DEFAULT_RATE_LIMIT } from "@/lib/security"
import { prisma } from "@/lib/db"

function getDateKey(): string {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function getStartOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function getStartOfMonth(): Date {
  const date = getStartOfToday()
  date.setDate(1)
  return date
}

// Global in-memory fallback for demo users
function getUsersMap(): Map<string, unknown> {
  if (typeof global.users === 'undefined') global.users = new Map()
  return global.users
}

async function getUserUsageFromDB(userId: string, email?: string): Promise<{ daily: number; monthly: number; tier: string; role: string }> {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  // Try database first
  try {
    // Get or create user record in DB using upsert for atomic operation
    let user = await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: email || null,
        name: email?.split('@')[0] || 'User',
        tier: 'FREE',
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: today,
        monthlyResetAt: thisMonth,
      },
      update: {},
    })
    console.log(`[getUserUsageFromDB] DB lookup success for userId: ${userId}, tier: ${user.tier}`)

    // Check if we need to reset daily usage
    if (user.dailyResetAt !== today) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          dailyUsage: 0,
          dailyResetAt: today,
        },
      })
    }

    // Check if we need to reset monthly usage
    if (user.monthlyResetAt !== thisMonth) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          monthlyUsage: 0,
          monthlyResetAt: thisMonth,
        },
      })
    }

    // Update in-memory cache
    const memoryUser = {
      id: user.id,
      email: user.email || email || `${user.id}@local`,
      name: user.name || email?.split('@')[0] || 'User',
      role: user.role as 'USER' | 'PRO' | 'ADMIN',
      tier: user.tier as 'FREE' | 'PRO',
      isActive: true,
      dailyUsage: user.dailyUsage,
      monthlyUsage: user.monthlyUsage,
      dailyResetAt: user.dailyResetAt || today,
      monthlyResetAt: user.monthlyResetAt || thisMonth,
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    }
    getUsersMap().set(memoryUser.id, memoryUser)
    getUsersMap().set(memoryUser.email, memoryUser)

    return {
      daily: user.dailyUsage,
      monthly: user.monthlyUsage,
      tier: user.tier,
      role: user.role,
    }
  } catch (dbError) {
    console.error("[getUserUsageFromDB] Database error, falling back to memory:", dbError)
    // Fallback to in-memory storage
    const usersMap = getUsersMap()
    const existingUser = usersMap.get(userId) || (email ? usersMap.get(email) : undefined)
    const memoryUser = (existingUser as {
      id: string
      email: string
      name: string
      role: string
      tier: string
      dailyUsage: number
      monthlyUsage: number
      dailyResetAt: string
      monthlyResetAt: string
      createdAt: string
    } | undefined) || {
      id: userId,
      email: email || `${userId}@local`,
      name: email?.split('@')[0] || 'User',
      role: 'USER',
      tier: 'FREE',
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: today,
      monthlyResetAt: thisMonth,
      createdAt: new Date().toISOString(),
    }

    // Reset usage if needed
    if (memoryUser.dailyResetAt !== today) {
      memoryUser.dailyUsage = 0
      memoryUser.dailyResetAt = today
    }
    if (memoryUser.monthlyResetAt !== thisMonth) {
      memoryUser.monthlyUsage = 0
      memoryUser.monthlyResetAt = thisMonth
    }

    usersMap.set(memoryUser.id, memoryUser)
    usersMap.set(memoryUser.email, memoryUser)

    return {
      daily: memoryUser.dailyUsage,
      monthly: memoryUser.monthlyUsage,
      tier: memoryUser.tier,
      role: memoryUser.role,
    }
  }
}

async function getSuccessfulSongCounts(userId: string): Promise<{ successfulToday: number; successfulThisMonth: number }> {
  const startOfToday = getStartOfToday()
  const startOfMonth = getStartOfMonth()

  const [successfulToday, successfulThisMonth] = await Promise.all([
    prisma.song.count({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: startOfToday },
      },
    }),
    prisma.song.count({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth },
      },
    }),
  ])

  return {
    successfulToday,
    successfulThisMonth,
  }
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "usage")
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Get user ID from session token
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid session' }, { status: 401 }))
  }

  const userId = payload.id
  console.log(`[USAGE API GET] Session verified - payload.id: ${payload.id}, payload.email: ${payload.email}`)
  if (!userId) {
    console.error(`[USAGE API GET] ERROR: No userId in session payload!`)
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  // Fetch user usage from Prisma database
  let usage
  try {
    usage = await getUserUsageFromDB(userId, payload.email)
    console.log(`[USAGE API GET] userId: ${userId}, tier from DB: ${usage.tier}`)
  } catch (dbError) {
    console.error("Prisma lookup failed:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  let output
  try {
    output = await getSuccessfulSongCounts(userId)
  } catch (dbError) {
    console.error("Failed to count successful songs:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  const tier = usage.tier || 'FREE'
  console.log(`[USAGE API GET] Final tier for userId ${userId}: ${tier}`)

  // Calculate limits based on tier and role - ADMIN and PRO have unlimited access
  const isUnlimited = tier === 'PRO' || usage.role === 'ADMIN'
  const limits = isUnlimited
    ? { dailyLimit: null, monthlyLimit: null }
    : { dailyLimit: 3, monthlyLimit: 10 }

  return applySecurityHeaders(NextResponse.json({
    userId,
    tier,
    daily: {
      used: usage.daily,
      limit: limits.dailyLimit,
      remaining: limits.dailyLimit === null ? null : Math.max(0, limits.dailyLimit - usage.daily),
      unlimited: isUnlimited,
    },
    monthly: {
      used: usage.monthly,
      limit: limits.monthlyLimit,
      remaining: limits.monthlyLimit === null ? null : Math.max(0, limits.monthlyLimit - usage.monthly),
      unlimited: isUnlimited,
    },
    output,
  }))
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "usage")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  // Get user ID from session token
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid session' }, { status: 401 }))
  }

  const userId = payload.id || payload.email
  const userEmail = payload.email
  if (!userId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid session' }, { status: 401 }))
  }

  // Fetch user usage from Prisma database
  let usage
  try {
    usage = await getUserUsageFromDB(userId, userEmail)
  } catch (dbError) {
    console.error("Prisma lookup failed:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  const tier = usage.tier || 'FREE'
  const { daily, monthly } = usage

  // PRO and ADMIN have unlimited access - skip limit checks entirely
  const isUnlimited = tier === 'PRO' || usage.role === 'ADMIN'

  if (!isUnlimited) {
    const dailyLimit = 3
    const monthlyLimit = 10

    if (daily >= dailyLimit) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Daily limit reached', daily, monthly, limit: dailyLimit },
        { status: 429 }
      ))
    }

    if (monthly >= monthlyLimit) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Monthly limit reached', daily, monthly, limit: monthlyLimit },
        { status: 429 }
      ))
    }
  }

  // Increment usage in database
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyUsage: { increment: 1 },
        monthlyUsage: { increment: 1 },
      },
    })
  } catch (dbError) {
    console.error("Failed to increment usage:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    daily: daily + 1,
    monthly: monthly + 1,
  }))
}
