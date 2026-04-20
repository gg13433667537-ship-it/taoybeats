/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock storage module - must be before any imports from the module
vi.mock("@/lib/storage", () => {
  return {
    isR2Configured: () => true,
    uploadAudioFromUrl: vi.fn((_url: string, songId: string) => {
      return Promise.resolve({
        r2Url: `https://r2.example/${songId}.mp3`,
        objectKey: `songs/${songId}.mp3`,
        size: 1024,
      })
    }),
  }
})

import { POST as createSong } from "@/app/api/songs/route"
import { musicProvider } from "@/lib/ai-providers"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { uploadAudioFromUrl } from "@/lib/storage"

function createMockNextRequest(
  url: string,
  body: unknown,
  options: {
    method?: string
    cookies?: { name: string; value: string }[]
    headers?: Record<string, string>
  } = {}
): Request {
  const cookieHeader = options.cookies
    ? options.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    : ""

  const request = new Request(url, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as Request & { cookies: { get: (name: string) => { value: string } | undefined } }

  const cookieMap = new Map<string, string>()
  options.cookies?.forEach((cookie) => cookieMap.set(cookie.name, cookie.value))
  request.cookies = {
    get: (name: string) => {
      const value = cookieMap.get(name)
      return value ? { value } : undefined
    },
  }

  return request
}

function createTestSessionToken(userId: string, email: string, role = "USER") {
  return createSessionToken({
    id: userId,
    email,
    name: "Test User",
    role,
    isActive: true,
    tier: "FREE",
    dailyUsage: 0,
    monthlyUsage: 0,
    dailyResetAt: new Date().toISOString().split("T")[0],
    monthlyResetAt: new Date().toISOString().slice(0, 7),
    createdAt: new Date().toISOString(),
  })
}

describe("POST /api/songs initiation flow", () => {
  beforeEach(() => {
    global.users?.clear()
    global.songs?.clear()

    process.env.MINIMAX_API_KEY = "test-api-key"
    process.env.MINIMAX_API_URL = "https://api.minimaxi.com"
    global.systemApiKey = process.env.MINIMAX_API_KEY
    global.systemApiUrl = process.env.MINIMAX_API_URL

    vi.mocked(uploadAudioFromUrl).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("returns GENERATING and persists providerTaskId before the create response ends", async () => {
    vi.spyOn(musicProvider, "generate").mockResolvedValueOnce("minimax-task-123")

    const sessionToken = createTestSessionToken("worker1-user", "worker1@example.com")
    const request = createMockNextRequest("http://localhost:3000/api/songs", {
      title: "Init Song",
      lyrics: "These lyrics should start a generation task.",
      genre: ["pop"],
      mood: "bright",
    }, {
      cookies: [{ name: "session-token", value: sessionToken }],
    })

    const response = await createSong(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe("GENERATING")

    const song = global.songs?.get(data.id) as any
    expect(song.status).toBe("GENERATING")
    expect(song.providerTaskId).toBe("minimax-task-123")
    expect(prisma.song.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: data.id },
      data: expect.objectContaining({
        status: "GENERATING",
        providerTaskId: "minimax-task-123",
      }),
    }))
    expect(uploadAudioFromUrl).not.toHaveBeenCalled()
  })

  it("returns COMPLETED with audio URL and queues background R2 upload when provider completes synchronously", async () => {
    vi.useFakeTimers()
    vi.spyOn(musicProvider, "generate").mockResolvedValueOnce("audio:https://cdn.minimax.example/immediate.mp3")
    // Note: uploadAudioFromUrl mock is set at module level in vi.mock()

    const sessionToken = createTestSessionToken("worker1-sync-user", "worker1-sync@example.com")
    const request = createMockNextRequest("http://localhost:3000/api/songs", {
      title: "Immediate Song",
      lyrics: "Immediate lyrics",
      genre: ["rock"],
      mood: "driving",
    }, {
      cookies: [{ name: "session-token", value: sessionToken }],
    })

    const response = await createSong(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe("COMPLETED")
    // R2 upload now completes synchronously before song is marked COMPLETED
    // audioUrl returns the R2 URL (permanent storage)
    expect(data.audioUrl).toMatch(/^https:\/\/r2\.example\/[a-f0-9-]+\.mp3$/)

    const song = global.songs?.get(data.id) as any
    expect(song.status).toBe("COMPLETED")
    expect(song.audioUrl).toMatch(/^https:\/\/r2\.example\/[a-f0-9-]+\.mp3$/)
    expect(song.providerTaskId).toBeUndefined()
    // uploadAudioFromUrl is called synchronously as part of song creation
    expect(uploadAudioFromUrl).toHaveBeenCalledWith("https://cdn.minimax.example/immediate.mp3", data.id)
  })

  it("compresses long lyrics and persists a single provider task id for single-pass generation", async () => {
    vi.spyOn(musicProvider, "generate").mockResolvedValueOnce("task-single-pass")

    const sessionToken = createTestSessionToken("worker1-multipart-user", "worker1-multipart@example.com")
    const longLyrics = Array.from({ length: 110 }, (_, index) => `Line ${index + 1} should compress for MiniMax limit.`).join("\n")
    const request = createMockNextRequest("http://localhost:3000/api/songs", {
      title: "Long Song",
      lyrics: longLyrics,
      genre: ["indie"],
      mood: "restless",
    }, {
      cookies: [{ name: "session-token", value: sessionToken }],
    })

    const response = await createSong(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.multiPart).toBeUndefined()
    expect(data.compression).toMatchObject({
      applied: true,
      reason: "lyrics_over_model_limit",
      maxLength: 3500,
    })

    const createdSong = global.songs?.get(data.id) as any

    expect(createdSong.status).toBe("GENERATING")
    expect(createdSong.providerTaskId).toBe("task-single-pass")
    expect(createdSong.originalLyrics).toBe(longLyrics)
    expect(createdSong.lyricsCompressionApplied).toBe(true)
    expect(createdSong.lyrics.length).toBeLessThanOrEqual(3500)
    expect(createdSong.lyrics.length).toBeGreaterThan(3200)
    expect(createdSong.partGroupId).toBeUndefined()
    expect(vi.mocked(musicProvider.generate).mock.calls).toHaveLength(1)
  })
})
