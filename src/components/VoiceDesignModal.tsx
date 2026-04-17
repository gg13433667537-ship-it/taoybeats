"use client"

import { useState } from "react"
import { X, Loader2, AlertCircle, Check, Sparkles, Play, Pause } from "lucide-react"

interface VoiceDesignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (voiceId: string) => void
  apiKey: string
}

const PRESET_VOICES = [
  { name: '温暖男声', prompt: '一个25岁的男孩，声音温暖柔和，带有一点磁性' },
  { name: '活泼女声', prompt: '一个20岁的女孩，声音活泼可爱，充满青春活力' },
  { name: '磁性低沉', prompt: '一个30岁的男人，声音低沉有磁性，像深夜电台主持' },
  { name: '甜美女声', prompt: '一个18岁的女孩，声音甜美动人，清脆悦耳' },
  { name: '硬朗大叔', prompt: '一个40岁的男人，声音粗犷有力，成熟稳重' },
  { name: '清亮少年', prompt: '一个16岁的少年，声音清澈明亮，阳光帅气' },
]

const PREVIEW_TEXT = '你好，我是你的AI音色助手。很高兴为你服务。'

export default function VoiceDesignModal({ isOpen, onClose, onSuccess, apiKey }: VoiceDesignModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [trialAudioUrl, setTrialAudioUrl] = useState<string | null>(null)
  const [generatedVoiceId, setGeneratedVoiceId] = useState<string | null>(null)

  const handleGenerate = async () => {
    const prompt = selectedPreset
      ? PRESET_VOICES.find(p => p.name === selectedPreset)?.prompt
      : customPrompt.trim()

    if (!prompt) {
      setError('请选择预设音色或输入自定义描述')
      return
    }

    setIsGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/voice/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          preview_text: PREVIEW_TEXT,
          apiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成失败')
      }

      setGeneratedVoiceId(data.voice_id)

      // Convert hex audio to URL if available
      if (data.trial_audio) {
        try {
          // Convert hex to blob
          const hex = data.trial_audio
          const bytes = new Uint8Array(hex.length / 2)
          for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
          }
          const blob = new Blob([bytes], { type: 'audio/wav' })
          setTrialAudioUrl(URL.createObjectURL(blob))
        } catch {
          // Ignore audio conversion errors
        }
      }

      setSuccess('音色生成成功！')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUse = () => {
    if (generatedVoiceId) {
      onSuccess(generatedVoiceId)
      onClose()
    }
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  // Reset state when modal opens
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI生成音色</h2>
              <p className="text-sm text-text-muted">用文字描述生成自定义音色</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && !trialAudioUrl && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success flex items-center gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              预设音色（选择即可）
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_VOICES.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setSelectedPreset(preset.name)
                    setCustomPrompt('')
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selectedPreset === preset.name
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">或</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Custom Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              自定义描述
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value)
                setSelectedPreset(null)
              }}
              placeholder="输入音色描述，例如：一个25岁的男孩，声音温柔，有点沙哑..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Preview Audio */}
          {trialAudioUrl && (
            <div className="p-4 rounded-xl bg-surface-elevated">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">试听音色</p>
                <button
                  onClick={togglePlayback}
                  className="p-2 rounded-lg hover:bg-surface transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-foreground" />
                  ) : (
                    <Play className="w-4 h-4 text-foreground" />
                  )}
                </button>
              </div>
              <audio
                src={trialAudioUrl}
                autoPlay={isPlaying}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <div className="h-12 rounded-lg bg-surface flex items-center justify-center text-xs text-text-muted">
                音频播放器
              </div>
            </div>
          )}

          {/* Fee Notice */}
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
            <p className="text-xs text-warning">
              💡 AI生成音色会产生费用，2元/万字符
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!selectedPreset && !customPrompt.trim())}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  生成音色
                </>
              )}
            </button>

            {generatedVoiceId && (
              <button
                onClick={handleUse}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                使用音色
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
