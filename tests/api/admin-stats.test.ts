/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET as getAdminStats } from "@/app/api/admin/stats/route"
import { createSessionToken } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"

function createMockNextRequest(
  url: string,
  sessionToken?: string
): Request & {
  cookies: { get: (name: string) => { value: string } | undefined }
} {
  const cookieHeader = sessionToken ? { Cookie: `session-token=${sessionToken}` } : undefined
  const request = new Request(url, {
    method: "GET",
    headers: cookieHeader,
  }) as Request & {
    cookies: { get: (name: string) => { value: string } | undefined }
  }

  request.cookies = {
    get: (name: string) => {
      if (name !== "session-token" || !sessionToken) return undefined
      return { value: sessionToken }
    },
  }

  return request
}

describe("Admin stats API", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.count).mockReset()
    vi.mocked(prisma.song.count).mockReset()
    vi.mocked(prisma.adminLog.findMany).mockReset()
  })

  it("reads dashboard stats from Prisma and reports successful song counts", async () => {
    const adminSession = createSessionToken({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)

    vi.mocked(prisma.song.count)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(11)

    vi.mocked(prisma.adminLog.findMany).mockResolvedValue([
      {
        id: "log-1",
        adminId: "admin-1",
        adminEmail: "admin@example.com",
        action: "UPDATE_USER",
        targetId: "user-1",
        targetType: "USER",
        details: { tier: "PRO" },
        createdAt: new Date("2026-04-19T08:00:00.000Z"),
      },
    ] as any)

    const response = await getAdminStats(
      createMockNextRequest("http://localhost:3000/api/admin/stats", adminSession) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toEqual({
      total: 5,
      active: 4,
      admins: 1,
      pro: 2,
    })
    expect(data.songs.total).toBe(9)
    expect(data.songs.byStatus).toEqual({
      PENDING: 1,
      GENERATING: 2,
      COMPLETED: 6,
      FAILED: 0,
    })
    expect(data.songs.successfulToday).toBe(4)
    expect(data.songs.successfulThisMonth).toBe(11)
    expect(data.logs).toHaveLength(1)
  })
})
