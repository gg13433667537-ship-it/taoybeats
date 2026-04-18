import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


if (!global.users) global.users = new Map()

const users = global.users!

function getDateKey(): string {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function getUserUsage(user: User): { daily: number; monthly: number } {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  // Reset if needed
  if (user.dailyResetAt !== today) {
    user.dailyUsage = 0
    user.dailyResetAt = today
  }

  if (user.monthlyResetAt !== thisMonth) {
    user.monthlyUsage = 0
    user.monthlyResetAt = thisMonth
  }

  return {
    daily: user.dailyUsage,
    monthly: user.monthlyUsage,
  }
}

export async function GET(request: NextRequest) {
  // Get user ID from session token
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    // Return graceful degradation for unauthenticated requests instead of 401
    return NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    })
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    // Return graceful degradation for invalid session instead of 401
    return NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    })
  }

  const userId = payload.id || payload.email
  if (!userId) {
    // Return graceful degradation for missing user ID instead of 401
    return NextResponse.json({
      userId: null,
      tier: 'GUEST',
      daily: { used: 0, limit: 0, remaining: 0 },
      monthly: { used: 0, limit: 0, remaining: 0 },
    })
  }

  const user = users.get(userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const tier = user.tier || 'FREE'
  const { daily, monthly } = getUserUsage(user)

  // Calculate limits based on tier
  const limits = tier === 'PRO'
    ? { dailyLimit: 50, monthlyLimit: -1 }
    : { dailyLimit: 3, monthlyLimit: 10 }

  return NextResponse.json({
    userId,
    tier,
    daily: {
      used: daily,
      limit: limits.dailyLimit,
      remaining: Math.max(0, limits.dailyLimit - daily),
    },
    monthly: {
      used: monthly,
      limit: limits.monthlyLimit,
      remaining: limits.monthlyLimit === -1 ? -1 : Math.max(0, limits.monthlyLimit - monthly),
    },
  })
}

export async function POST(request: NextRequest) {
  // Get user ID from session token
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const userId = payload.id || payload.email
  if (!userId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const user = users.get(userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const tier = user.tier || 'FREE'
  const { daily, monthly } = getUserUsage(user)

  // Calculate limits based on tier
  const limits = tier === 'PRO'
    ? { dailyLimit: 50, monthlyLimit: -1 }
    : { dailyLimit: 3, monthlyLimit: 10 }

  if (daily >= limits.dailyLimit) {
    return NextResponse.json(
      { error: 'Daily limit reached', daily, monthly, limit: limits.dailyLimit },
      { status: 429 }
    )
  }

  if (limits.monthlyLimit !== -1 && monthly >= limits.monthlyLimit) {
    return NextResponse.json(
      { error: 'Monthly limit reached', daily, monthly, limit: limits.monthlyLimit },
      { status: 429 }
    )
  }

  // Increment using global.users (synchronized with songs route)
  user.dailyUsage++
  user.monthlyUsage++
  users.set(userId, user)

  return NextResponse.json({
    success: true,
    daily: user.dailyUsage,
    monthly: user.monthlyUsage,
  })
}
