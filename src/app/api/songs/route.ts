import { NextRequest, NextResponse } from "next/server"

// Shared global storage
declare global {
  var users: Map<string, any> | undefined
  var songs: Map<string, any> | undefined
  var adminLogs: Map<string, any> | undefined
}

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!
const songs = global.songs!

// Free tier limits
const FREE_DAILY_LIMIT = 3
const FREE_MONTHLY_LIMIT = 10

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function getOrCreateUser(userId: string, email?: string) {
  let user = users.get(userId)
  if (!user) {
    user = {
      id: userId,
      email: email || `${userId}@example.com`,
      name: email?.split('@')[0] || 'User',
      tier: 'FREE',
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: getDateKey(),
      monthlyResetAt: getMonthKey(),
    }
    users.set(userId, user)
  }
  return user
}

function checkAndResetUsage(user: any) {
  const today = getDateKey()
  const thisMonth = getMonthKey()

  if (user.dailyResetAt !== today) {
    user.dailyUsage = 0
    user.dailyResetAt = today
  }

  if (user.monthlyResetAt !== thisMonth) {
    user.monthlyUsage = 0
    user.monthlyResetAt = thisMonth
  }
}

function getSessionUser(request: NextRequest): any {
  // For demo, get user from cookie
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) {
    // Create demo user
    const demoUserId = 'demo-user'
    return getOrCreateUser(demoUserId, 'demo@taoybeats.com')
  }

  try {
    const payload = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
    return getOrCreateUser(payload.id, payload.email)
  } catch {
    return getOrCreateUser('demo-user')
  }
}

export async function GET(request: NextRequest) {
  const user = getSessionUser(request)
  const userSongs = Array.from(songs.values()).filter(s => s.userId === user.id)
  return NextResponse.json({ songs: userSongs })
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUser(request)
    const body = await request.json()
    const {
      title,
      lyrics,
      genre,
      mood,
      instruments,
      referenceSinger,
      referenceSong,
      userNotes,
      apiKey,
      apiUrl,
    } = body

    // Validation
    if (!title || !lyrics || !genre?.length || !mood) {
      return NextResponse.json(
        { error: "Missing required fields: title, lyrics, genre, mood" },
        { status: 400 }
      )
    }

    // Check usage limits
    checkAndResetUsage(user)

    if (user.tier === 'FREE') {
      if (user.dailyUsage >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `You've used all ${FREE_DAILY_LIMIT} free generations today. Upgrade to Pro for 50/day.`,
            daily: { used: user.dailyUsage, limit: FREE_DAILY_LIMIT },
            code: "DAILY_LIMIT_REACHED",
          },
          { status: 429 }
        )
      }

      if (user.monthlyUsage >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: "Monthly limit reached",
            message: `You've used all ${FREE_MONTHLY_LIMIT} free generations this month. Upgrade to Pro for unlimited.`,
            monthly: { used: user.monthlyUsage, limit: FREE_MONTHLY_LIMIT },
            code: "MONTHLY_LIMIT_REACHED",
          },
          { status: 429 }
        )
      }
    }

    // Increment usage
    user.dailyUsage++
    user.monthlyUsage++

    // Create song record
    const songId = crypto.randomUUID()
    const song = {
      id: songId,
      userId: user.id,
      title,
      lyrics,
      genre,
      mood,
      instruments: instruments || [],
      referenceSinger,
      referenceSong,
      userNotes,
      status: "GENERATING",
      audioUrl: null,
      shareToken: crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    }

    songs.set(songId, song)

    // Start generation in background
    generateMusic(songId, song, apiKey, apiUrl).catch(console.error)

    return NextResponse.json({
      id: songId,
      shareToken: song.shareToken,
      status: "GENERATING",
      usage: {
        daily: { used: user.dailyUsage, limit: FREE_DAILY_LIMIT },
        monthly: { used: user.monthlyUsage, limit: FREE_MONTHLY_LIMIT },
      },
    })
  } catch (error) {
    console.error("Error creating song:", error)
    return NextResponse.json(
      { error: "Failed to create song" },
      { status: 500 }
    )
  }
}

async function generateMusic(
  songId: string,
  song: any,
  apiKey?: string,
  apiUrl?: string
) {
  try {
    // Update to generating
    songs.set(songId, { ...song, status: "GENERATING" })

    // Simulate MiniMax API call
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate completion
    songs.set(songId, {
      ...song,
      status: "COMPLETED",
      audioUrl: "/sample-audio.mp3",
    })
  } catch (error) {
    console.error("Generation error:", error)
    songs.set(songId, {
      ...song,
      status: "FAILED",
      error: "Generation failed",
    })
  }
}
