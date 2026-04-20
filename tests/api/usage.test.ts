/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET as getUsage } from "@/app/api/usage/route"
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

describe("Usage API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns explicit unlimited flags and successful output counters for unlimited users", async () => {
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)

    // Set up findUnique to return admin user with PRO tier
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      tier: "PRO",
      dailyUsage: 2,
      monthlyUsage: 8,
      dailyResetAt: today,
      monthlyResetAt: thisMonth,
    } as any)

    // Mock update to return user with updated dates (not needed for this test but avoids errors)
    vi.mocked(prisma.user.update).mockImplementation(async ({ where, data }: any) => {
      return {
        id: where.id,
        role: data.role || "ADMIN",
        tier: data.tier || "PRO",
        dailyUsage: data.dailyUsage ?? 2,
        monthlyUsage: data.monthlyUsage ?? 8,
        dailyResetAt: data.dailyResetAt || today,
        monthlyResetAt: data.monthlyResetAt || thisMonth,
      } as any
    })

    // Mock song.count for successful output
    vi.mocked(prisma.song.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(11)

    const sessionToken = createSessionToken({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    } as any)

    const response = await getUsage(
      createMockNextRequest("http://localhost:3000/api/usage", sessionToken) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.daily).toMatchObject({
      used: 2,
      limit: null,
      remaining: null,
      unlimited: true,
    })
    expect(data.monthly).toMatchObject({
      used: 8,
      limit: null,
      remaining: null,
      unlimited: true,
    })
    expect(data.output).toEqual({
      successfulToday: 4,
      successfulThisMonth: 11,
    })
  })

  it("returns remaining quota plus successful output counters for limited users", async () => {
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)

    // Set up findUnique to return free tier user
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "USER",
      tier: "FREE",
      dailyUsage: 1,
      monthlyUsage: 3,
      dailyResetAt: today,
      monthlyResetAt: thisMonth,
    } as any)

    // Mock update to return user with updated dates
    vi.mocked(prisma.user.update).mockImplementation(async ({ where, data }: any) => {
      return {
        id: where.id,
        role: data.role || "USER",
        tier: data.tier || "FREE",
        dailyUsage: data.dailyUsage ?? 1,
        monthlyUsage: data.monthlyUsage ?? 3,
        dailyResetAt: data.dailyResetAt || today,
        monthlyResetAt: data.monthlyResetAt || thisMonth,
      } as any
    })

    // Mock song.count for successful output
    vi.mocked(prisma.song.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)

    const sessionToken = createSessionToken({
      id: "user-1",
      email: "user@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    } as any)

    const response = await getUsage(
      createMockNextRequest("http://localhost:3000/api/usage", sessionToken) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.daily).toMatchObject({
      used: 1,
      limit: 3,
      remaining: 2,
      unlimited: false,
    })
    expect(data.monthly).toMatchObject({
      used: 3,
      limit: 10,
      remaining: 7,
      unlimited: false,
    })
    expect(data.output).toEqual({
      successfulToday: 1,
      successfulThisMonth: 3,
    })
  })
})
