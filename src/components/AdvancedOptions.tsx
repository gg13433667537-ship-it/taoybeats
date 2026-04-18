"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Music, Disc, FileAudio, Wand2, Gauge, Sliders, Layers, FileText } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import ReferenceAudioUploader from "./ReferenceAudioUploader"

// Enhanced Audio-to-Audio types
export interface ReferenceLyrics {
  text: string
  startTime?: number
  endTime?: number
  section?: string
}

export interface AdvancedAudioOptions {
  timbreSimilarity: number // 0.0 - 1.0
  mixMode: boolean
  mixModeVocalVolume: number // 0.0 - 1.0
  referenceLyrics: ReferenceLyrics[]
  referenceAudioUrl?: string // URL-based reference audio
}

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
  // Enhanced Audio-to-Audio options
  audioOptions?: Partial<AdvancedAudioOptions>
  onAudioOptionsChange?: (options: Partial<AdvancedAudioOptions>) => void
}

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
  audioOptions = {},
  onAudioOptionsChange,
}: AdvancedOptionsProps) {
  const { t } = useI18n()
  const [isExpanded, setIsExpanded] = useState(false)

  // Computed arrays with translated values
  const models = [
    { value: 'music-2.6', label: t('model26Label'), desc: t('model26Desc') },
    { value: 'music-cover', label: t('modelCoverLabel'), desc: t('modelCoverDesc') },
  ]

  const outputFormats = [
    { value: 'mp3', label: 'MP3', desc: t('formatMp3Desc') },
    { value: 'wav', label: 'WAV', desc: t('formatWavDesc') },
    { value: 'pcm', label: 'PCM', desc: t('formatPcmDesc') },
  ]

  const sampleRates = [
    { value: 16000, label: '16kHz', desc: t('sampleRateLow') },
    { value: 24000, label: '24kHz', desc: t('sampleRateStandard') },
    { value: 32000, label: '32kHz', desc: t('sampleRateHigh') },
    { value: 44100, label: '44.1kHz', desc: t('sampleRateCd') },
  ]

  const bitrates = [
    { value: 32000, label: '32kbps', desc: t('bitrateLow') },
    { value: 64000, label: '64kbps', desc: t('bitrateMedium') },
    { value: 128000, label: '128kbps', desc: t('bitrateHigh') },
    { value: 256000, label: '256kbps', desc: t('bitrateVeryHigh') },
  ]

  // Enhanced Audio-to-Audio state
  const [timbreSimilarity, setTimbreSimilarity] = useState(audioOptions.timbreSimilarity ?? 0.7)
  const [mixMode, setMixMode] = useState(audioOptions.mixMode ?? false)
  const [mixModeVocalVolume, setMixModeVocalVolume] = useState(audioOptions.mixModeVocalVolume ?? 0.5)
  const [referenceLyrics, setReferenceLyrics] = useState<ReferenceLyrics[]>(audioOptions.referenceLyrics ?? [])
  const [referenceAudioUrl, setReferenceAudioUrl] = useState(audioOptions.referenceAudioUrl ?? '')
  const [showReferenceLyricsInput, setShowReferenceLyricsInput] = useState(false)
  const [newLyricsText, setNewLyricsText] = useState('')
  const [newLyricsSection, setNewLyricsSection] = useState('')

  // Sync with parent when audioOptions changes
  const handleTimbreChange = (value: number) => {
    setTimbreSimilarity(value)
    onAudioOptionsChange?.({ timbreSimilarity: value, mixMode, mixModeVocalVolume, referenceLyrics, referenceAudioUrl })
  }

  const handleMixModeChange = (value: boolean) => {
    setMixMode(value)
    onAudioOptionsChange?.({ timbreSimilarity, mixMode: value, mixModeVocalVolume, referenceLyrics, referenceAudioUrl })
  }

  const handleMixModeVocalVolumeChange = (value: number) => {
    setMixModeVocalVolume(value)
    onAudioOptionsChange?.({ timbreSimilarity, mixMode, mixModeVocalVolume: value, referenceLyrics, referenceAudioUrl })
  }

  const handleReferenceLyricsChange = (lyrics: ReferenceLyrics[]) => {
    setReferenceLyrics(lyrics)
    onAudioOptionsChange?.({ timbreSimilarity, mixMode, mixModeVocalVolume, referenceLyrics: lyrics, referenceAudioUrl })
  }

  const handleReferenceAudioUrlChange = (url: string) => {
    setReferenceAudioUrl(url)
    onAudioOptionsChange?.({ timbreSimilarity, mixMode, mixModeVocalVolume, referenceLyrics, referenceAudioUrl: url })
  }

  const addReferenceLyrics = () => {
    if (!newLyricsText.trim()) return
    const newEntry: ReferenceLyrics = {
      text: newLyricsText.trim(),
      section: newLyricsSection.trim() || undefined,
    }
    const updated = [...referenceLyrics, newEntry]
    handleReferenceLyricsChange(updated)
    setNewLyricsText('')
    setNewLyricsSection('')
  }

  const removeReferenceLyrics = (index: number) => {
    const updated = referenceLyrics.filter((_, i) => i !== index)
    handleReferenceLyricsChange(updated)
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-foreground">{t('advancedOptions')}</span>
          {referenceAudio && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
              {t('referenceAudio')}
            </span>
          )}
          {timbreSimilarity !== 0.7 && model === 'music-cover' && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
              {t('timbre')}:{Math.round(timbreSimilarity * 100)}%
            </span>
          )}
          {mixMode && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
              {t('mixMode')}
            </span>
          )}
          {referenceLyrics.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400">
              {t('referenceLyrics')}:{referenceLyrics.length}
            </span>
          )}
          {model !== 'music-2.6' && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
              {t('coverModel')}
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
              {t('generationModel')}
            </label>
            <div className="space-y-2">
              {models.map((m) => (
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
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-white">{t('selected')}</span>
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
              {t('outputFormat')}
            </label>
            <div className="flex gap-2">
              {outputFormats.map((f) => (
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
              {t('smartLyricsGeneration')}
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
                <div className="text-sm font-medium text-foreground">{t('autoGenerateLyrics')}</div>
                <p className="text-xs text-text-muted mt-1">{t('autoGenerateLyricsDesc')}</p>
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
              {t('audioQuality')}
            </label>
            <div className="space-y-3">
              {/* Sample Rate */}
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>{t('sampleRate')}</span>
                  <span>{sampleRate / 1000}kHz</span>
                </div>
                <div className="flex gap-1">
                  {sampleRates.map((r) => (
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
                  <span>{t('bitrate')}</span>
                  <span>{bitrate / 1000}kbps</span>
                </div>
                <div className="flex gap-1">
                  {bitrates.map((b) => (
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
                <div className="text-sm font-medium text-foreground">{t('aiWatermark')}</div>
                <p className="text-xs text-text-muted mt-1">{t('aiWatermarkDesc')}</p>
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

          {/* Reference Audio - Upload or URL */}
          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
              <Music className="w-4 h-4" />
              {t('referenceAudioOptional')}
            </label>
            <p className="text-xs text-text-muted mb-3">
              {t('referenceAudioDesc')}
            </p>

            {/* URL Input Option */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={referenceAudioUrl}
                  onChange={(e) => handleReferenceAudioUrlChange(e.target.value)}
                  placeholder={t('orInputAudioUrl')}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                {referenceAudioUrl && (
                  <button
                    onClick={() => handleReferenceAudioUrlChange('')}
                    className="px-3 py-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors text-sm"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>
            </div>

            <ReferenceAudioUploader
              selectedAudio={referenceAudio}
              onSelect={onReferenceAudioChange}
              onRemove={() => onReferenceAudioChange(null)}
            />
          </div>

          {/* Timbre Similarity Slider - Only show for music-cover model */}
          {model === 'music-cover' && (referenceAudio || referenceAudioUrl) && (
            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                {t('timbreSimilarity')}
                <span className="text-xs text-accent font-normal">({Math.round(timbreSimilarity * 100)}%)</span>
              </label>
              <p className="text-xs text-text-muted mb-3">
                {t('timbreSimilarityDesc')}
              </p>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={timbreSimilarity}
                  onChange={(e) => handleTimbreChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-accent/20 to-accent accent-accent"
                />
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{t('originalStyle')}</span>
                  <span>{t('fullImitation')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mix Mode Toggle - Only show for music-cover model with reference audio */}
          {model === 'music-cover' && (referenceAudio || referenceAudioUrl) && (
            <div className="pt-4 border-t border-border">
              <button
                onClick={() => handleMixModeChange(!mixMode)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${
                  mixMode
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-border bg-surface-elevated hover:border-blue-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Layers className={`w-5 h-5 ${mixMode ? 'text-blue-400' : 'text-text-muted'}`} />
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">{t('mixMode')}</div>
                    <p className="text-xs text-text-muted mt-1">{t('mixModeDesc')}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  mixMode ? 'bg-blue-500 border-blue-500' : 'border-text-muted'
                }`}>
                  {mixMode && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>

              {/* Mix Mode Vocal Volume Slider */}
              {mixMode && (
                <div className="mt-3 p-3 rounded-xl bg-surface-elevated border border-border">
                  <div className="flex justify-between text-xs text-text-muted mb-2">
                    <span>{t('vocalVolume')}</span>
                    <span>{Math.round(mixModeVocalVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mixModeVocalVolume}
                    onChange={(e) => handleMixModeVocalVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-blue-500/20 to-blue-500 accent-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Reference Lyrics - Only show for music-cover model with reference audio */}
          {model === 'music-cover' && (referenceAudio || referenceAudioUrl) && (
            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('referenceLyricsOptional')}
                {referenceLyrics.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                    {referenceLyrics.length}{t('items')}
                  </span>
                )}
              </label>
              <p className="text-xs text-text-muted mb-3">
                {t('referenceLyricsDesc')}
              </p>

              {/* Add Reference Lyrics Form */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={newLyricsSection}
                  onChange={(e) => setNewLyricsSection(e.target.value)}
                  placeholder={t('sectionTagPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <textarea
                    value={newLyricsText}
                    onChange={(e) => setNewLyricsText(e.target.value)}
                    placeholder={t('lyricsContentPlaceholder')}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                  />
                  <button
                    onClick={addReferenceLyrics}
                    disabled={!newLyricsText.trim()}
                    className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('add')}
                  </button>
                </div>
              </div>

              {/* Reference Lyrics List */}
              {referenceLyrics.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {referenceLyrics.map((lyrics, index) => (
                    <div key={index} className="p-3 rounded-lg bg-surface-elevated border border-border">
                      <div className="flex items-center justify-between mb-1">
                        {lyrics.section && (
                          <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                            {lyrics.section}
                          </span>
                        )}
                        <button
                          onClick={() => removeReferenceLyrics(index)}
                          className="text-xs text-error hover:text-error/80 transition-colors"
                        >
                          {t('delete')}
                        </button>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{lyrics.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-xs text-text-muted">
              💡 {t('tipReferenceAudio')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
