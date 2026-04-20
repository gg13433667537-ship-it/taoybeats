import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createSessionToken } from "@/lib/auth-utils"

function createMockNextRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
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
    method: options.method || "POST",
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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

describe("stripe checkout env handling", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 503 when stripe server config is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "")

    const { POST } = await import("@/app/api/stripe/checkout/route")
    const sessionToken = createSessionToken({
      id: "user-1",
      email: "user@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    })

    const response = await POST(
      createMockNextRequest("http://localhost:3000/api/stripe/checkout", {
        body: { priceId: "price_123456789012345678901234" },
        cookies: [{ name: "session-token", value: sessionToken }],
      }) as Request
    )

    const data = await response.json()
    expect(response.status).toBe(503)
    expect(data.error).toMatch(/billing is not configured/i)
  })
})
