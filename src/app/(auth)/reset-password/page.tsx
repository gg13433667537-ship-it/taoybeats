"use client"

import { useState, Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Loader2, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { getCSRFToken, refreshCSRFToken } from "@/lib/csrf"

type Step = 1 | 2 | 3

function ResetPasswordPageContent() {
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Refresh CSRF token on mount
  useEffect(() => {
    refreshCSRFToken()
  }, [])

  // Get CSRF headers for requests
  const getAuthHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const csrfToken = getCSRFToken()
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken
    }
    return headers
  }

  const sendCode = async () => {
    if (!email || !email.includes("@")) {
      setError("请输入有效的邮箱地址")
      return
    }
    setIsSendingCode(true)
    setError("")
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              setIsSendingCode(false)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        if (step === 1) {
          setStep(2)
        }
        setError("")
      } else {
        setError(data.error || "发送验证码失败")
        setIsSendingCode(false)
      }
    } catch {
      setError("发送验证码失败")
      setIsSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!code) {
      setError("请输入验证码")
      return
    }

    if (newPassword.length < 6) {
      setError("密码长度至少为6个字符")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, code, newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setStep(3)
      } else {
        setError(data.error || "密码重置失败")
      }
    } catch {
      setError("密码重置失败")
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

      {/* Reset Password Form */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("back")}
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              重置密码
            </h1>
            <p className="text-text-secondary">
              {step === 1 && "输入您的邮箱以接收验证码"}
              {step === 2 && "输入验证码和新密码"}
              {step === 3 && "密码重置成功"}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendCode()
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingCode || !email.includes("@")}
                aria-label={isSendingCode ? t("sending") : t("sendVerificationCode")}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSendingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="w-4 h-4" aria-hidden="true" />
                )}
                {isSendingCode ? t("sending") : t("sendVerificationCode")}
              </button>
            </form>
          )}

          {/* Step 2: Code + New Password */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-border mb-4">
                <p className="text-sm text-text-secondary">{email}</p>
              </div>

              {/* Verification Code */}
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("verificationCode")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={isSendingCode || countdown > 0}
                    className="px-4 py-3 bg-accent hover:bg-accent-hover disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}秒` : "重新发送"}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="relative">
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("newPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder={t("passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  {t("confirmPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-12 py-3 rounded-xl bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder={t("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6 || !newPassword || !confirmPassword}
                aria-label={loading ? "重置中..." : "重置密码"}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                {loading ? "重置中..." : "重置密码"}
              </button>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success">
                <p className="font-medium">密码重置成功！</p>
                <p className="text-sm mt-1 text-text-secondary">您现在可以使用新密码登录了</p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                去登录
              </button>
            </div>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  )
}
