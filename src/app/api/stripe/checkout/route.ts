import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, rateLimitMiddleware, STRICT_RATE_LIMIT } from "@/lib/security"
import { getStripeServerConfig } from "@/lib/stripe-config"
import { getStripeClient } from "@/lib/stripe-server"


if (!global.users) global.users = new Map()

function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

// Trusted price ID whitelist - only these IDs are accepted
function getTrustedPriceIds(): string[] {
  const trustedIds: string[] = []
  const proMonthly = process.env.STRIPE_PRICE_ID_PRO_MONTHLY
  const proAnnual = process.env.STRIPE_PRICE_ID_PRO_ANNUAL
  if (proMonthly) trustedIds.push(proMonthly)
  if (proAnnual) trustedIds.push(proAnnual)
  return trustedIds
}

// Validate Stripe price ID format (starts with 'price_')
function isValidPriceId(priceId: unknown): priceId is string {
  return typeof priceId === 'string' && /^price_[a-zA-Z0-9]{24,}$/.test(priceId)
}

// Validate priceId is in trusted whitelist
function isTrustedPriceId(priceId: string): boolean {
  const trustedIds = getTrustedPriceIds()
  return trustedIds.length > 0 && trustedIds.includes(priceId)
}

export async function POST(request: NextRequest) {
  // Rate limiting - strict limit for payment operations
  const rateLimitResponse = rateLimitMiddleware(request, STRICT_RATE_LIMIT, "stripe-checkout")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  // Auth check
  const user = getSessionUser(request)
  if (!user) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const { isServerConfigured } = getStripeServerConfig()
  if (!isServerConfigured) {
    return applySecurityHeaders(NextResponse.json({ error: "Billing is not configured" }, { status: 503 }))
  }

  try {
    const stripe = getStripeClient()
    if (!stripe) {
      return applySecurityHeaders(NextResponse.json({ error: "Billing is not configured" }, { status: 503 }))
    }

    const body = await request.json()
    const { priceId } = body

    // Validate priceId is present and properly formatted
    if (!priceId) {
      return applySecurityHeaders(NextResponse.json({ error: "Price ID is required" }, { status: 400 }))
    }

    if (!isValidPriceId(priceId)) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid Price ID format" }, { status: 400 }))
    }

    // Validate priceId is in trusted whitelist
    if (!isTrustedPriceId(priceId)) {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid Price ID" }, { status: 400 }))
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${request.nextUrl.origin}/dashboard?success=true`,
      cancel_url: `${request.nextUrl.origin}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
    })

    return applySecurityHeaders(NextResponse.json({ url: session.url }))
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    ))
  }
}
