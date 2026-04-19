'use client'

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ChevronDown, Settings, User, LogOut } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface UserData {
  id: string
  email: string
  name: string
  role?: string
  tier?: string
}

export default function UserDropdown() {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useI18n()
  const [user, setUser] = useState<UserData | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/auth/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            setUser(data.user)
          }
        }
      } catch {
        // ignore profile fetch errors - user not logged in
      }
    }
    fetchProfile()
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownToggle = document.querySelector('[aria-label="User menu"]')
      const isDropdownToggle = dropdownToggle?.contains(event.target as Node)

      if (!isDropdownToggle && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  // If not logged in, show login and register buttons
  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm text-text-secondary hover:text-foreground transition-colors">
          {t('signIn')}
        </Link>
        <Link
          href="/register"
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          {t('getStarted')}
        </Link>
      </div>
    )
  }

  // Logged in: show user avatar with dropdown
  return (
    <div className="relative" ref={dropdownRef} key={pathname}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="User menu"
        aria-expanded={showDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
          {user.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${showDropdown ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface border border-border shadow-lg overflow-hidden z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => { setShowDropdown(false); router.push('/settings'); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-background transition-colors"
            >
              <Settings className="w-4 h-4 text-text-muted" aria-hidden="true" />
              {t('settings')}
            </button>
            <button
              onClick={() => { setShowDropdown(false); router.push('/dashboard'); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-background transition-colors"
            >
              <User className="w-4 h-4 text-text-muted" aria-hidden="true" />
              {t('mySongs')}
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-border py-2">
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
