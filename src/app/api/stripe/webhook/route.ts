import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import Stripe from "stripe"
import { applySecurityHeaders } from "@/lib/security"

// Validate that Stripe secret key is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY environment variable is not set")
}

const stripe = new Stripe(stripeSecretKey || "sk_test_placeholder")

// Raw body needed for Stripe signature verification
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // Reject requests without required signature in production
  if (!webhookSecret || !sig) {
    console.error("Webhook missing signature or secret")
    return applySecurityHeaders(NextResponse.json(
      { error: "Webhook configuration error" },
      { status: 500 }
    ))
  }

  let event

  try {
    // Verify webhook signature - ALWAYS verify in production
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return applySecurityHeaders(NextResponse.json({ error: "Invalid signature" }, { status: 400 }))
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const userId = session.metadata?.userId

        if (userId && session.subscription) {
          // Verify subscription exists and is active
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          if (subscription.status !== 'active') {
            console.log(`Subscription ${session.subscription} is not active, skipping PRO upgrade`)
            break
          }

          // Update user tier to PRO
          const usersMap = global.users as Map<string, User> | undefined
          if (usersMap) {
            const user = usersMap.get(userId)
            if (user) {
              user.tier = "PRO"
              user.stripeCustomerId = session.customer as string
              user.stripeSubscriptionId = session.subscription as string
              usersMap.set(userId, user)
              console.log(`User ${userId} upgraded to PRO via Stripe`)
            }
          }
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId

        if (userId) {
          // Downgrade user to FREE
          const usersMap = global.users as Map<string, User> | undefined
          if (usersMap) {
            const user = usersMap.get(userId)
            if (user) {
              user.tier = "FREE"
              user.stripeSubscriptionId = undefined
              usersMap.set(userId, user)
              console.log(`User ${userId} downgraded to FREE (subscription canceled)`)
            }
          }
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { subscription?: string }
        const subscriptionId = invoice.subscription
        console.log(`Payment failed for subscription ${subscriptionId || 'unknown'}`)
        // Could send email notification here
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err)
    return applySecurityHeaders(NextResponse.json({ error: "Webhook handler failed" }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({ received: true }))
}
