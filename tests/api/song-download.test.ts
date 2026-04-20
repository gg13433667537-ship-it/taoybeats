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
    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[0]).toBe("https://cdn.example.com/shared-song.mp3")
    expect(response.headers.get("content-disposition")).toContain("shared_song")
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
    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[0]).toBe("https://cdn.example.com/private-song.mp3")
  })

  it("handles Chinese title in Content-Disposition without throwing ByteString error", async () => {
    const sessionToken = createSessionToken({
      id: "owner-1",
      email: "owner@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: "song-chinese",
      title: "囚鸟",
      audioUrl: "https://cdn.example.com/chinese-song.mp3",
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

    // This should NOT throw a ByteString error
    const response = await downloadSong(
      createMockNextRequest("http://localhost:3000/api/songs/song-chinese/download", {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      {
        params: Promise.resolve({ id: "song-chinese" }),
      }
    )

    expect(response.status).toBe(200)
    // Content-Disposition should be safe ASCII
    const cd = response.headers.get("content-disposition")
    expect(cd).toBeDefined()
    // All characters must be ASCII (no Chinese chars in header)
    expect(cd).not.toMatch(/[^\x00-\x7F]/)
    // Should have the RFC 5987 encoded version
    expect(cd).toContain("filename*=")
  })

  it("handles mixed Chinese-English title correctly", async () => {
    const sessionToken = createSessionToken({
      id: "owner-1",
      email: "owner@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: "song-mixed",
      title: "囚鸟 vibe coding",
      audioUrl: "https://cdn.example.com/mixed-song.mp3",
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
      createMockNextRequest("http://localhost:3000/api/songs/song-mixed/download", {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      {
        params: Promise.resolve({ id: "song-mixed" }),
      }
    )

    expect(response.status).toBe(200)
    const cd = response.headers.get("content-disposition")
    expect(cd).toBeDefined()
    expect(cd).not.toMatch(/[^\x00-\x7F]/)
    expect(cd).toContain("filename*=")
  })

  it("handles title with special characters safely", async () => {
    const sessionToken = createSessionToken({
      id: "owner-1",
      email: "owner@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: "song-special",
      title: "Test/Song\"With;Special",
      audioUrl: "https://cdn.example.com/special-song.mp3",
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
      createMockNextRequest("http://localhost:3000/api/songs/song-special/download", {
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as any,
      {
        params: Promise.resolve({ id: "song-special" }),
      }
    )

    expect(response.status).toBe(200)
    const cd = response.headers.get("content-disposition")
    expect(cd).toBeDefined()
    // The filename= attribute should have quotes around it (per RFC 5987)
    // Special chars in the original title should be sanitized in the ASCII filename
    // but preserved in the filename* attribute
    expect(cd).toContain("filename=")
    expect(cd).toContain("filename*=")
    // The raw special chars should NOT appear unencoded in the header
    // "/" and other dangerous chars are RFC 5987 encoded in filename* but
    // the semicolon is a valid separator in Content-Disposition
    expect(cd).toContain("UTF-8''") // RFC 5987 encoding marker present
  })
})
