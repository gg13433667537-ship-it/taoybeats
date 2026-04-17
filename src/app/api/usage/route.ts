import { NextRequest, NextResponse } from "next/server"

// In-memory usage tracking (replace with Redis/DB in production)
const dailyUsage: Map<string, number> = new Map()
const monthlyUsage: Map<string, number> = new Map()
const lastReset: Map<string, string> = new Map()

function getDateKey(): string {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function checkAndReset(userId: string): { daily: number; monthly: number } {
  const dateKey = getDateKey()
  const monthKey = getMonthKey()

  const lastDateKey = lastReset.get(`daily:${userId}`)
  const lastMonthKey = lastReset.get(`monthly:${userId}`)

  // Reset daily if new day
  if (lastDateKey !== dateKey) {
    dailyUsage.set(userId, 0)
    lastReset.set(`daily:${userId}`, dateKey)
  }

  // Reset monthly if new month
  if (lastMonthKey !== monthKey) {
    monthlyUsage.set(userId, 0)
    lastReset.set(`monthly:${userId}`, monthKey)
  }

  return {
    daily: dailyUsage.get(userId) || 0,
    monthly: monthlyUsage.get(userId) || 0,
  }
}

export async function GET(request: NextRequest) {
  // For demo, use a fixed user ID
  // In production, get from session/JWT
  const userId = request.cookies.get('user-id')?.value || 'demo-user'
  const tier = (request.nextUrl.searchParams.get('tier') as 'FREE' | 'PRO') || 'FREE'

  const { daily, monthly } = checkAndReset(userId)

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
  // Increment usage
  const userId = request.cookies.get('user-id')?.value || 'demo-user'

  const { daily, monthly } = checkAndReset(userId)

  // Check limits
  const tier = (await request.clone().json()).tier as 'FREE' | 'PRO' || 'FREE'
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

  // Increment
  dailyUsage.set(userId, daily + 1)
  monthlyUsage.set(userId, monthly + 1)

  return NextResponse.json({
    success: true,
    daily: dailyUsage.get(userId),
    monthly: monthlyUsage.get(userId),
  })
}
