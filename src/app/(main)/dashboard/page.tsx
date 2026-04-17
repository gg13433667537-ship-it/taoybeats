"use client"

import { useState, useEffect, useRef, startTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Plus, Play, MoreHorizontal, Clock, Share2, Download, Loader2, Zap, Shield, LogOut, User, ChevronDown, Settings, AlertCircle, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface Song {
  id: string
  title: string
  status: string
  createdAt: string
  progress?: number
  duration?: string
  genre?: string[]
  [key: string]: unknown
}

interface Usage {
  tier: string
  daily: { used: number; limit: number; remaining: number }
  monthly: { used: number; limit: number; remaining: number }
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, lang } = useI18n()
  const [songs, setSongs] = useState<Song[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('USER')
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get user info from session cookie
  useEffect(() => {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const cookiePart = cookie.trim()
      const equalIndex = cookiePart.indexOf('=')
      if (equalIndex === -1) continue
      const name = cookiePart.substring(0, equalIndex)
      const value = cookiePart.substring(equalIndex + 1)
      if (name === 'session-token') {
        try {
          const payload = JSON.parse(atob(value))
          startTransition(() => {
            setUserRole(payload.role || 'USER')
            setUserEmail(payload.email || '')
            setUserName(payload.email?.split('@')[0] || 'User')
          })
        } catch {
          // ignore invalid session
        }
        break
      }
    }
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  // Fetch songs and usage
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch songs
        const songsRes = await fetch("/api/songs")
        if (songsRes.ok) {
          const songsData = await songsRes.json()
          setSongs(songsData.songs || [])
        }

        // Fetch usage
        const usageRes = await fetch("/api/usage")
        if (usageRes.ok) {
          const usageData = await usageRes.json()
          setUsage(usageData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        setDashboardError("加载数据失败，请刷新页面重试")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-success/10 text-success'
      case 'GENERATING':
        return 'bg-accent/10 text-accent'
      case 'FAILED':
        return 'bg-error/10 text-error'
      default:
        return 'bg-text-muted/10 text-text-muted'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </button>
          <div className="flex items-center gap-4">
            {userRole === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                {lang === 'zh' ? '管理' : 'Admin'}
              </button>
            )}
            <button
              onClick={() => router.push('/generate')}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('createSong')}
            </button>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User menu"
                aria-expanded={showDropdown}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${showDropdown ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface border border-border shadow-lg overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{userName}</p>
                    <p className="text-xs text-text-muted truncate">{userEmail}</p>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('yourMusic')}</h1>
            <p className="text-text-secondary">{t('manageShare')}</p>
          </div>

          {/* Error Banner */}
          {dashboardError && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-error" aria-hidden="true" />
                <span className="text-error text-sm">{dashboardError}</span>
              </div>
              <button
                onClick={() => setDashboardError(null)}
                aria-label="Dismiss error"
                className="p-1 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Usage Stats */}
          {usage && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span className="text-sm text-text-secondary">{t('daily')}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {usage.daily?.remaining ?? '—'}
                  <span className="text-sm text-text-muted font-normal"> / {usage.daily?.limit ?? '—'}</span>
                </p>
                <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${((usage.daily?.used ?? 0) / (usage.daily?.limit ?? 1)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span className="text-sm text-text-secondary">{t('monthlyUsage')}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {usage.monthly?.remaining === -1 ? '∞' : (usage.monthly?.remaining ?? '—')}
                  <span className="text-sm text-text-muted font-normal">
                    {usage.monthly?.limit === -1 ? '' : ` / ${usage.monthly?.limit ?? '—'}`}
                  </span>
                </p>
                {usage.monthly?.limit !== -1 && (
                  <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${((usage.monthly?.used ?? 0) / (usage.monthly?.limit ?? 1)) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span className="text-sm text-text-secondary">{t('totalSongs')}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{songs.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-text-secondary">{t('tier')}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{usage.tier || 'FREE'}</p>
              </div>
            </div>
          )}

          {/* Songs List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t('recentSongs')}</h2>
              <Link
                href="/generate"
                className="text-sm text-accent hover:underline"
              >
                {t('createNewSong')} →
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
            ) : songs.length === 0 ? (
              <div className="p-12 rounded-2xl bg-surface border border-border text-center">
                <Music className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('noSongsYet')}</h3>
                <p className="text-text-secondary mb-6">{t('createFirstSong')}</p>
                <Link
                  href="/generate"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('createSong')}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {songs.map(song => (
                  <div
                    key={song.id}
                    className="p-4 rounded-xl bg-surface border border-border hover:border-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Play Button / Status */}
                      <div className="relative">
                        {song.status === 'COMPLETED' ? (
                          <button className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors">
                            <Play className="w-5 h-5 ml-0.5" />
                          </button>
                        ) : song.status === 'GENERATING' ? (
                          <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center">
                            <span className="text-sm">!</span>
                          </div>
                        )}

                        {/* Progress ring for generating */}
                        {song.status === 'GENERATING' && song.progress !== undefined && (
                          <svg className="absolute inset-0 w-12 h-12 -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-accent/30"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 22}`}
                              strokeDashoffset={`${2 * Math.PI * 22 * (1 - song.progress / 100)}`}
                              className="text-accent"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/song/${song.id}`} className="block hover:underline">
                          <h3 className="font-medium text-foreground truncate">{song.title}</h3>
                        </Link>
                        <div className="flex items-center gap-3 text-sm text-text-secondary">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(song.status)}`}>
                            {song.status === 'COMPLETED' ? t('ready') :
                             song.status === 'GENERATING' ? `${song.progress ?? 0}%` : t('failed')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(song.createdAt)}
                          </span>
                          {song.duration && (
                            <span>{song.duration}</span>
                          )}
                          {song.genre && Array.isArray(song.genre) && (
                            <span>{song.genre.join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {song.status === 'COMPLETED' && (
                          <>
                            <button aria-label="Download song" className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                              <Download className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button aria-label="Share song" className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                              <Share2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button aria-label="More options" className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                          <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
