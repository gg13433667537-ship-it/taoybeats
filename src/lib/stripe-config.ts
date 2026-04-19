function normalizeEnv(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getStripeServerConfig() {
  const secretKey = normalizeEnv(process.env.STRIPE_SECRET_KEY)
  const webhookSecret = normalizeEnv(process.env.STRIPE_WEBHOOK_SECRET)

  return {
    secretKey,
    webhookSecret,
    isServerConfigured: Boolean(secretKey),
    isWebhookConfigured: Boolean(secretKey && webhookSecret),
  }
}

export function getStripePriceConfig() {
  const monthlyPriceId = normalizeEnv(process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID)
  const annualPriceId = normalizeEnv(process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID)

  return {
    monthlyPriceId,
    annualPriceId,
    isPricingConfigured: Boolean(monthlyPriceId && annualPriceId),
  }
}
