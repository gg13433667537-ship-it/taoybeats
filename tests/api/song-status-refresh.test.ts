/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET as getSong } from "@/app/api/songs/[id]/route"
import { GET as streamSong } from "@/app/api/songs/[id]/stream/route"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"

function createMockRequest(url: string): Request {
  return new Request(url, { method: "GET" })
}

function createMockNextRequest(
  url: string,
  options: {
    cookies?: { name: string; value: string }[]
  } = {}
): Request & { cookies: { get: (name: string) => { value: string } | undefined } } {
  const cookieHeader = options.cookies
    ? options.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    : ""

  const request = new Request(url, {
    method: "GET",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
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

function createDbSong(overrides: Record<string, unknown> = {}) {
  return {
    id: "song-1",
    title: "Refresh Test Song",
    lyrics: "Testing polling refresh",
    genre: ["pop"],
    mood: "hopeful",
    instruments: ["piano"],
    referenceSinger: null,
    referenceSong: null,
    userNotes: null,
    status: "GENERATING",
    moderationStatus: "APPROVED",
    audioUrl: null,
    coverUrl: null,
    shareToken: "share-1",
    userId: "user-1",
    partGroupId: null,
    part: 1,
    providerTaskId: "task-123",
    errorMessage: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

describe("Song status refresh", () => {
  beforeEach(() => {
    if (global.songs) {
      global.songs.clear()
    }

    process.env.MINIMAX_API_KEY = "test-api-key"
    process.env.MINIMAX_API_URL = "https://api.minimaxi.com"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("refreshes a generating song from MiniMax when GET /api/songs/[id] sees a persisted provider task id", async () => {
    const dbSong = createDbSong()

    vi.mocked(prisma.song.findUnique).mockResolvedValue(dbSong as any)
    vi.mocked(prisma.song.update).mockResolvedValue({
      ...dbSong,
      status: "COMPLETED",
      audioUrl: "https://cdn.minimax.example/song-1.mp3",
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 2,
            audio: "https://cdn.minimax.example/song-1.mp3",
          },
          base_resp: {
            status_code: 0,
            status_msg: "success",
          },
        }),
      })
    )

    const response = await getSong(createMockRequest("http://localhost:3000/api/songs/song-1") as any, {
      params: Promise.resolve({ id: "song-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prisma.song.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "song-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          audioUrl: "https://cdn.minimax.example/song-1.mp3",
        }),
      })
    )
    expect(data).toMatchObject({
      id: "song-1",
      status: "COMPLETED",
      audioUrl: "https://cdn.minimax.example/song-1.mp3",
    })
  })

  it("persists a useful provider failure message when GET /api/songs/[id] refreshes a failed task", async () => {
    const dbSong = createDbSong()

    vi.mocked(prisma.song.findUnique).mockResolvedValue(dbSong as any)
    vi.mocked(prisma.song.update).mockResolvedValue({
      ...dbSong,
      status: "FAILED",
      errorMessage: "MiniMax says the task failed",
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: -1,
            error: "MiniMax says the task failed",
          },
          base_resp: {
            status_code: 0,
            status_msg: "success",
          },
        }),
      })
    )

    const response = await getSong(createMockRequest("http://localhost:3000/api/songs/song-1") as any, {
      params: Promise.resolve({ id: "song-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.song.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "song-1" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "MiniMax says the task failed",
        }),
      })
    )
    expect(data).toMatchObject({
      id: "song-1",
      status: "FAILED",
      error: "MiniMax says the task failed",
    })
  })

  it("falls back to the persisted DB task id when the cached generating song is missing it", async () => {
    global.songs?.set("song-1", {
      id: "song-1",
      title: "Refresh Test Song",
      lyrics: "Testing polling refresh",
      genre: ["pop"],
      mood: "hopeful",
      instruments: ["piano"],
      isInstrumental: false,
      status: "GENERATING",
      moderationStatus: "APPROVED",
      userId: "user-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    })

    const dbSong = createDbSong()

    vi.mocked(prisma.song.findUnique).mockResolvedValue(dbSong as any)
    vi.mocked(prisma.song.update).mockResolvedValue({
      ...dbSong,
      status: "COMPLETED",
      audioUrl: "https://cdn.minimax.example/song-1.mp3",
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 2,
            audio: "https://cdn.minimax.example/song-1.mp3",
          },
          base_resp: {
            status_code: 0,
            status_msg: "success",
          },
        }),
      })
    )

    const response = await getSong(createMockRequest("http://localhost:3000/api/songs/song-1") as any, {
      params: Promise.resolve({ id: "song-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(data).toMatchObject({
      id: "song-1",
      status: "COMPLETED",
      audioUrl: "https://cdn.minimax.example/song-1.mp3",
    })
  })

  it("polls MiniMax from the SSE route and emits a completed event for a generating song with a provider task id", async () => {
    const dbSong = createDbSong()
    const sessionToken = createSessionToken({
      id: "user-1",
      email: "user-1@example.com",
      name: "User One",
      role: "USER",
      isActive: true,
      tier: "FREE",
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyResetAt: "2024-01-01",
      monthlyResetAt: "2024-01",
      createdAt: "2024-01-01T00:00:00.000Z",
    })

    vi.mocked(prisma.song.findUnique).mockResolvedValue(dbSong as any)
    vi.mocked(prisma.song.update).mockResolvedValue({
      ...dbSong,
      status: "COMPLETED",
      audioUrl: "https://cdn.minimax.example/song-1.mp3",
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 2,
            audio: "https://cdn.minimax.example/song-1.mp3",
          },
          base_resp: {
            status_code: 0,
            status_msg: "success",
          },
        }),
      })
    )

    const response = await streamSong(
      createMockNextRequest("http://localhost:3000/api/songs/song-1/stream", {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      { params: Promise.resolve({ id: "song-1" }) }
    )

    const body = await response.text()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(body).toContain('"status":"COMPLETED"')
    expect(body).toContain('"audioUrl":"https://cdn.minimax.example/song-1.mp3"')
  })
})
