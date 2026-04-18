"use client"

import { useState } from "react"
import { X, Loader2, Sparkles, Gift } from "lucide-react"
import { useRouter } from "next/navigation"

interface LoginGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginGuideModal({ isOpen, onClose }: LoginGuideModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleLogin = () => {
    setIsLoading(true)
    // Navigate to login page with return URL
    router.push('/login?returnUrl=' + encodeURIComponent('/generate'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">新用户专属</h2>
              <p className="text-sm text-text-muted">免费 AI 歌词生成次数</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent/20 to-accent-glow/20">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">登录后即可获得</h3>
            <p className="text-3xl font-bold text-accent">免费 AI 歌词生成次数</p>
            <p className="text-sm text-text-secondary">
              每天 3 次免费生成额度，新用户首月额外赠送 10 次！
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                '登录 / 注册'
              )}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-border text-text-secondary font-medium transition-colors hover:bg-surface-elevated"
            >
              稍后再说
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
