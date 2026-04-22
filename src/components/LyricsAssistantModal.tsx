"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { X, Loader2, Sparkles, RefreshCw, Check, AlertCircle } from "lucide-react"

interface LyricsAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (lyrics: string, title?: string, styleTags?: string[]) => void
  initialTitle?: string
  initialMood?: string
}

const STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "Pop", label: "流行" },
  { value: "Hip-Hop", label: "嘻哈" },
  { value: "Rock", label: "摇滚" },
  { value: "Electronic", label: "电子" },
  { value: "R&B", label: "R&B" },
  { value: "Jazz", label: "爵士" },
  { value: "Classical", label: "古典" },
  { value: "Country", label: "乡村" },
  { value: "Reggae", label: "雷鬼" },
  { value: "Folk", label: "民谣" },
  { value: "Metal", label: "金属" },
  { value: "Indie", label: "独立" },
  { value: "Mandopop", label: "华语流行" },
  { value: "K-Pop", label: "K-Pop" },
  { value: "Latin", label: "拉丁" },
]

const MOOD_OPTIONS: { value: string; label: string }[] = [
  { value: "Happy", label: "快乐" },
  { value: "Sad", label: "悲伤" },
  { value: "Energetic", label: "活力" },
  { value: "Calm", label: "平静" },
  { value: "Romantic", label: "浪漫" },
  { value: "Epic", label: "史诗" },
  { value: "Dark", label: "暗黑" },
  { value: "Dreamy", label: "梦幻" },
  { value: "Festive", label: "节日" },
  { value: "Celebration", label: "庆祝" },
  { value: "Chill", label: "慵懒" },
  { value: "Uplifting", label: "振奋" },
  { value: "Melancholic", label: "忧郁" },
  { value: "Intense", label: "激烈" },
]

const STORAGE_KEY = 'taoybeats_lyrics_draft'

interface LyricsDraft {
  title: string
  framework: string
  style: string[]
  mood: string[]
  generatedLyrics: string | null
  lastSavedAt: number
}

interface ModalState {
  title: string
  framework: string
  selectedStyles: string[]
  mood: string[]
  generatedLyrics: string | null
  editedLyrics: string | null
  generatedStyleTags: string[] | null
  isGenerating: boolean
  isConfirming: boolean
  error: string | null
  hasUserModified: boolean
}

const getInitialState = (initialTitle: string, initialMood: string): ModalState => ({
  title: initialTitle,
  framework: '',
  selectedStyles: [],
  mood: initialMood ? [initialMood] : [],
  generatedLyrics: null,
  editedLyrics: null,
  generatedStyleTags: null,
  isGenerating: false,
  isConfirming: false,
  error: null,
  hasUserModified: false,
})

