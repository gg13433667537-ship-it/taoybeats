import Stripe from "stripe"
import { getStripeServerConfig } from "@/lib/stripe-config"

let stripeClient: Stripe | null | undefined

export function getStripeClient(): Stripe | null {
  const { secretKey } = getStripeServerConfig()
  if (!secretKey) return null

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}
