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
  apiKey?: string
}

// 20种主流音色模板 - 覆盖男声/女声/童声/各种风格
const defaultSystemVoices: Voice[] = [
  // 男声系列 (7种)
  { voice_id: 'male-qn-qingse', voice_name: '青年男声', description: '清澈温暖，适合抒情歌曲', type: 'system' },
  { voice_id: 'male-bada-mengchuan', voice_name: '霸总磁力', description: '低沉磁性，成熟稳重', type: 'system' },
  { voice_id: 'male-zhongnian', voice_name: '中年大叔', description: '浑厚沉稳，叙事感强', type: 'system' },
  { voice_id: 'male-wenrou', voice_name: '温柔暖男', description: '柔和温暖，治愈系', type: 'system' },
  { voice_id: 'male-cool', voice_name: '酷帅男声', description: '冷峻帅气，节奏感强', type: 'system' },
  { voice_id: 'male-aggressive', voice_name: '硬朗硬汉', description: '粗犷有力，摇滚风', type: 'system' },
  { voice_id: 'male-radio', voice_name: '播音男声', description: '标准普通话，新闻感', type: 'system' },
  // 女声系列 (8种)
  { voice_id: 'female-shaonv-yujie', voice_name: '少女御姐', description: '成熟大气，女王范', type: 'system' },
  { voice_id: 'female-tianmei', voice_name: '甜美女孩', description: '清新甜美，少女感', type: 'system' },
  { voice_id: 'female-zhixing', voice_name: '知性姐姐', description: '温柔理性，娓娓道来', type: 'system' },
  { voice_id: 'female-nvhuang', voice_name: '女王音', description: '气场强大，霸气侧漏', type: 'system' },
  { voice_id: 'female-wenyi', voice_name: '文艺女声', description: '文艺清新，诗意感', type: 'system' },
  { voice_id: 'female-gaibai', voice_name: '可爱甜心', description: '活泼可爱，元气满满', type: 'system' },
  { voice_id: 'female-radio', voice_name: '播音女声', description: '标准普通话，主持感', type: 'system' },
  { voice_id: 'female-luoli', voice_name: '萝莉娃娃音', description: '稚嫩可爱，萌萌哒', type: 'system' },
  { voice_id: 'female-qingshao', voice_name: '青涩少女', description: '害羞腼腆，青春校园', type: 'system' },
  // 童声系列 (2种)
  { voice_id: 'child-boy', voice_name: '童声男孩', description: '稚嫩纯真，清澈干净', type: 'system' },
  { voice_id: 'child-girl', voice_name: '童声女孩', description: '天真烂漫，活泼可爱', type: 'system' },
  // 特色音色 (3种)
  { voice_id: 'drama-male', voice_name: '剧情男声', description: '戏剧张力，故事感强', type: 'system' },
  { voice_id: 'drama-female', voice_name: '剧情女声', description: '情感丰富，代入感强', type: 'system' },
  { voice_id: 'voiceover', voice_name: '专业配音', description: '纪录片配音，商业品质', type: 'system' },
]

export default function VoiceSelector({ selectedVoiceId, onSelectVoice, apiKey }: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([])
  const [systemVoices, setSystemVoices] = useState<Voice[]>(defaultSystemVoices)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadVoices = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const abortController = new AbortController()

    try {
      // API key is now handled server-side, no need to pass it from client
      const response = await fetch(`/api/voice/list?voice_type=all`, {
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

      // Combine API system voices with defaults, avoiding duplicates
      const apiSystemVoices: Voice[] = (data.system_voice || []).map((v: { voice_id: string; voice_name?: string; description?: string }) => ({
        ...v,
        voice_name: v.voice_name || v.voice_id,
        type: 'system' as const,
      }))

      // Merge API system voices with defaults (API takes precedence for duplicates)
      const systemVoiceMap = new Map<string, Voice>()
      defaultSystemVoices.forEach(v => systemVoiceMap.set(v.voice_id, v))
      apiSystemVoices.forEach(v => systemVoiceMap.set(v.voice_id, v))
      const allSystemVoices = Array.from(systemVoiceMap.values())

      setVoices(userVoices)
      setSystemVoices(allSystemVoices)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : '获取音色列表失败')
    } finally {
      if (abortController.signal.aborted) return
      setIsLoading(false)
    }
  }, [])

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
          aria-label="选择语音音色 (用于语音合成)"
          aria-expanded={isOpen}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-accent transition-colors"
        >
          <Volume2 className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <span className="text-sm text-foreground">{selectedVoiceName}</span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

            <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-20">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">选择音色 (语音合成)</span>
                <button
                  onClick={() => {
                    setIsCloneModalOpen(true)
                    setIsOpen(false)
                  }}
                  aria-label="Clone voice"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
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
                        aria-label="Delete voice"
                        className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
        onSuccess={async (voiceId) => {
          // Await loadVoices to ensure the voice list is refreshed before selecting
          // This fixes the issue where newly created voices don't appear in the list
          await loadVoices()
          onSelectVoice(voiceId)
        }}
      />
    </>
  )
}
