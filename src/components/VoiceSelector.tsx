"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronDown, Plus, Trash2, Volume2, Loader2, AlertCircle } from "lucide-react"
import CloneVoiceModal from "./CloneVoiceModal"

interface Voice {
  voice_id: string
  voice_name?: string
  description?: string
  created_time?: string
  type: 'system' | 'cloning' | 'generation'
  isExpiringSoon?: boolean
}

interface VoiceSelectorProps {
  selectedVoiceId: string | null
  onSelectVoice: (voiceId: string) => void
  apiKey: string
}

const systemVoices: Voice[] = [
  { voice_id: 'male-qn-qingse', voice_name: '青年男声', description: '清澈温暖', type: 'system' },
  { voice_id: 'female-shaonv-yujie', voice_name: '少女御姐', description: '成熟大气', type: 'system' },
  { voice_id: 'male-bada-mengchuan', voice_name: '霸总磁力', description: '低沉磁性', type: 'system' },
]

export default function VoiceSelector({ selectedVoiceId, onSelectVoice, apiKey }: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadVoices = useCallback(async () => {
    if (!apiKey) return

    setIsLoading(true)
    setError(null)

    const abortController = new AbortController()

    try {
      const response = await fetch(`/api/voice/list?voice_type=all&apiKey=${encodeURIComponent(apiKey)}`, {
        signal: abortController.signal,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取音色列表失败')
      }

      const userVoices: Voice[] = [
        ...(data.voice_cloning || []).map((v: { voice_id: string; description?: string; created_time?: string }) => ({
          ...v,
          type: 'cloning' as const,
        })),
        ...(data.voice_generation || []).map((v: { voice_id: string; description?: string; created_time?: string }) => ({
          ...v,
          type: 'generation' as const,
        })),
      ]

      setVoices(userVoices)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : '获取音色列表失败')
    } finally {
      if (abortController.signal.aborted) return
      setIsLoading(false)
    }
  }, [apiKey])

  // Watch for isOpen changes - intentionally calls loadVoices which triggers setState
  // This is a standard "load on open" pattern for modals/dropdowns
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadVoices()
    }
  }, [isOpen, loadVoices])

  const selectedVoice = [...systemVoices, ...voices].find(v => v.voice_id === selectedVoiceId)
  const selectedVoiceName = selectedVoice?.voice_name || selectedVoice?.voice_id || '系统默认'

  const handleDeleteVoice = async (voiceId: string, voiceType: 'voice_cloning' | 'voice_generation') => {
    if (!confirm('确定要删除这个音色吗？')) return

    try {
      const response = await fetch('/api/voice/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_type: voiceType,
          voice_id: voiceId,
          apiKey,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      loadVoices()

      if (selectedVoiceId === voiceId) {
        onSelectVoice('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const getVoiceTypeLabel = (type: Voice['type']) => {
    switch (type) {
      case 'system': return '系统'
      case 'cloning': return '克隆'
      case 'generation': return 'AI生成'
      default: return ''
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-accent transition-colors"
        >
          <Volume2 className="w-4 h-4 text-text-muted" />
          <span className="text-sm text-foreground">{selectedVoiceName}</span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

            <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-20">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">选择音色</span>
                <button
                  onClick={() => {
                    setIsCloneModalOpen(true)
                    setIsOpen(false)
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  克隆音色
                </button>
              </div>

              <div className="p-2">
                <p className="px-2 py-1 text-xs text-text-muted">系统音色</p>
                {systemVoices.map(voice => (
                  <button
                    key={voice.voice_id}
                    onClick={() => {
                      onSelectVoice(voice.voice_id)
                      setIsOpen(false)
                    }}
                    className={`w-full p-3 rounded-lg flex items-center justify-between hover:bg-surface-elevated transition-colors ${
                      selectedVoiceId === voice.voice_id ? 'bg-accent/10 border border-accent/30' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{voice.voice_name}</p>
                      <p className="text-xs text-text-muted">{voice.description}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-text-muted">
                      {getVoiceTypeLabel(voice.type)}
                    </span>
                  </button>
                ))}
              </div>

              {voices.length > 0 && (
                <div className="p-2 border-t border-border">
                  <p className="px-2 py-1 text-xs text-text-muted">我的音色</p>
                  {voices.map(voice => (
                    <div
                      key={voice.voice_id}
                      className={`p-3 rounded-lg flex items-center justify-between hover:bg-surface-elevated transition-colors ${
                        selectedVoiceId === voice.voice_id ? 'bg-accent/10 border border-accent/30' : ''
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectVoice(voice.voice_id)
                          setIsOpen(false)
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{voice.voice_id}</p>
                          {voice.isExpiringSoon && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                              即将过期
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">{voice.description}</p>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteVoice(voice.voice_id, voice.type === 'cloning' ? 'voice_cloning' : 'voice_generation')
                        }}
                        className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                </div>
              )}

              {error && (
                <div className="p-4 flex items-center gap-2 text-error text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {!isLoading && voices.length === 0 && (
                <div className="p-6 text-center text-text-muted text-sm">
                  还没有克隆的音色
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CloneVoiceModal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        onSuccess={(voiceId) => {
          onSelectVoice(voiceId)
          loadVoices()
        }}
        apiKey={apiKey}
      />
    </>
  )
}
