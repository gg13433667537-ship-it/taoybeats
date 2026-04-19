/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as playlistSongsRoute from "@/app/api/playlists/[id]/songs/route"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"

function createMockNextRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    cookies?: { name: string; value: string }[]
  } = {}
): Request & {
  cookies: { get: (name: string) => { value: string } | undefined }
} {
  const cookieHeader = options.cookies
    ? options.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    : ""

  const request = new Request(url, {
    method: options.method || "GET",
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }) as Request & {
    cookies: { get: (name: string) => { value: string } | undefined }
  }

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

describe("Playlist songs API", () => {
  const sessionToken = createSessionToken({
    id: "user-1",
    email: "user@example.com",
    role: "USER",
    createdAt: new Date().toISOString(),
  } as any)

  const playlistId = "123e4567-e89b-12d3-a456-426614174000"
  const songId = "123e4567-e89b-12d3-a456-426614174001"

  beforeEach(() => {
    if (global.playlists) {
      global.playlists.clear()
    }
    if (global.songs) {
      global.songs.clear()
    }

    global.playlists?.set(playlistId, {
      id: playlistId,
      userId: "user-1",
      songIds: [songId],
      name: "Night Mix",
      description: "",
      isPublic: false,
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    })
  })

  it("returns detailed playlist songs from Prisma when song ids are not present in global cache", async () => {
    vi.mocked(prisma.song.findMany).mockResolvedValue([
      {
        id: songId,
        title: "Night Drive",
        status: "COMPLETED",
        audioUrl: "https://cdn.example.com/night-drive.mp3",
        userId: "user-1",
        genre: ["Synthwave"],
        instruments: [],
        createdAt: new Date("2026-04-19T00:00:00.000Z"),
        updatedAt: new Date("2026-04-19T00:00:00.000Z"),
      },
    ] as any)

    const response = await playlistSongsRoute.GET(
      createMockNextRequest(`http://localhost:3000/api/playlists/${playlistId}/songs`, {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      { params: Promise.resolve({ id: playlistId }) }
    )

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.song.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [songId] } },
      })
    )
    expect(data).toMatchObject({
      songs: [
        expect.objectContaining({
          id: songId,
          title: "Night Drive",
        }),
      ],
    })
  })

  it("allows adding a persisted db-backed song to a playlist after refresh", async () => {
    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: songId,
      title: "Night Drive",
      status: "COMPLETED",
      userId: "user-1",
      createdAt: new Date("2026-04-19T00:00:00.000Z"),
      updatedAt: new Date("2026-04-19T00:00:00.000Z"),
    } as any)

    global.playlists?.set(playlistId, {
      ...(global.playlists?.get(playlistId) as any),
      songIds: [],
    })

    const response = await playlistSongsRoute.POST(
      createMockNextRequest(`http://localhost:3000/api/playlists/${playlistId}/songs`, {
        method: "POST",
        body: { songId },
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      { params: Promise.resolve({ id: playlistId }) }
    )

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.playlist.songIds).toContain(songId)
  })
})
