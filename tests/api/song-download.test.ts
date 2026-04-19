/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET as downloadSong } from "@/app/api/songs/[id]/download/route"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"

function createMockNextRequest(
  url: string,
  options: {
    cookies?: { name: string; value: string }[]
  } = {}
): Request & {
  cookies: { get: (name: string) => { value: string } | undefined }
  nextUrl: URL
} {
  const cookieHeader = options.cookies
    ? options.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    : ""

  const request = new Request(url, {
    method: "GET",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  }) as Request & {
    cookies: { get: (name: string) => { value: string } | undefined }
    nextUrl: URL
  }

  const cookieMap = new Map<string, string>()
  options.cookies?.forEach((cookie) => cookieMap.set(cookie.name, cookie.value))

  request.cookies = {
    get: (name: string) => {
      const value = cookieMap.get(name)
      return value ? { value } : undefined
    },
  }
  request.nextUrl = new URL(url)

  return request
}

describe("Song download API", () => {
  beforeEach(() => {
    if (global.songs) {
      global.songs.clear()
    }
    vi.unstubAllGlobals()
  })

  it("allows downloading a shared song without authentication when a valid shareToken is provided", async () => {
    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: "song-1",
      title: "Shared Song",
      audioUrl: "https://cdn.example.com/shared-song.mp3",
      userId: "owner-1",
      shareToken: "share123",
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("audio").buffer,
        headers: new Headers({
          "content-type": "audio/mpeg",
        }),
      })
    )

    const response = await downloadSong(
      createMockNextRequest("http://localhost:3000/api/songs/song-1/download?shareToken=share123") as any,
      {
        params: Promise.resolve({ id: "song-1" }),
      }
    )

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith("https://cdn.example.com/shared-song.mp3")
    expect(response.headers.get("content-disposition")).toContain("Shared_Song")
  })

  it("rejects unauthenticated downloads when no valid share token is provided", async () => {
    const response = await downloadSong(
      createMockNextRequest("http://localhost:3000/api/songs/song-1/download") as any,
      {
        params: Promise.resolve({ id: "song-1" }),
      }
    )

    expect(response.status).toBe(401)
  })

  it("still allows the owner to download a private song", async () => {
    const sessionToken = createSessionToken({
      id: "owner-1",
      email: "owner@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: "song-1",
      title: "Private Song",
      audioUrl: "https://cdn.example.com/private-song.mp3",
      userId: "owner-1",
      shareToken: null,
    } as any)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("audio").buffer,
        headers: new Headers({
          "content-type": "audio/mpeg",
        }),
      })
    )

    const response = await downloadSong(
      createMockNextRequest("http://localhost:3000/api/songs/song-1/download", {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      {
        params: Promise.resolve({ id: "song-1" }),
      }
    )

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith("https://cdn.example.com/private-song.mp3")
  })
})
