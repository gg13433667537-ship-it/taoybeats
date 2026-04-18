import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder")

// Raw body needed for Stripe signature verification
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature") || ""
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

  let event

  try {
    // Verify webhook signature
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      // If no webhook secret configured, parse directly (for development)
      event = JSON.parse(body)
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
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
        const invoice = event.data.object
        const subscriptionId = invoice.subscription
        console.log(`Payment failed for subscription ${subscriptionId}`)
        // Could send email notification here
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
