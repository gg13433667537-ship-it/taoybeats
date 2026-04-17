"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Music } from "lucide-react"
import ReferenceAudioUploader from "./ReferenceAudioUploader"

interface AdvancedOptionsProps {
  referenceAudio: string | null
  onReferenceAudioChange: (data: string | null) => void
}

export default function AdvancedOptions({
  referenceAudio,
  onReferenceAudioChange,
}: AdvancedOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-foreground">高级选项</span>
          {referenceAudio && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
              已选择参考音频
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 bg-surface space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              参考音频（可选）
            </label>
            <p className="text-xs text-text-muted mb-3">
              上传参考音频后，AI会学习这个音频的风格来生成新音乐
            </p>
            <ReferenceAudioUploader
              selectedAudio={referenceAudio}
              onSelect={onReferenceAudioChange}
              onRemove={() => onReferenceAudioChange(null)}
            />
          </div>

          <div className="p-3 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-xs text-text-muted">
              💡 提示：参考音频可以帮助AI更好地理解你想要的音乐风格。
              请确保你拥有该音频的版权。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
