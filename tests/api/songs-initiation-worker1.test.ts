/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/r2-storage", () => ({
  uploadAudioFromUrl: vi.fn(async (_audioUrl: string, songId: string) => `https://r2.example/${songId}.mp3`),
}))

import { POST as createSong } from "@/app/api/songs/route"
import { musicProvider } from "@/lib/ai-providers"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { uploadAudioFromUrl } from "@/lib/r2-storage"

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

  it("returns COMPLETED with persisted audio when the provider completes synchronously", async () => {
    vi.useFakeTimers()
    vi.spyOn(musicProvider, "generate").mockResolvedValueOnce("audio:https://cdn.minimax.example/immediate.mp3")
    vi.mocked(uploadAudioFromUrl).mockResolvedValueOnce("https://r2.example/immediate.mp3")

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
    expect(data.audioUrl).toBe("https://r2.example/immediate.mp3")

    const song = global.songs?.get(data.id) as any
    expect(song.status).toBe("COMPLETED")
    expect(song.audioUrl).toBe("https://r2.example/immediate.mp3")
    expect(song.providerTaskId).toBeUndefined()
    expect(uploadAudioFromUrl).toHaveBeenCalledWith("https://cdn.minimax.example/immediate.mp3", data.id)
  })

  it("compresses long lyrics and persists a single provider task id for single-pass generation", async () => {
    vi.spyOn(musicProvider, "generate").mockResolvedValueOnce("task-single-pass")

    const sessionToken = createTestSessionToken("worker1-multipart-user", "worker1-multipart@example.com")
    const longLyrics = Array.from({ length: 120 }, (_, index) => `Line ${index + 1} should be compressed for single-pass generation.`).join("\n")
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
      reason: "lyrics_too_long",
    })

    const createdSong = global.songs?.get(data.id) as any

    expect(createdSong.status).toBe("GENERATING")
    expect(createdSong.providerTaskId).toBe("task-single-pass")
    expect(createdSong.partGroupId).toBeUndefined()
    expect(vi.mocked(musicProvider.generate).mock.calls).toHaveLength(1)
  })
})
