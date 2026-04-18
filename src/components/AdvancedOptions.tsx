"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Music, Disc, FileAudio, Wand2, Gauge } from "lucide-react"
import ReferenceAudioUploader from "./ReferenceAudioUploader"

interface AdvancedOptionsProps {
  referenceAudio: string | null
  onReferenceAudioChange: (data: string | null) => void
  model?: 'music-2.6' | 'music-cover'
  onModelChange?: (model: 'music-2.6' | 'music-cover') => void
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  onOutputFormatChange?: (format: 'mp3' | 'wav' | 'pcm') => void
  lyricsOptimizer?: boolean
  onLyricsOptimizerChange?: (enabled: boolean) => void
  sampleRate?: 16000 | 24000 | 32000 | 44100
  onSampleRateChange?: (rate: 16000 | 24000 | 32000 | 44100) => void
  bitrate?: 32000 | 64000 | 128000 | 256000
  onBitrateChange?: (rate: 32000 | 64000 | 128000 | 256000) => void
  aigcWatermark?: boolean
  onAigcWatermarkChange?: (enabled: boolean) => void
}

const MODELS = [
  { value: 'music-2.6', label: 'Music 2.6 (推荐)', desc: '高质量文本生成音乐' },
  { value: 'music-cover', label: 'Music Cover (翻唱)', desc: '基于参考音频生成' },
]

const OUTPUT_FORMATS = [
  { value: 'mp3', label: 'MP3', desc: '通用格式，压缩率高' },
  { value: 'wav', label: 'WAV', desc: '无损格式，文件较大' },
  { value: 'pcm', label: 'PCM', desc: '原始音频，适合后期处理' },
]

const SAMPLE_RATES = [
  { value: 16000, label: '16kHz', desc: '低带宽' },
  { value: 24000, label: '24kHz', desc: '标准' },
  { value: 32000, label: '32kHz', desc: '高质量' },
  { value: 44100, label: '44.1kHz', desc: 'CD品质' },
]

const BITRATES = [
  { value: 32000, label: '32kbps', desc: '低' },
  { value: 64000, label: '64kbps', desc: '中' },
  { value: 128000, label: '128kbps', desc: '高' },
  { value: 256000, label: '256kbps', desc: '极高' },
]

export default function AdvancedOptions({
  referenceAudio,
  onReferenceAudioChange,
  model = 'music-2.6',
  onModelChange,
  outputFormat = 'mp3',
  onOutputFormatChange,
  lyricsOptimizer = false,
  onLyricsOptimizerChange,
  sampleRate = 44100,
  onSampleRateChange,
  bitrate = 256000,
  onBitrateChange,
  aigcWatermark = false,
  onAigcWatermarkChange,
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
          {model !== 'music-2.6' && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
              已自定义
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
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
              <Disc className="w-4 h-4" />
              生成模型
            </label>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => onModelChange?.(m.value as 'music-2.6' | 'music-cover')}
                  className={`w-full p-3 rounded-xl border text-left transition-colors ${
                    model === m.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface-elevated hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{m.label}</span>
                    {model === m.value && (
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-white">已选</span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
              <FileAudio className="w-4 h-4" />
              输出格式
            </label>
            <div className="flex gap-2">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onOutputFormatChange?.(f.value as 'mp3' | 'wav' | 'pcm')}
                  className={`flex-1 p-3 rounded-xl border text-center transition-colors ${
                    outputFormat === f.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface-elevated hover:border-accent/50'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{f.label}</div>
                  <p className="text-xs text-text-muted mt-1">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Lyrics Optimizer */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              智能歌词生成
            </label>
            <button
              onClick={() => onLyricsOptimizerChange?.(!lyricsOptimizer)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${
                lyricsOptimizer
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-surface-elevated hover:border-accent/50'
              }`}
            >
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">自动生成歌词</div>
                <p className="text-xs text-text-muted mt-1">根据音乐风格描述自动生成完整歌词</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                lyricsOptimizer ? 'bg-accent border-accent' : 'border-text-muted'
              }`}>
                {lyricsOptimizer && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          </div>

          {/* Audio Quality */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              音频质量
            </label>
            <div className="space-y-3">
              {/* Sample Rate */}
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>采样率</span>
                  <span>{sampleRate / 1000}kHz</span>
                </div>
                <div className="flex gap-1">
                  {SAMPLE_RATES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => onSampleRateChange?.(r.value as 16000 | 24000 | 32000 | 44100)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sampleRate === r.value
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated text-text-secondary hover:text-foreground'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Bitrate */}
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>比特率</span>
                  <span>{bitrate / 1000}kbps</span>
                </div>
                <div className="flex gap-1">
                  {BITRATES.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => onBitrateChange?.(b.value as 32000 | 64000 | 128000 | 256000)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        bitrate === b.value
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated text-text-secondary hover:text-foreground'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AIGC Watermark */}
          <div>
            <button
              onClick={() => onAigcWatermarkChange?.(!aigcWatermark)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${
                aigcWatermark
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-surface-elevated hover:border-accent/50'
              }`}
            >
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">AI水印</div>
                <p className="text-xs text-text-muted mt-1">添加AI生成标识（部分平台要求）</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                aigcWatermark ? 'bg-accent border-accent' : 'border-text-muted'
              }`}>
                {aigcWatermark && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          </div>

          {/* Reference Audio */}
          <div className="pt-4 border-t border-border">
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
