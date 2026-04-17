"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Loader2, Mail, Lock, User, ArrowLeft } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type Step = "email" | "code" | "profile"

export default function RegisterPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState("") // For demo only

  // Handle email submission (send code)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to send code")
      }

      // For demo, show the code
      if (data.devCode) {
        setDevCode(data.devCode)
      }

      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // Handle code verification
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Verification failed")
      }

      // Success - go to profile step
      setStep("profile")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  // Handle profile completion
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      })

      if (!res.ok) {
        throw new Error("Failed to save profile")
      }

      // Success - redirect to dashboard
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </Link>
        </div>
      </header>

      {/* Register Form */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => {
              if (step === "code") setStep("email")
              else if (step === "profile") setStep("code")
            }}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("back")}
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {step === "email" && t("createAccount")}
              {step === "code" && t("enterVerificationCode")}
              {step === "profile" && t("almostThere")}
            </h1>
            <p className="text-text-secondary">
              {step === "email" && t("startCreatingToday")}
              {step === "code" && `${t("weSentCodeTo")} ${email}`}
              {step === "profile" && t("tellUsAboutYourself")}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          {/* Dev code display (REMOVE IN PRODUCTION) */}
          {devCode && step === "code" && (
            <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
              <p className="font-medium mb-1">{t("demoModeYourCode")}</p>
              <p className="text-2xl font-bold tracking-widest">{devCode}</p>
            </div>
          )}

          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? t("sending") : t("continueWithEmail")}
              </button>
            </form>
          )}

          {/* Code Step */}
          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("verificationCode")}
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? t("verifying") : t("verifyEmail")}
              </button>

              <p className="text-center text-sm text-text-muted">
                {t("didntReceive")}{" "}
                <button
                  onClick={() => {
                    setDevCode("")
                    setStep("email")
                  }}
                  className="text-accent hover:underline"
                >
                  {t("tryAgain")}
                </button>
              </p>
            </form>
          )}

          {/* Profile Step */}
          {step === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("whatShouldWeCallYou")}
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder={t("yourNamePlaceholder")}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                {loading ? t("saving") : t("completeSignUp")}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-text-muted">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-accent hover:underline">
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
