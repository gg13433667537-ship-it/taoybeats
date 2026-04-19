"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { X, Upload, Mic, Loader2, AlertCircle, Check, Music, Sparkles, Play, Pause } from "lucide-react"

interface CloneVoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (voiceId: string) => void
}

type Tab = 'upload' | 'record' | 'design'

// Preset voices for AI design
const PRESET_VOICES = [
  { name: '温暖男声', prompt: '一个25岁的男孩，声音温暖柔和，带有一点磁性' },
  { name: '活泼女声', prompt: '一个20岁的女孩，声音活泼可爱，充满青春活力' },
  { name: '磁性低沉', prompt: '一个30岁的男人，声音低沉有磁性，像深夜电台主持' },
  { name: '甜美女声', prompt: '一个18岁的女孩，声音甜美动人，清脆悦耳' },
  { name: '硬朗大叔', prompt: '一个40岁的男人，声音粗犷有力，成熟稳重' },
  { name: '清亮少年', prompt: '一个16岁的少年，声音清澈明亮，阳光帅气' },
]

const PREVIEW_TEXT = '你好，我是你的AI音色助手。很高兴为你服务。'

interface ModalState {
  activeTab: Tab
  isCloning: boolean
  isRecording: boolean
  recordingTime: number
  error: string | null
  success: string | null
  audioBlob: Blob | null
  // Design tab
  selectedPreset: string | null
  customPrompt: string
  isDesigning: boolean
  trialAudioUrl: string | null
  designedVoiceId: string | null
}

const initialState: ModalState = {
  activeTab: 'upload',
  isCloning: false,
  isRecording: false,
  recordingTime: 0,
  error: null,
  success: null,
  audioBlob: null,
  selectedPreset: null,
  customPrompt: '',
  isDesigning: false,
  trialAudioUrl: null,
  designedVoiceId: null,
}

// Helper to generate unique voice ID
const generateVoiceId = (): string => {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// Voice Design Content Subcomponent
interface VoiceDesignContentProps {
  selectedPreset: string | null
  customPrompt: string
  isDesigning: boolean
  trialAudioUrl: string | null
  designedVoiceId: string | null
  onSelectPreset: (preset: string) => void
  onCustomPromptChange: (prompt: string) => void
  onDesign: () => void
  onSave: () => void
  onUse: () => void
}

function VoiceDesignContent({
  selectedPreset,
  customPrompt,
  isDesigning,
  trialAudioUrl,
  designedVoiceId,
  onSelectPreset,
  onCustomPromptChange,
  onDesign,
  onSave,
  onUse,
}: VoiceDesignContentProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">预设音色（选择即可）</label>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_VOICES.map(preset => (
            <button
              key={preset.name}
              onClick={() => onSelectPreset(preset.name)}
              className={`p-2 rounded-lg border text-left transition-colors ${
                selectedPreset === preset.name
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent'
              }`}
            >
              <p className="text-xs font-medium text-foreground">{preset.name}</p>
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
        <label className="block text-sm font-medium text-text-secondary mb-2">自定义描述</label>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="输入音色描述，例如：一个25岁的男孩，声音温柔，有点沙哑..."
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none text-sm"
        />
      </div>

      {/* Preview Audio */}
      {trialAudioUrl && (
        <div className="p-3 rounded-xl bg-surface-elevated">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-foreground">试听音色</p>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
          <audio
            ref={audioRef}
            src={trialAudioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <div className="h-8 rounded-lg bg-surface flex items-center justify-center text-xs text-text-muted">
            音频预览
          </div>
        </div>
      )}

      {/* Fee Notice */}
      <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
        <p className="text-xs text-warning">💡 AI生成音色会产生费用，2元/万字符</p>
      </div>

      {/* Generate Button */}
      <button
        onClick={onDesign}
        disabled={isDesigning || (!selectedPreset && !customPrompt.trim())}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isDesigning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            生成音色
          </>
        )}
      </button>

      {/* Save Button */}
      {designedVoiceId && (
        <button
          onClick={onSave}
          disabled={isDesigning}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isDesigning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              保存到我的音色
            </>
          )}
        </button>
      )}

      {/* Use Button - Use directly without saving */}
      {designedVoiceId && (
        <button
          onClick={onUse}
          className="w-full py-2.5 rounded-xl border border-border hover:border-accent text-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          直接使用（不保存）
        </button>
      )}
    </div>
  )
}

