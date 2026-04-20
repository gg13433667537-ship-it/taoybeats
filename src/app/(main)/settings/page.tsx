"use client"

import { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { Music, User, Key, Bell, Shield, Check, Users, CreditCard, Search } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"
import { getCSRFToken, refreshCSRFToken } from "@/lib/csrf"

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
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false) // Track if a key is already stored server-side

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

  // User management state (admin only)
  const [users, setUsers] = useState<Array<{
    id: string
    email: string
    name?: string
    role: string
    tier: string
    isActive: boolean
    dailyUsage: number
    monthlyUsage: number
    createdAt: string
  }>>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersSearch, setUsersSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userActionLoading, setUserActionLoading] = useState(false)
  const [userActionSuccess, setUserActionSuccess] = useState('')

  // Refresh CSRF token on mount
  useEffect(() => {
    refreshCSRFToken()
  }, [])

  // Get CSRF headers for requests
  const getAuthHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const csrfToken = getCSRFToken()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
    return headers
  }

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
    { id: 'users', label: t('userManagement') || 'User Management', icon: Users },
  ]

  const allTabs = userRole === 'ADMIN' ? [...TABS, ...ADMIN_TABS] : TABS

  // Load API config from server on mount
  useEffect(() => {
    const fetchApiConfig = async () => {
      try {
        const res = await fetch('/api/user/api-config')
        if (res.ok) {
          const data = await res.json()
          if (data.apiConfig) {
            startTransition(() => {
              setApiProvider(data.apiConfig.provider || 'minimax')
              setApiUrl(data.apiConfig.apiUrl || '')
              setModelId(data.apiConfig.modelId || '')
              setHasStoredApiKey(data.apiConfig.hasApiKey || false)
              // API key is never returned by GET - user must re-enter if they want to change it
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch API config:', error)
      }
    }
    fetchApiConfig()
  }, [])

  const handleSave = async () => {
    // Save API config to server (NOT localStorage)
    if (apiKey || apiUrl) {
      try {
        const res = await fetch('/api/user/api-config', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ provider: apiProvider, apiKey, apiUrl, modelId }),
        })
        if (res.ok) {
          setHasStoredApiKey(true)
          setApiKey('') // Clear the key from state after saving
        } else {
          console.error('Failed to save API config')
        }
      } catch (error) {
        console.error('Error saving API config:', error)
      }
    }

    // Save profile to API
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
      await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      router.push('/')
    } catch (error) {
      console.error('Error signing out all devices:', error)
    }
  }

  // Fetch users for admin
  const fetchUsers = async (search?: string) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', '50')
      const res = await fetch(`/api/admin/users?${params.toString}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  // Update user tier/credits
  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    setUserActionLoading(true)
    setUserActionSuccess('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, ...updates }),
      })
      if (res.ok) {
        setUserActionSuccess(t('userUpdated') || 'User updated successfully')
        fetchUsers(usersSearch)
        setSelectedUser(null)
        setTimeout(() => setUserActionSuccess(''), 3000)
      } else {
        const data = await res.json()
        console.error('Failed to update user:', data.error)
      }
    } catch (error) {
      console.error('Error updating user:', error)
    } finally {
      setUserActionLoading(false)
    }
  }

  // Load users when switching to users tab
  useEffect(() => {
    if (activeTab === 'users' && userRole === 'ADMIN' && users.length === 0) {
      startTransition(() => {
        fetchUsers()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userRole])

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
                        <option value="minimax">Music API</option>
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
                        placeholder={hasStoredApiKey ? "•••••••• (stored)" : "sk-..."}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                      {hasStoredApiKey && (
                        <p className="mt-2 text-sm text-success flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          API key is securely stored server-side
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        Leave blank to keep existing key, or enter a new key to replace it
                      </p>
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

              {activeTab === 'users' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-6">{t('userManagement') || 'User Management'}</h2>

                  {userActionSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
                      {userActionSuccess}
                    </div>
                  )}

                  {/* Search */}
                  <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="text"
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers(usersSearch)}
                      placeholder="Search users by email or name..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => fetchUsers(usersSearch)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover"
                    >
                      Search
                    </button>
                  </div>

                  {/* Users List */}
                  {usersLoading ? (
                    <div className="text-center py-8 text-text-secondary">Loading...</div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">No users found</div>
                  ) : (
                    <div className="space-y-4">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className={`p-4 rounded-xl bg-background border ${selectedUser === user.id ? 'border-accent' : 'border-border'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-foreground">{user.name || 'No name'}</p>
                              <p className="text-sm text-text-secondary">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${user.tier === 'PRO' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {user.tier}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                            <div>
                              <span className="text-text-secondary">Daily:</span>{' '}
                              <span className="text-foreground">{user.dailyUsage} used</span>
                            </div>
                            <div>
                              <span className="text-text-secondary">Monthly:</span>{' '}
                              <span className="text-foreground">{user.monthlyUsage} used</span>
                            </div>
                          </div>

                          {selectedUser === user.id ? (
                            <div className="space-y-4 pt-3 border-t border-border">
                              <div className="grid grid-cols-2 gap-4">
                                {/* Tier */}
                                <div>
                                  <label className="block text-sm font-medium text-text-secondary mb-1">Tier</label>
                                  <select
                                    id={`tier-${user.id}`}
                                    defaultValue={user.tier}
                                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm"
                                  >
                                    <option value="FREE">FREE</option>
                                    <option value="PRO">PRO</option>
                                  </select>
                                </div>
                                {/* Credits to add */}
                                <div>
                                  <label className="block text-sm font-medium text-text-secondary mb-1">Add Credits</label>
                                  <input
                                    type="number"
                                    id={`credits-${user.id}`}
                                    min="0"
                                    defaultValue={0}
                                    placeholder="0"
                                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" id={`reset-daily-${user.id}`} className="rounded" />
                                  <span>Reset Daily Usage</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" id={`reset-monthly-${user.id}`} className="rounded" />
                                  <span>Reset Monthly Usage</span>
                                </label>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const tier = (document.getElementById(`tier-${user.id}`) as HTMLSelectElement).value
                                    const addCredits = parseInt((document.getElementById(`credits-${user.id}`) as HTMLInputElement).value) || 0
                                    const resetDaily = (document.getElementById(`reset-daily-${user.id}`) as HTMLInputElement).checked
                                    const resetMonthly = (document.getElementById(`reset-monthly-${user.id}`) as HTMLInputElement).checked
                                    handleUpdateUser(user.id, {
                                      tier,
                                      addCredits,
                                      resetDailyUsage: resetDaily,
                                      resetMonthlyUsage: resetMonthly,
                                    })
                                  }}
                                  disabled={userActionLoading}
                                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
                                >
                                  {userActionLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                  onClick={() => setSelectedUser(null)}
                                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedUser(user.id)}
                              className="w-full mt-2 px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface flex items-center justify-center gap-2"
                            >
                              <CreditCard className="w-4 h-4" />
                              Manage Quota
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