export default function LyricsAssistantModal({
  isOpen,
  onClose,
  onConfirm,
  initialTitle = '',
  initialMood = '',
}: LyricsAssistantModalProps) {
  const [state, setState] = useState<ModalState>(() => getInitialState(initialTitle, initialMood))

  const { title, framework, selectedStyles, mood, generatedLyrics, editedLyrics, generatedStyleTags, isGenerating, isConfirming, error, hasUserModified } = state

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const draft: LyricsDraft = JSON.parse(saved)
        if (Date.now() - draft.lastSavedAt < 30 * 60 * 1000) {
          setState(s => ({
            ...s,
            title: draft.title || initialTitle,
            framework: draft.framework || '',
            selectedStyles: draft.style || [],
            mood: draft.mood || initialMood,
            generatedLyrics: draft.generatedLyrics,
            editedLyrics: draft.generatedLyrics,
          }))
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [initialTitle, initialMood])

  // Handle open/close
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setState(getInitialState(initialTitle, initialMood))
      loadDraft()
    }
  }, [initialTitle, initialMood, loadDraft])

  // Watch for isOpen changes
  useEffect(() => {
    handleOpenChange(isOpen)
  }, [isOpen, handleOpenChange])

  // Auto-save to localStorage - use refs to avoid stale closures
  const stateRef = useRef({ title, framework, selectedStyles, mood, editedLyrics, generatedLyrics })

  useEffect(() => {
    stateRef.current = { title, framework, selectedStyles, mood, editedLyrics, generatedLyrics }
  }, [title, framework, selectedStyles, mood, editedLyrics, generatedLyrics])

  useEffect(() => {
    if (!isOpen || !generatedLyrics) return

    const interval = setInterval(() => {
      const { title, framework, selectedStyles, mood, editedLyrics, generatedLyrics } = stateRef.current
      const draft: LyricsDraft = {
        title,
        framework,
        style: selectedStyles,
        mood,
        generatedLyrics: editedLyrics || generatedLyrics,
        lastSavedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen, generatedLyrics])

  // Toggle style selection
  const toggleStyle = (style: string) => {
    setState(s => ({
      ...s,
      selectedStyles: s.selectedStyles.includes(style)
        ? s.selectedStyles.filter(st => st !== style)
        : [...s.selectedStyles, style]
    }))
  }

  // Toggle mood selection (multi-select)
  const toggleMood = (moodValue: string) => {
    setState(s => ({
      ...s,
      mood: s.mood.includes(moodValue)
        ? s.mood.filter(m => m !== moodValue)
        : [...s.mood, moodValue]
    }))
  }

  // Generate lyrics
  const handleGenerate = async () => {
    if (!title.trim()) {
      setState(s => ({ ...s, error: "请输入歌曲标题" }))
      return
    }

    setState(s => ({ ...s, isGenerating: true, error: null }))

    try {
      const prompt = [
        selectedStyles.length > 0 ? selectedStyles.join(', ') : '',
        mood.length > 0 ? mood.join(', ') : '',
      ].filter(Boolean).join(', ')

      // API key is now handled server-side
      const response = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: framework.trim() ? 'edit' : 'write_full_song',
          prompt: prompt || undefined,
          lyrics: framework.trim() || undefined,
          title: title.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成失败')
      }

      // Parse style_tags from API response
      const styleTags = data.style_tags
        ? data.style_tags.split(',').map((s: string) => s.trim()).filter(Boolean)
        : null

      setState(s => ({
        ...s,
        generatedLyrics: data.lyrics,
        editedLyrics: data.lyrics,
        generatedStyleTags: styleTags,
        hasUserModified: false,
        isGenerating: false,
      }))

      const draft: LyricsDraft = {
        title,
        framework,
        style: selectedStyles,
        mood,
        generatedLyrics: data.lyrics,
        lastSavedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : '生成失败，请重试',
        isGenerating: false
      }))
    }
  }

  // Confirm and use lyrics
  const handleConfirm = () => {
    if (!editedLyrics) return

    setState(s => ({ ...s, isConfirming: true }))
    localStorage.removeItem(STORAGE_KEY)
    onConfirm(editedLyrics, title.trim(), generatedStyleTags || undefined)
    setState(s => ({ ...s, isConfirming: false }))
    onClose()
  }

  // Handle close
  const handleClose = () => {
    if (generatedLyrics) {
      const draft: LyricsDraft = {
        title,
        framework,
        style: selectedStyles,
        mood,
        generatedLyrics: editedLyrics || generatedLyrics,
        lastSavedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    }
    onClose()
  }

  // Handle text edit
  const handleTextChange = (text: string) => {
    setState(s => ({
      ...s,
      editedLyrics: text,
      hasUserModified: true
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI歌词助手</h2>
              <p className="text-sm text-text-muted">输入框架，AI帮你创作完整歌词</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close" className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              歌曲标题 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setState(s => ({ ...s, title: e.target.value }))}
              placeholder="给你的歌起个名字"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              风格标签（可多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(style => (
                <button
                  key={style.value}
                  onClick={() => toggleStyle(style.value)}
                  aria-pressed={selectedStyles.includes(style.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedStyles.includes(style.value)
                      ? 'bg-accent text-white'
                      : 'bg-background border border-border text-text-secondary hover:border-accent'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              情绪（可多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.value}
                  onClick={() => toggleMood(m.value)}
                  aria-pressed={mood.includes(m.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    mood.includes(m.value)
                      ? 'bg-accent text-white'
                      : 'bg-background border border-border text-text-secondary hover:border-accent'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              歌词框架（可选）
            </label>
            <textarea
              value={framework}
              onChange={(e) => setState(s => ({ ...s, framework: e.target.value }))}
              placeholder={`输入你的歌词框架，例如：\n[Verse]\n第一段歌词...\n[Chorus]\n副歌部分...`}
              rows={6}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono text-sm"
            />
            <p className="mt-1 text-xs text-text-muted">
              💡 使用 [Verse]、[Chorus]、[Bridge] 等标签指定结构，不指定则AI自动判断
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !title.trim()}
              aria-label="Generate lyrics with AI"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                  AI生成歌词
                </>
              )}
            </button>
          </div>

          {generatedLyrics && (
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">生成的歌词</h3>
                {hasUserModified && (
                  <span className="text-xs text-text-muted">已编辑</span>
                )}
              </div>

              <textarea
                value={editedLyrics || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="生成的歌词将显示在这里..."
                rows={12}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono text-sm whitespace-pre-wrap"
              />

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  aria-label="Regenerate lyrics"
                  className="px-4 py-2 rounded-lg border border-border hover:border-accent text-text-secondary text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  重新生成
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={isConfirming || !editedLyrics}
                  aria-label="Confirm and use lyrics"
                  className="px-6 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      确认中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      确认使用歌词
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
