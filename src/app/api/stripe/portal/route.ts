import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { verifySessionToken } from "@/lib/auth-utils"
import { applySecurityHeaders, DEFAULT_RATE_LIMIT, rateLimitMiddleware } from "@/lib/security"
import type { User } from "@/lib/types"

// Initialize global user store for Stripe customer mapping
if (!global.users) global.users = new Map<string, User>()

// Validate that Stripe secret key is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY environment variable is not set")
}

const stripe = new Stripe(stripeSecretKey || "sk_test_placeholder")

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

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, DEFAULT_RATE_LIMIT, "stripe-portal")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  // Auth check
  const sessionUser = getSessionUser(request)
  if (!sessionUser) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { customerId } = body

    if (!customerId) {
      return applySecurityHeaders(NextResponse.json({ error: "Customer ID is required" }, { status: 400 }))
    }

    // Get user's stored customer ID from global store (set by Stripe webhook)
    const usersMap = global.users as Map<string, User>
    const user = usersMap.get(sessionUser.id)

    // Verify the provided customerId matches the user's stored Stripe customer ID
    // This prevents unauthorized access to other users' billing portals
    if (!user?.stripeCustomerId || user.stripeCustomerId !== customerId) {
      return applySecurityHeaders(NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 403 }
      ))
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.nextUrl.origin}/settings`,
    })

    return applySecurityHeaders(NextResponse.json({ url: session.url }))
  } catch (error) {
    console.error("Stripe portal error:", error)
    return applySecurityHeaders(NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    ))
  }
}