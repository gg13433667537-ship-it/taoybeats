import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { applySecurityHeaders } from "@/lib/security"
import { getStripeServerConfig } from "@/lib/stripe-config"
import { getStripeClient } from "@/lib/stripe-server"
import { prisma } from "@/lib/db"

// Raw body needed for Stripe signature verification
export async function POST(request: NextRequest) {
  const { isWebhookConfigured, webhookSecret } = getStripeServerConfig()
  if (!isWebhookConfigured || !webhookSecret) {
    return applySecurityHeaders(NextResponse.json(
      { error: "Billing webhook is not configured" },
      { status: 503 }
    ))
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return applySecurityHeaders(NextResponse.json(
      { error: "Billing webhook is not configured" },
      { status: 503 }
    ))
  }

  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  // Reject requests without required signature in production
  if (!sig) {
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
          // Persist to database
          try {
            await prisma.user.update({
              where: { id: userId },
              data: {
                tier: "PRO",
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
              },
            })
            console.log(`User ${userId} tier persisted to database`)
          } catch (error) {
            console.error(`Failed to persist user tier for ${userId}:`, error)
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
          // Persist to database
          try {
            await prisma.user.update({
              where: { id: userId },
              data: {
                tier: "FREE",
                stripeSubscriptionId: undefined,
              },
            })
            console.log(`User ${userId} downgrade persisted to database`)
          } catch (error) {
            console.error(`Failed to persist user downgrade for ${userId}:`, error)
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
