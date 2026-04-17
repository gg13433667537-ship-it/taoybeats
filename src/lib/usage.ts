// User tier and usage management

export type UserTier = 'FREE' | 'PRO'

export type UsageLimits = {
  dailyLimit: number
  monthlyLimit: number
  canDownload: boolean
  canShare: boolean
  priorityQueue: boolean
}

// Free tier limits
export const FREE_LIMITS: UsageLimits = {
  dailyLimit: 3,
  monthlyLimit: 10,
  canDownload: true,
  canShare: true,
  priorityQueue: false,
}

// Pro tier limits
export const PRO_LIMITS: UsageLimits = {
  dailyLimit: 50,
  monthlyLimit: -1, // unlimited
  canDownload: true,
  canShare: true,
  priorityQueue: true,
}

// Get limits by tier
export function getLimits(tier: UserTier): UsageLimits {
  return tier === 'PRO' ? PRO_LIMITS : FREE_LIMITS
}

// Check if user can generate
export function canGenerate(
  tier: UserTier,
  todayUsage: number,
  monthlyUsage: number
): { allowed: boolean; reason?: string } {
  const limits = getLimits(tier)

  if (todayUsage >= limits.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${limits.dailyLimit}/day). Upgrade to Pro for more.`,
    }
  }

  if (limits.monthlyLimit !== -1 && monthlyUsage >= limits.monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${limits.monthlyLimit}/month). Upgrade to Pro for unlimited.`,
    }
  }

  return { allowed: true }
}

// Get remaining usage
export function getRemainingUsage(
  tier: UserTier,
  todayUsage: number,
  monthlyUsage: number
) {
  const limits = getLimits(tier)

  return {
    daily: {
      used: todayUsage,
      limit: limits.dailyLimit,
      remaining: Math.max(0, limits.dailyLimit - todayUsage),
    },
    monthly: {
      used: monthlyUsage,
      limit: limits.monthlyLimit,
      remaining: limits.monthlyLimit === -1 ? -1 : Math.max(0, limits.monthlyLimit - monthlyUsage),
    },
  }
}
