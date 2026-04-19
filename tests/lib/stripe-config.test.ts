import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("stripe config helpers", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reports server billing as unavailable when stripe secrets are missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "")
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "")

    const { getStripeServerConfig } = await import("@/lib/stripe-config")
    const config = getStripeServerConfig()

    expect(config.secretKey).toBeNull()
    expect(config.webhookSecret).toBeNull()
    expect(config.isServerConfigured).toBe(false)
  })

  it("reports client pricing as unavailable when public price ids are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID", "")
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID", "")

    const { getStripePriceConfig } = await import("@/lib/stripe-config")
    const config = getStripePriceConfig()

    expect(config.monthlyPriceId).toBeNull()
    expect(config.annualPriceId).toBeNull()
    expect(config.isPricingConfigured).toBe(false)
  })
})
