"use client"

import { useState, useRef } from "react"
import { Upload, X, Music, AlertCircle } from "lucide-react"

interface ReferenceAudioUploaderProps {
  onSelect: (audioData: string) => void
  onRemove: () => void
  selectedAudio: string | null
  selectedUrl?: string
  onUrlChange?: (url: string) => void
}

export default function ReferenceAudioUploader({
  onSelect,
  onRemove,
  selectedAudio,
  selectedUrl,
  onUrlChange,
}: ReferenceAudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState(selectedUrl || '')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await processFile(file)
  }

  const processFile = async (file: File) => {
    setError(null)

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a']
    if (!validTypes.includes(file.type)) {
      setError('仅支持 mp3, wav, m4a 格式')
      return
    }

    // Validate file size (50MB max for cover)
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过 50MB')
      return
    }

    // Validate duration (10 seconds to 10 minutes) - matching Suno's 30min capability
    // For longer audio, we could add server-side validation if needed

    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64 = await base64Promise
      onSelect(base64)
    } catch {
      setError('读取文件失败，请重试')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  if (selectedAudio) {
    return (
      <div className="p-4 rounded-xl bg-surface-elevated border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="w-5 h-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-foreground">参考音频已选择</p>
              <p className="text-xs text-text-muted">AI将学习这个音频的风格</p>
            </div>
          </div>
          <button
            onClick={onRemove}
            aria-label="Remove reference audio"
            className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Upload reference audio"
        className={`p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/m4a,audio/x-m4a"
          onChange={handleFileChange}
          aria-label="Reference audio file input"
          className="hidden"
        />

        <div className="text-center">
          <Upload className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-foreground">点击或拖拽上传参考音频</p>
          <p className="text-xs text-text-muted mt-1">支持 mp3, wav, m4a 格式，时长10秒-10分钟</p>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-3 rounded-lg bg-error/10 text-error text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