export default function CloneVoiceModal({ isOpen, onClose, onSuccess }: CloneVoiceModalProps) {
  const [state, setState] = useState<ModalState>(initialState)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { activeTab, isCloning, isRecording, recordingTime, error, success, audioBlob, selectedPreset, customPrompt, isDesigning, trialAudioUrl, designedVoiceId } = state

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Register cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Handle open/close - reset state when opening
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setState(initialState)
      audioChunksRef.current = []
    } else {
      cleanup()
    }
  }, [cleanup])

  // Watch for isOpen changes
  useEffect(() => {
    handleOpenChange(isOpen)
  }, [isOpen, handleOpenChange])

  // File upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Supported audio formats with extensions
    const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.webm']
    const validMimeTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/aac', 'audio/flac',
      'audio/webm', 'audio/webm;codecs=opus'
    ]

    // Get file extension
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    const hasValidMimeType = validMimeTypes.includes(file.type)

    if (!hasValidExtension && !hasValidMimeType) {
      setState(s => ({ ...s, error: '仅支持 mp3, wav, m4a, ogg, aac, flac, webm 格式' }))
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setState(s => ({ ...s, error: '文件大小不能超过 20MB' }))
      return
    }

    setState(s => ({ ...s, audioBlob: file, error: null }))
  }

  // Start recording
  const startRecording = async () => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState(s => ({ ...s, error: '您的浏览器不支持录音功能，请使用 Chrome、Safari 或 Firefox' }))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setState(s => ({ ...s, audioBlob: blob }))
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setState(s => ({ ...s, isRecording: true, recordingTime: 0, error: null }))

      timerRef.current = setInterval(() => {
        setState(s => {
          if (s.recordingTime >= 8) {
            stopRecording()
            return s
          }
          return { ...s, recordingTime: s.recordingTime + 1 }
        })
      }, 1000)
    } catch (error: unknown) {
      const err = error as Error & { name?: string }
      let errorMessage = '无法访问麦克风，请检查权限设置'

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问，然后刷新页面重试'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = '未找到麦克风设备，请确保已连接麦克风'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = '麦克风正在被其他应用使用，请关闭其他使用麦克风的程序后重试'
      } else if (err.name === 'SecurityError' || err.name === 'SecurityError') {
        errorMessage = '麦克风访问被安全策略阻止，请确保使用 HTTPS 或 localhost'
      }

      setState(s => ({ ...s, error: errorMessage }))
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState(s => ({ ...s, isRecording: false }))
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  // Clone voice
  const handleClone = async () => {
    if (!audioBlob) {
      setState(s => ({ ...s, error: '请先上传音频或录音' }))
      return
    }

    setState(s => ({ ...s, isCloning: true, error: null, success: null }))

    try {
      const base64 = await blobToBase64(audioBlob)
      const filename = activeTab === 'record' ? 'recording.wav' : 'audio.mp3'

      const uploadResponse = await fetch('/api/voice/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_data: base64,
          filename,
          purpose: 'prompt_audio',
        }),
      })

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || '上传音频失败')
      }

      const fileId = uploadData.file?.file_id
      if (!fileId) {
        throw new Error('上传音频失败，未获取到file_id')
      }

      const voiceId = generateVoiceId()

      const cloneResponse = await fetch('/api/voice/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          voice_id: voiceId,
        }),
      })

      const cloneData = await cloneResponse.json()

      if (!cloneResponse.ok) {
        throw new Error(cloneData.error || '克隆音色失败')
      }

      setState(s => ({ ...s, success: '音色克隆成功！' }))
      if (cloneData.demo_audio) {
        setState(s => ({ ...s, trialAudioUrl: `data:audio/wav;base64,${cloneData.demo_audio}` }))
      }

      timeoutRef.current = setTimeout(() => {
        onSuccess(cloneData.voice_id)
        onClose()
      }, 1500)
    } catch (err) {
      setState(s => ({ ...s, error: err instanceof Error ? err.message : '克隆失败，请重试' }))
    } finally {
      setState(s => ({ ...s, isCloning: false }))
    }
  }

  // Helper: blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Handle voice design
  const handleVoiceDesign = async () => {
    const prompt = state.selectedPreset
      ? PRESET_VOICES.find(p => p.name === state.selectedPreset)?.prompt
      : state.customPrompt.trim()

    if (!prompt) {
      setState(s => ({ ...s, error: '请选择预设音色或输入自定义描述' }))
      return
    }

    setState(s => ({ ...s, isDesigning: true, error: null, success: null }))

    try {
      const response = await fetch('/api/voice/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          preview_text: PREVIEW_TEXT,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成失败')
      }

      let trialUrl = null
      if (data.trial_audio) {
        try {
          const hex = data.trial_audio
          const bytes = new Uint8Array(hex.length / 2)
          for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
          }
          const blob = new Blob([bytes], { type: 'audio/wav' })
          trialUrl = URL.createObjectURL(blob)
        } catch {
          // Ignore audio conversion errors
        }
      }

      setState(s => ({
        ...s,
        isDesigning: false,
        designedVoiceId: data.voice_id,
        trialAudioUrl: trialUrl,
        success: '音色生成成功！点击"保存到我的音色"将此音色保存到列表',
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : '生成失败，请重试',
        isDesigning: false,
      }))
    }
  }

  // Save designed voice - the voice_id from design API should be usable directly
  // but we need to verify it appears in the voice list
  const handleSaveDesignedVoice = async () => {
    if (!state.designedVoiceId) return

    setState(s => ({ ...s, isDesigning: true, error: null, success: null }))

    try {
      // First verify the voice appears in the list
      const listResponse = await fetch('/api/voice/list?voice_type=all', {
        method: 'GET',
      })

      if (!listResponse.ok) {
        throw new Error('验证音色失败')
      }

      const listData = await listResponse.json()
      const voiceExists = (listData.voice_generation || []).some(
        (v: { voice_id: string }) => v.voice_id === state.designedVoiceId
      )

      if (voiceExists) {
        // Voice is already in the list, just use it
        setState(s => ({ ...s, success: '音色已在列表中！' }))
        setTimeout(() => {
          onSuccess(state.designedVoiceId!)
          onClose()
        }, 800)
      } else {
        // Voice not in list - this is expected for design preview
        // Show info that this is a preview and user needs to use clone to save it
        setState(s => ({
          ...s,
          isDesigning: false,
          error: null,
        }))
        // The designed voice can still be used directly even if not in list
        // MiniMax's design API returns a usable voice_id
        setState(s => ({ ...s, success: '音色已生成（预览），可直接使用！' }))
        setTimeout(() => {
          onSuccess(state.designedVoiceId!)
          onClose()
        }, 800)
      }
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : '保存失败，请重试',
        isDesigning: false,
      }))
    }
  }

  const handleClose = () => {
    cleanup()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">克隆我的声音</h2>
              <p className="text-sm text-text-muted">上传音频或录音来克隆音色</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="w-5 h-5 text-text-muted" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success flex items-center gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              {success}
            </div>
          )}

          <div role="tablist" className="flex gap-2 p-1 bg-surface-elevated rounded-xl">
            <button
              role="tab"
              aria-selected={activeTab === 'upload'}
              onClick={() => setState(s => ({ ...s, activeTab: 'upload' }))}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'upload' ? 'bg-surface text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              上传音频
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'record'}
              onClick={() => setState(s => ({ ...s, activeTab: 'record' }))}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'record' ? 'bg-surface text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Mic className="w-4 h-4" aria-hidden="true" />
              录音
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'design'}
              onClick={() => setState(s => ({ ...s, activeTab: 'design' }))}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'design' ? 'bg-surface text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              AI生成
            </button>
          </div>

          {activeTab === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                audioBlob ? 'border-success bg-success/5' : 'border-border hover:border-accent'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/m4a,audio/x-m4a,audio/ogg,audio/aac,audio/flac,audio/webm,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm"
                onChange={handleFileChange}
                className="hidden"
              />

              {audioBlob ? (
                <div className="flex items-center gap-3">
                  <Music className="w-8 h-8 text-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">音频已选择</p>
                    <p className="text-xs text-text-muted">{(audioBlob as File).name || 'recording.wav'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-foreground">点击或拖拽上传音频</p>
                  <p className="text-xs text-text-muted mt-1">支持 mp3, wav, m4a, ogg, aac, flac, webm 格式</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'record' && (
            <div className="p-8 rounded-xl border border-border text-center">
              {isRecording ? (
                <div>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">录音中...</p>
                  <p className="text-2xl font-mono text-foreground mb-4">0:{recordingTime.toString().padStart(2, '0')} / 0:08</p>
                  <button
                    onClick={stopRecording}
                    aria-label="Stop recording"
                    className="px-6 py-2 rounded-xl bg-error hover:bg-error/90 text-white text-sm font-medium transition-colors"
                  >
                    停止录音
                  </button>
                </div>
              ) : audioBlob ? (
                <div>
                  <Check className="w-12 h-12 text-success mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-2">录音完成</p>
                  <p className="text-xs text-text-muted mb-4">时长: {Math.floor(recordingTime)}秒</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        setState(s => ({ ...s, audioBlob: null, recordingTime: 0 }))
                      }}
                      className="px-4 py-2 rounded-lg border border-border hover:border-accent text-text-secondary text-sm transition-colors"
                    >
                      重新录音
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={startRecording}
                    aria-label="Start recording"
                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                  >
                    <Mic className="w-8 h-8 text-white" aria-hidden="true" />
                  </button>
                  <p className="text-sm text-foreground">点击开始录音</p>
                  <p className="text-xs text-text-muted mt-1">请用普通话清晰朗读3-8秒</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'design' && (
            <VoiceDesignContent
              selectedPreset={selectedPreset}
              customPrompt={customPrompt}
              isDesigning={isDesigning}
              trialAudioUrl={trialAudioUrl}
              designedVoiceId={designedVoiceId}
              onSelectPreset={(preset) => setState(s => ({ ...s, selectedPreset: preset, customPrompt: '' }))}
              onCustomPromptChange={(prompt) => setState(s => ({ ...s, customPrompt: prompt, selectedPreset: null }))}
              onDesign={handleVoiceDesign}
              onSave={handleSaveDesignedVoice}
              onUse={() => {
                if (designedVoiceId) {
                  onSuccess(designedVoiceId)
                  onClose()
                }
              }}
            />
          )}

          {activeTab !== 'design' && (
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm text-accent font-medium mb-1">💡 录音技巧</p>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• 请用普通话清晰朗读</li>
                <li>• 确保环境安静，无背景噪音</li>
                <li>• 时长3-8秒效果最佳</li>
              </ul>
            </div>
          )}

          {/* Only show bottom button for upload and record tabs */}
          {activeTab !== 'design' && (
            <button
              onClick={handleClone}
              disabled={!audioBlob || isCloning}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  克隆中...
                </>
              ) : (
                '开始克隆'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
