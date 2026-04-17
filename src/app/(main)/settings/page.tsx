"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Music, User, Key, Bell, Shield, Loader2, Check, AlertCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function SettingsPage() {
  const router = useRouter()
  const { t, lang } = useI18n()
  const [activeTab, setActiveTab] = useState('profile')
  const [saved, setSaved] = useState(false)

  const TABS = [
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'api', label: t('apiConfiguration'), icon: Key },
    { id: 'notifications', label: t('notifications'), icon: Bell },
    { id: 'security', label: t('security'), icon: Shield },
  ]

  // Profile state
  const [name, setName] = useState('Demo User')
  const [email, setEmail] = useState('demo@taoybeats.com')

  // API state
  const [apiProvider, setApiProvider] = useState('suno')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')

  const handleSave = async () => {
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
            Back to Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">{t('settingsTitle')}</h1>

          <div className="flex gap-8">
            {/* Sidebar */}
            <nav className="w-64 flex-shrink-0">
              <div className="space-y-1">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
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
                      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold">
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <button
                      onClick={handleSave}
                      className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center gap-2"
                    >
                      {saved ? <Check className="w-4 h-4" /> : null}
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">Provider</label>
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">API URL</label>
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">API Key</label>
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">Model ID <span className="text-text-muted">(optional)</span></label>
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
                      className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center gap-2"
                    >
                      {saved ? <Check className="w-4 h-4" /> : null}
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
                      { label: t('generationComplete'), description: 'Get notified when your song is ready' },
                      { label: t('generationFailed'), description: 'Get notified if generation fails' },
                      { label: t('weeklySummary'), description: 'Receive a weekly summary of your creations' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                        <div>
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="text-sm text-text-secondary">{item.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={i === 0} className="sr-only peer" />
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
                          placeholder={t('currentPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                        <input
                          type="password"
                          placeholder={t('newPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                        <input
                          type="password"
                          placeholder={t('confirmPassword')}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <button className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors">
                      {t('updatePassword')}
                    </button>

                    <div className="pt-6 border-t border-border">
                      <h3 className="font-medium text-foreground mb-4">{t('sessions')}</h3>
                      <p className="text-sm text-text-secondary mb-4">{t('manageSessions')}</p>
                      <button className="px-4 py-2 rounded-lg border border-error text-error text-sm font-medium hover:bg-error/10 transition-colors">
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
