import { describe, it, expect, vi } from "vitest"
import { withPrismaRetry, isRetryableError } from "@/lib/db-retry"

describe("withPrismaRetry", () => {
  it("returns result on first success", async () => {
    const operation = vi.fn().mockResolvedValue("success")

    const result = await withPrismaRetry(operation)

    expect(result).toBe("success")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("retries on retryable error and succeeds", async () => {
    const error = new Error("Can't reach database server")
    ;(error as Error & { code?: string }).code = "P1001"

    const operation = vi.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue("success")

    // Mock setTimeout to execute immediately (skip delays in test)
    vi.spyOn(global, "setTimeout").mockImplementation((cb: TimerHandler) => {
      if (typeof cb === "function") cb()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    const result = await withPrismaRetry(operation, 3, 100)

    expect(result).toBe("success")
    expect(operation).toHaveBeenCalledTimes(3)

    vi.restoreAllMocks()
  })

  it("retries up to maxRetries then throws", async () => {
    const error = new Error("Can't reach database server")
    ;(error as Error & { code?: string }).code = "P1001"

    const operation = vi.fn().mockRejectedValue(error)

    // Mock setTimeout to execute immediately
    vi.spyOn(global, "setTimeout").mockImplementation((cb: TimerHandler) => {
      if (typeof cb === "function") cb()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    await expect(withPrismaRetry(operation, 2, 100)).rejects.toThrow("Can't reach database server")
    expect(operation).toHaveBeenCalledTimes(3)

    vi.restoreAllMocks()
  })

  it("does not retry on non-retryable errors", async () => {
    const error = new Error("Unique constraint failed")
    ;(error as Error & { code?: string }).code = "P2002"

    const operation = vi.fn().mockRejectedValue(error)

    await expect(withPrismaRetry(operation)).rejects.toThrow("Unique constraint failed")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("uses exponential backoff delays", async () => {
    const error = new Error("Connection timeout")
    const operation = vi.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue("success")

    const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation((cb: TimerHandler) => {
      if (typeof cb === "function") cb()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    await withPrismaRetry(operation, 3, 100)

    // Verify exponential backoff: 100, 200
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1])
    expect(delays).toEqual([100, 200])

    vi.restoreAllMocks()
  })
})

describe("isRetryableError", () => {
  it("returns true for retryable Prisma error codes", () => {
    const e1 = new Error("P1001") as Error & { code?: string }
    e1.code = "P1001"
    expect(isRetryableError(e1)).toBe(true)

    const e2 = new Error("P1008") as Error & { code?: string }
    e2.code = "P1008"
    expect(isRetryableError(e2)).toBe(true)
  })

  it("returns true for connection-related messages", () => {
    expect(isRetryableError(new Error("Can't reach database server"))).toBe(true)
    expect(isRetryableError(new Error("Connection timeout"))).toBe(true)
    expect(isRetryableError(new Error("Server has closed the connection"))).toBe(true)
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true)
  })

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("Unique constraint failed"))).toBe(false)
    expect(isRetryableError(new Error("Record not found"))).toBe(false)
    expect(isRetryableError("string error")).toBe(false)
    expect(isRetryableError(null)).toBe(false)
  })
})
