"use client"

import { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { Music, User, Key, Bell, Shield, Check } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [userRole, setUserRole] = useState<string>('USER')

  // Profile state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // API state
  const [apiProvider, setApiProvider] = useState('minimax')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // Notification toggles state
  const [notifications, setNotifications] = useState({
    generationComplete: true,
    generationFailed: true,
    weeklySummary: false,
  })

  // Fetch user profile from API (runs once on mount)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            startTransition(() => {
              setUserRole(data.user.role || 'USER')
              setName(data.user.name || '')
              setEmail(data.user.email || '')
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
      }
    }
    fetchProfile()
  }, [])

  const TABS = [
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'notifications', label: t('notifications'), icon: Bell },
    { id: 'security', label: t('security'), icon: Shield },
  ]

  // Admin-only tabs
  const ADMIN_TABS = [
    { id: 'api', label: t('apiConfiguration'), icon: Key },
  ]

  const allTabs = userRole === 'ADMIN' ? [...TABS, ...ADMIN_TABS] : TABS

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('minimax_api_key')
    const savedUrl = localStorage.getItem('minimax_api_url')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedKey) setApiKey(savedKey)
    if (savedUrl) setApiUrl(savedUrl)
  }, [])

  const handleSave = async () => {
    // Save API key and URL to localStorage
    localStorage.setItem('minimax_api_key', apiKey)
    localStorage.setItem('minimax_api_url', apiUrl)

    // Save profile to API
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) {
        console.error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePasswordChange = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError(t('passwordRequired'))
      return
    }

    if (!newPassword) {
      setPasswordError(t('newPasswordRequired'))
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(t('passwordMinLength'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'))
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (res.ok) {
        setPasswordSuccess(t('passwordChangedSuccess'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setPasswordError(data.error || t('failedChangePassword'))
      }
    } catch {
      setPasswordError(t('failedChangePassword'))
    }
  }

  const handleSignOutAllDevices = async () => {
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Error signing out all devices:', error)
    }
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
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-text-secondary hover:text-foreground transition-colors"
          >
            {t('dashboard')}
          </button>
          {userRole === 'ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">{t('admin')}</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">{t('settingsTitle')}</h1>

          <div className="flex gap-8">
            {/* Sidebar */}
            <nav className="w-64 flex-shrink-0" role="tablist" aria-label="Settings sections">
              <div className="space-y-1">
                {allTabs.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" aria-hidden="true" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1">
              {activeTab === 'profile' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-6">{t('profileSettings')}</h2>

                  <div className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold" aria-hidden="true">
                        D
                      </div>
                      <div>
                        <button className="px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-background transition-colors">
                          {t('changeAvatar')}
                        </button>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsName')}</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsEmail')}</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <button
                      onClick={handleSave}
                      aria-label={saved ? t('saved') : t('saveChanges')}
                      className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center gap-2"
                    >
                      {saved ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
                      {saved ? t('saved') : t('saveChanges')}
                    </button>
                  </div>
                </section>
              )}

              {activeTab === 'api' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-6">{t('apiConfiguration')}</h2>
                  <p className="text-text-secondary mb-6">
                    {t('apiConfigDesc')}
                  </p>

                  <div className="space-y-6">
                    {/* Provider */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsProvider')}</label>
                      <select
                        value={apiProvider}
                        onChange={(e) => setApiProvider(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="suno">Suno AI</option>
                        <option value="minimax">MiniMax</option>
                        <option value="udio">Udio</option>
                        <option value="custom">Custom API</option>
                      </select>
                    </div>

                    {/* API URL */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsApiUrl')}</label>
                      <input
                        type="url"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.suno.ai"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsApiKey')}</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Model ID */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{t('settingsModelId')} <span className="text-text-muted">{t('settingsModelIdOptional')}</span></label>
                      <input
                        type="text"
                        value={modelId}
                        onChange={(e) => setModelId(e.target.value)}
                        placeholder="e.g., musicgen-large"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    <button
                      onClick={handleSave}
                      aria-label={saved ? t('saved') : t('saveChanges')}
                      className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center gap-2"
                    >
                      {saved ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
                      {saved ? t('saved') : t('saveChanges')}
                    </button>
                  </div>
                </section>
              )}

              {activeTab === 'notifications' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-6">{t('notifications')}</h2>

                  <div className="space-y-4">
                    {[
                      { key: 'generationComplete', label: t('generationComplete'), description: t('notifyGenerationComplete') },
                      { key: 'generationFailed', label: t('generationFailed'), description: t('notifyGenerationFailed') },
                      { key: 'weeklySummary', label: t('weeklySummary'), description: t('notifyWeeklySummary') },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                        <div>
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="text-sm text-text-secondary">{item.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof typeof notifications]}
                            onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 rounded-full bg-border peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === 'security' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-6">{t('securitySettings')}</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-foreground mb-4">{t('changePassword')}</h3>
                      <div className="space-y-4">
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={t('currentPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t('newPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t('confirmPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                      </div>
                      {passwordError && <p className="mt-2 text-sm text-error">{passwordError}</p>}
                      {passwordSuccess && <p className="mt-2 text-sm text-success">{passwordSuccess}</p>}
                    </div>

                    <button
                      onClick={handlePasswordChange}
                      className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
                    >
                      {t('updatePassword')}
                    </button>

                    <div className="pt-6 border-t border-border">
                      <h3 className="font-medium text-foreground mb-4">{t('sessions')}</h3>
                      <p className="text-sm text-text-secondary mb-4">{t('manageSessions')}</p>
                      <button
                        onClick={handleSignOutAllDevices}
                        className="px-4 py-2 rounded-lg border border-error text-error text-sm font-medium hover:bg-error/10 transition-colors"
                      >
                        {t('signOutAllDevices')}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
