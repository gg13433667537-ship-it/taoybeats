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

async function getUserUsageFromDB(userId: string): Promise<{ daily: number; monthly: number; tier: string; role: string }> {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  // Get or create user record in DB
  let user = await prisma.user.findUnique({ where: { id: userId } })
  console.log(`[getUserUsageFromDB] Looking up userId: ${userId}, found: ${user ? 'yes' : 'no'}, tier: ${user?.tier}`)

  if (!user) {
    // Create user if doesn't exist - THIS IS THE BUG! If user exists in Prisma but with different id...
    console.log(`[getUserUsageFromDB] User not found, creating new user with tier=FREE for userId: ${userId}`)
    // Create user if doesn't exist
    user = await prisma.user.create({
      data: {
        id: userId,
        tier: 'FREE',
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyResetAt: today,
        monthlyResetAt: thisMonth,
      },
    })
  }

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

  return {
    daily: user.dailyUsage,
    monthly: user.monthlyUsage,
    tier: user.tier,
    role: user.role,
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
    // Return graceful degradation for unauthenticated requests instead of 401
    return applySecurityHeaders(NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    }))
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    // Return graceful degradation for invalid session instead of 401
    return applySecurityHeaders(NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    }))
  }

  const userId = payload.id
  console.log(`[USAGE API GET] Session verified - payload.id: ${payload.id}, payload.email: ${payload.email}`)
  if (!userId) {
    console.error(`[USAGE API GET] ERROR: No userId in session payload!`)
    // Return graceful degradation for missing user ID instead of 401
    return applySecurityHeaders(NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    }))
  }

  // Fetch user usage from Prisma database
  let usage
  try {
    usage = await getUserUsageFromDB(userId)
    console.log(`[USAGE API GET] userId: ${userId}, tier from DB: ${usage.tier}`)
  } catch (dbError) {
    console.error("Prisma lookup failed:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  const tier = usage.tier || 'FREE'
  console.log(`[USAGE API GET] Final tier for userId ${userId}: ${tier}`)

  // Calculate limits based on tier and role - ADMIN and PRO have unlimited access
  const limits = (tier === 'PRO' || usage.role === 'ADMIN')
    ? { dailyLimit: -1, monthlyLimit: -1 }
    : { dailyLimit: 3, monthlyLimit: 10 }

  return applySecurityHeaders(NextResponse.json({
    userId,
    tier,
    daily: {
      used: usage.daily,
      limit: limits.dailyLimit,
      remaining: Math.max(0, limits.dailyLimit - usage.daily),
    },
    monthly: {
      used: usage.monthly,
      limit: limits.monthlyLimit,
      remaining: limits.monthlyLimit === -1 ? -1 : Math.max(0, limits.monthlyLimit - usage.monthly),
    },
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
  if (!userId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid session' }, { status: 401 }))
  }

  // Fetch user usage from Prisma database
  let usage
  try {
    usage = await getUserUsageFromDB(userId)
  } catch (dbError) {
    console.error("Prisma lookup failed:", dbError)
    return applySecurityHeaders(NextResponse.json({ error: 'Database error' }, { status: 500 }))
  }

  const tier = usage.tier || 'FREE'
  const { daily, monthly } = usage

  // Calculate limits based on tier and role - ADMIN and PRO have unlimited access
  const limits = (tier === 'PRO' || usage.role === 'ADMIN')
    ? { dailyLimit: -1, monthlyLimit: -1 }
    : { dailyLimit: 3, monthlyLimit: 10 }

  if (daily >= limits.dailyLimit) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Daily limit reached', daily, monthly, limit: limits.dailyLimit },
      { status: 429 }
    ))
  }

  if (limits.monthlyLimit !== -1 && monthly >= limits.monthlyLimit) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Monthly limit reached', daily, monthly, limit: limits.monthlyLimit },
      { status: 429 }
    ))
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
