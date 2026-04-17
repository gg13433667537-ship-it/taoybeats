"use client"

import { useState, useRef, useCallback } from "react"
import { X, Upload, Mic, Loader2, AlertCircle, Check, Music } from "lucide-react"

interface CloneVoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (voiceId: string) => void
  apiKey: string
}

type Tab = 'upload' | 'record'

interface ModalState {
  activeTab: Tab
  isCloning: boolean
  isRecording: boolean
  recordingTime: number
  error: string | null
  success: string | null
  audioBlob: Blob | null
  demoAudioUrl: string | null
}

const initialState: ModalState = {
  activeTab: 'upload',
  isCloning: false,
  isRecording: false,
  recordingTime: 0,
  error: null,
  success: null,
  audioBlob: null,
  demoAudioUrl: null,
}

// Helper to generate unique voice ID
const generateVoiceId = (): string => {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

export default function CloneVoiceModal({ isOpen, onClose, onSuccess, apiKey }: CloneVoiceModalProps) {
  const [state, setState] = useState<ModalState>(initialState)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { activeTab, isCloning, isRecording, recordingTime, error, success, audioBlob } = state

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

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
  useState(() => {
    handleOpenChange(isOpen)
  })

  // File upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a']
    if (!validTypes.includes(file.type)) {
      setState(s => ({ ...s, error: '仅支持 mp3, wav, m4a 格式' }))
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
      setState(s => ({ ...s, isRecording: true, recordingTime: 0 }))

      timerRef.current = setInterval(() => {
        setState(s => {
          if (s.recordingTime >= 8) {
            stopRecording()
            return s
          }
          return { ...s, recordingTime: s.recordingTime + 1 }
        })
      }, 1000)
    } catch {
      setState(s => ({ ...s, error: '无法访问麦克风，请检查权限设置' }))
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
          apiKey,
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
          apiKey,
        }),
      })

      const cloneData = await cloneResponse.json()

      if (!cloneResponse.ok) {
        throw new Error(cloneData.error || '克隆音色失败')
      }

      setState(s => ({ ...s, success: '音色克隆成功！' }))
      if (cloneData.demo_audio) {
        setState(s => ({ ...s, demoAudioUrl: `data:audio/wav;base64,${cloneData.demo_audio}` }))
      }

      setTimeout(() => {
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
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="w-5 h-5 text-text-muted" />
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

          <div className="flex gap-2 p-1 bg-surface-elevated rounded-xl">
            <button
              onClick={() => setState(s => ({ ...s, activeTab: 'upload' }))}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'upload' ? 'bg-surface text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Upload className="w-4 h-4" />
              上传音频
            </button>
            <button
              onClick={() => setState(s => ({ ...s, activeTab: 'record' }))}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'record' ? 'bg-surface text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Mic className="w-4 h-4" />
              录音
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
                accept="audio/mp3,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/m4a,audio/x-m4a"
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
                  <p className="text-xs text-text-muted mt-1">支持 mp3, wav, m4a 格式</p>
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
                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                  >
                    <Mic className="w-8 h-8 text-white" />
                  </button>
                  <p className="text-sm text-foreground">点击开始录音</p>
                  <p className="text-xs text-text-muted mt-1">请用普通话清晰朗读3-8秒</p>
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-sm text-accent font-medium mb-1">💡 录音技巧</p>
            <ul className="text-xs text-text-muted space-y-1">
              <li>• 请用普通话清晰朗读</li>
              <li>• 确保环境安静，无背景噪音</li>
              <li>• 时长3-8秒效果最佳</li>
            </ul>
          </div>

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
        </div>
      </div>
    </div>
  )
}
