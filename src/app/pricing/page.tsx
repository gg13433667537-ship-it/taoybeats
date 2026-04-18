"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Check, Zap, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function PricingPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  // Stripe Price IDs (replace with actual Stripe price IDs)
  const STRIPE_PRICE_IDS = {
    pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "price_monthly_placeholder",
    pro_annual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || "price_annual_placeholder",
  }

  const handleCheckout = async (planId: string) => {
    if (planId === 'free') {
      router.push('/register')
      return
    }

    setIsCheckingOut(true)
    try {
      // Fetch profile to check if user is logged in and get user info
      const profileRes = await fetch('/api/auth/profile')
      if (!profileRes.ok) {
        router.push('/login?plan=pro')
        return
      }

      const profileData = await profileRes.json()
      if (!profileData.user) {
        router.push('/login?plan=pro')
        return
      }

      // Create Stripe checkout session
      const priceId = annual ? STRIPE_PRICE_IDS.pro_annual : STRIPE_PRICE_IDS.pro_monthly
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: profileData.user.id,
          email: profileData.user.email,
        }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.assign(data.url)
      } else {
        console.error('Checkout failed:', data.error)
        alert('Failed to create checkout session. Please try again.')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to create checkout session. Please try again.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const PLANS = [
    {
      id: "free",
      name: t('free'),
      price: "$0",
      period: t('forever'),
      description: t('perfectTrying'),
      features: [
        "3 songs per day",
        "10 songs per month",
        "Basic genres and moods",
        "Share songs",
        "Download MP3",
      ],
      notIncluded: [
        "Priority queue",
        "Advanced customization",
      ],
      cta: t('pricingGetStarted'),
      popular: false,
    },
    {
      id: "pro",
      name: t('pro'),
      price: "$9.99",
      period: t('perMonth'),
      description: t('seriousCreators'),
      features: [
        "50 songs per day",
        "Unlimited songs per month",
        "All genres and moods",
        "Priority queue",
        "Advanced customization",
        "Share songs",
        "Download MP3",
        "Early access to new features",
      ],
      notIncluded: [],
      cta: t('upgradeToPro'),
      popular: true,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/generate" className="text-sm text-text-secondary hover:text-foreground transition-colors">
              Generate
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Pricing */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t('simplePricing')}
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {t('startFreeUpgrade')}
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm ${!annual ? 'text-foreground' : 'text-text-secondary'}`}>
            {t('monthly')}
          </span>
          <button
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              annual ? 'bg-accent' : 'bg-border'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                annual ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${annual ? 'text-foreground' : 'text-text-secondary'}`}>
            {t('annual')} <span className="text-success text-xs">{t('save20')}</span>
          </span>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-8 rounded-2xl border ${
                plan.popular
                  ? 'bg-gradient-to-b from-accent/10 to-surface border-accent/50 relative'
                  : 'bg-surface border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-white text-sm font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {t('mostPopular')}
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">{plan.name}</h2>
                <p className="text-text-secondary text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">
                  {annual && plan.id === 'pro' ? '$7.99' : plan.price}
                </span>
                <span className="text-text-secondary">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm opacity-50">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCheckingOut}
                className={`block w-full py-3 rounded-xl text-center font-medium transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'border border-border hover:border-accent text-foreground'
                }`}
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('processing')}
                  </span>
                ) : plan.id === 'free' ? t('pricingGetStarted') : t('upgradeToPro')}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            {t('faqTitle')}
          </h2>
          <div className="space-y-4">
            {[
              { key: 'faq1', q: t('faq1Q'), a: t('faq1A') },
              { key: 'faq2', q: t('faq2Q'), a: t('faq2A') },
              { key: 'faq3', q: t('faq3Q'), a: t('faq3A') },
              { key: 'faq4', q: t('faq4Q'), a: t('faq4A') },
            ].map((item) => (
              <div key={item.key} className="p-4 rounded-xl bg-surface border border-border">
                <h3 className="font-medium text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-text-secondary">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm text-text-secondary">
            © 2026 TaoyBeats. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
