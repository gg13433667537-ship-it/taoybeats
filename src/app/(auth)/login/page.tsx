"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Loader2, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type LoginMethod = "password" | "code"
type Step = "email" | "login"

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [userExists, setUserExists] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [sendCountdown, setSendCountdown] = useState(0)

  // Check email when it changes (blur or after some time)
  const checkEmail = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      })
      const data = await res.json()

      if (data.exists) {
        setUserExists(true)
        setHasPassword(data.hasPassword)
        if (data.hasPassword) {
          setLoginMethod("password")
          setStep("login")
        } else {
          setLoginMethod("code")
          setStep("login")
          // For code login, reset codeSent state so user can click "Send Code"
          setCodeSent(false)
        }
      } else {
        // User doesn't exist - show error instead of auto redirecting
        setError("该邮箱尚未注册，请先注册")
        setStep("email") // Stay on email step
      }
    } catch (err) {
      console.error("Check email error:", err)
    }
  }

  // Send verification code
  const handleSendCode = async () => {
    if (!email || !email.includes("@")) return
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
        throw new Error(data.error || "发送验证码失败")
      }

      if (data.devCode) {
        setDevCode(data.devCode)
      }

      setCodeSent(true)
      // Start countdown for resend
      setSendCountdown(60)
      const timer = setInterval(() => {
        setSendCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送验证码失败")
    } finally {
      setLoading(false)
    }
  }

  const handleEmailBlur = () => {
    if (email) checkEmail(email)
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "登录失败")
      }

      // Success - redirect to dashboard
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Verify code only (code should already be sent via handleSendCode)
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "验证码错误")
      }

      // Success - redirect to dashboard
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  const switchToPassword = () => {
    setLoginMethod("password")
    setCode("")
    setError("")
  }

  const switchToCode = () => {
    setLoginMethod("code")
    setPassword("")
    setError("")
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

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => {
              setStep("email")
              setError("")
              setEmail("")
            }}
            aria-label={t("back")}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t("back")}
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("welcomeBack")}
            </h1>
            <p className="text-text-secondary">
              {step === "email" && t("enterYourEmailToSignIn")}
              {step === "login" && loginMethod === "password" && t("enterYourPassword")}
              {step === "login" && loginMethod === "code" && t("enterVerificationCode")}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          {/* Email Step */}
          {step === "email" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <button
                onClick={() => checkEmail(email)}
                disabled={!email || !email.includes("@")}
                aria-label={t("continueWithEmail")}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                {t("continueWithEmail")}
              </button>
            </div>
          )}

          {/* Login Step - Password */}
          {step === "login" && loginMethod === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-border mb-4">
                <p className="text-sm text-text-secondary">
                  {email}
                </p>
              </div>

              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("password")}
                </label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors pr-12"
                  placeholder={t("enterPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-9 text-text-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                aria-label={loading ? t("signingIn") : t("signIn")}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Lock className="w-4 h-4" aria-hidden="true" />}
                {loading ? t("signingIn") : t("signIn")}
              </button>

              {hasPassword && (
                <p className="text-center text-sm text-text-muted mt-4">
                  <button
                    type="button"
                    onClick={switchToCode}
                    className="text-accent hover:underline"
                  >
                    {t("signInWithCode")}
                  </button>
                </p>
              )}
            </form>
          )}

          {/* Login Step - Code */}
          {step === "login" && loginMethod === "code" && (
            <form onSubmit={handleCodeLogin} className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-border mb-4">
                <p className="text-sm text-text-secondary">
                  {email}
                </p>
              </div>

              {/* Dev code display */}
              {devCode && (
                <div className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
                  <p className="font-medium mb-1">{t("demoModeYourCode")}</p>
                  <p className="text-2xl font-bold tracking-widest">{devCode}</p>
                </div>
              )}

              {/* Send Code button - shown when code hasn't been sent */}
              {!codeSent && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  aria-label={t("sendVerificationCode")}
                  className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Mail className="w-4 h-4" aria-hidden="true" />}
                  {loading ? t("sending") : t("sendVerificationCode")}
                </button>
              )}

              {/* Code input - shown after code is sent */}
              {codeSent && (
                <>
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
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    aria-label={loading ? t("verifying") : t("verifySignIn")}
                    className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Lock className="w-4 h-4" aria-hidden="true" />}
                    {loading ? t("verifying") : t("verifySignIn")}
                  </button>

                  {/* Resend button with countdown */}
                  <p className="text-center text-sm text-text-muted mt-4">
                    {sendCountdown > 0 ? (
                      <span className="text-text-muted">{t("resendIn")} {sendCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendCode}
                        className="text-accent hover:underline"
                      >
                        {t("resendCode")}
                      </button>
                    )}
                  </p>
                </>
              )}

              {userExists && hasPassword && (
                <p className="text-center text-sm text-text-muted mt-4">
                  <button
                    type="button"
                    onClick={switchToPassword}
                    className="text-accent hover:underline"
                  >
                    {t("signInWithPassword")}
                  </button>
                </p>
              )}
            </form>
          )}

          <p className="mt-8 text-center text-sm text-text-muted">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-accent hover:underline">
              {t("signUp")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
