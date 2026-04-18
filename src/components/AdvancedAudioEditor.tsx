"use client"

import { useState } from "react"
import { useI18n } from "@/lib/i18n"
import { Music, Scissors, Layers, Sparkles, Video, Globe, Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from "lucide-react"

interface AdvancedAudioEditorProps {
  songId: string
  audioUrl: string
  onProcessed?: (processedUrl: string, type: string) => void
}

type EditorTab = 'convert' | 'trim' | 'mix' | 'style' | 'video' | 'translate'

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
]

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', desc: '通用格式' },
  { value: 'wav', label: 'WAV', desc: '无损格式' },
  { value: 'flac', label: 'FLAC', desc: '高质量无损' },
  { value: 'aac', label: 'AAC', desc: '高效压缩' },
  { value: 'ogg', label: 'OGG', desc: '开源格式' },
]

const QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'lossless', label: '无损' },
]

export default function AdvancedAudioEditor({ songId, audioUrl, onProcessed }: AdvancedAudioEditorProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<EditorTab>('convert')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Convert state
  const [convertFormat, setConvertFormat] = useState('mp3')
  const [convertQuality, setConvertQuality] = useState('high')

  // Trim state
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(60)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)

  // Mix state
  const [mixTracks, setMixTracks] = useState<Array<{ audioUrl: string; volume: number; startTime: number }>>([
    { audioUrl: '', volume: 1, startTime: 0 }
  ])

  // Style transfer state
  const [targetGenre, setTargetGenre] = useState<string[]>([])
  const [targetMood, setTargetMood] = useState('')
  const [preserveVocals, setPreserveVocals] = useState(true)
  const [intensity, setIntensity] = useState(0.7)

  // Video state
  const [videoUrl, setVideoUrl] = useState('')
  const [videoQuality, setVideoQuality] = useState('1080p')
  const [audioVolume, setAudioVolume] = useState(0.8)

  // Translate state
  const [originalLyrics, setOriginalLyrics] = useState('')
  const [targetLanguages, setTargetLanguages] = useState<string[]>([])

  const handleConvert = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/audio/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl,
          outputFormat: convertFormat,
          quality: convertQuality,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('convertSuccess') })
        onProcessed?.(data.convertedUrl, 'convert')
      } else {
        setMessage({ type: 'error', text: data.error || t('convertFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('convertFailed') })
    }
    setIsProcessing(false)
  }

  const handleTrim = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/audio/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl,
          startTime: trimStart,
          endTime: trimEnd,
          fadeIn,
          fadeOut,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('trimSuccess') })
        onProcessed?.(data.trimmedUrl, 'trim')
      } else {
        setMessage({ type: 'error', text: data.error || t('trimFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('trimFailed') })
    }
    setIsProcessing(false)
  }

  const handleMix = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: mixTracks,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('mixSuccess') })
        onProcessed?.(data.mixedUrl, 'mix')
      } else {
        setMessage({ type: 'error', text: data.error || t('mixFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('mixFailed') })
    }
    setIsProcessing(false)
  }

  const handleStyleTransfer = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/music/style-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl,
          targetGenre,
          targetMood,
          preserveVocals,
          intensity,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('styleSuccess') })
        onProcessed?.(data.styledUrl, 'style')
      } else {
        setMessage({ type: 'error', text: data.error || t('styleFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('styleFailed') })
    }
    setIsProcessing(false)
  }

  const handleVideoSoundtrack = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/video/soundtrack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          audioUrl,
          quality: videoQuality,
          volume: audioVolume,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('videoSuccess') })
        onProcessed?.(data.finalVideoUrl, 'video')
      } else {
        setMessage({ type: 'error', text: data.error || t('videoFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('videoFailed') })
    }
    setIsProcessing(false)
  }

  const handleTranslate = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/lyrics/multilingual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalLyrics,
          targetLanguages,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: t('translationSuccess') })
        // Handle translations in parent component
      } else {
        setMessage({ type: 'error', text: data.error || t('translationFailed') })
      }
    } catch {
      setMessage({ type: 'error', text: t('translationFailed') })
    }
    setIsProcessing(false)
  }

  const tabs = [
    { id: 'convert' as EditorTab, icon: Music, label: t('convertFormat'), desc: t('convertFormatDesc') },
    { id: 'trim' as EditorTab, icon: Scissors, label: t('trimAudio'), desc: t('trimAudioDesc') },
    { id: 'mix' as EditorTab, icon: Layers, label: t('mixAudio'), desc: t('mixAudioDesc') },
    { id: 'style' as EditorTab, icon: Sparkles, label: t('styleTransfer'), desc: t('styleTransferDesc') },
    { id: 'video' as EditorTab, icon: Video, label: t('videoSoundtrack'), desc: t('videoSoundtrackDesc') },
    { id: 'translate' as EditorTab, icon: Globe, label: t('multilingualLyrics'), desc: t('translateLyricsDesc') },
  ]

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-foreground">{t('advancedAudio')}</span>
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
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-accent text-white'
                    : 'bg-surface-elevated text-text-secondary hover:text-foreground border border-border'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
              message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Convert Tab */}
          {activeTab === 'convert' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('outputFormatLabel')}</label>
                <div className="flex gap-2">
                  {AUDIO_FORMATS.map(fmt => (
                    <button
                      key={fmt.value}
                      onClick={() => setConvertFormat(fmt.value)}
                      className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                        convertFormat === fmt.value
                          ? 'border-accent bg-accent/5'
                          : 'border-border bg-surface-elevated hover:border-accent/50'
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{fmt.label}</div>
                      <div className="text-xs text-text-muted">{fmt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('qualityLabel')}</label>
                <div className="flex gap-2">
                  {QUALITY_OPTIONS.map(q => (
                    <button
                      key={q.value}
                      onClick={() => setConvertQuality(q.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        convertQuality === q.value
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated text-text-secondary hover:text-foreground border border-border'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('converting') : t('convertButton')}
              </button>
            </div>
          )}

          {/* Trim Tab */}
          {activeTab === 'trim' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">{t('startTime')}</label>
                  <input
                    type="number"
                    value={trimStart}
                    onChange={e => setTrimStart(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">{t('endTime')}</label>
                  <input
                    type="number"
                    value={trimEnd}
                    onChange={e => setTrimEnd(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">{t('fadeInDuration')}</label>
                  <input
                    type="number"
                    value={fadeIn}
                    onChange={e => setFadeIn(Number(e.target.value))}
                    min={0}
                    step={0.1}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">{t('fadeOutDuration')}</label>
                  <input
                    type="number"
                    value={fadeOut}
                    onChange={e => setFadeOut(Number(e.target.value))}
                    min={0}
                    step={0.1}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                  />
                </div>
              </div>
              <button
                onClick={handleTrim}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('trimming') : t('trimButton')}
              </button>
            </div>
          )}

          {/* Mix Tab */}
          {activeTab === 'mix' && (
            <div className="space-y-4">
              {mixTracks.map((track, index) => (
                <div key={index} className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Track {index + 1}</span>
                    {mixTracks.length > 1 && (
                      <button
                        onClick={() => setMixTracks(tracks => tracks.filter((_, i) => i !== index))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        {t('removeTrack')}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Audio URL"
                    value={track.audioUrl}
                    onChange={e => {
                      const newTracks = [...mixTracks]
                      newTracks[index].audioUrl = e.target.value
                      setMixTracks(newTracks)
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-text-muted">{t('trackVolume')}</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={track.volume}
                        onChange={e => {
                          const newTracks = [...mixTracks]
                          newTracks[index].volume = Number(e.target.value)
                          setMixTracks(newTracks)
                        }}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">{t('trackOffset')}</label>
                      <input
                        type="number"
                        value={track.startTime}
                        onChange={e => {
                          const newTracks = [...mixTracks]
                          newTracks[index].startTime = Number(e.target.value)
                          setMixTracks(newTracks)
                        }}
                        min={0}
                        className="w-full px-2 py-1 rounded bg-surface border border-border text-foreground text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setMixTracks(tracks => [...tracks, { audioUrl: '', volume: 1, startTime: 0 }])}
                className="w-full py-2 rounded-lg border border-dashed border-border text-text-secondary hover:text-foreground hover:border-accent transition-colors text-sm"
              >
                + {t('addTrack')}
              </button>
              <button
                onClick={handleMix}
                disabled={isProcessing || mixTracks.some(t => !t.audioUrl)}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('mixing') : t('mixButton')}
              </button>
            </div>
          )}

          {/* Style Transfer Tab */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('targetGenre')}</label>
                <input
                  type="text"
                  placeholder="e.g., Jazz, Electronic"
                  value={targetGenre.join(', ')}
                  onChange={e => setTargetGenre(e.target.value.split(',').map(g => g.trim()).filter(Boolean))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('targetMood')}</label>
                <input
                  type="text"
                  placeholder="e.g., Calm, Energetic"
                  value={targetMood}
                  onChange={e => setTargetMood(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('transferIntensity')}: {intensity}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={intensity}
                  onChange={e => setIntensity(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="preserveVocals"
                  checked={preserveVocals}
                  onChange={e => setPreserveVocals(e.target.checked)}
                />
                <label htmlFor="preserveVocals" className="text-sm text-text-secondary">{t('preserveVocals')}</label>
              </div>
              <button
                onClick={handleStyleTransfer}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('applyingStyle') : t('applyStyle')}
              </button>
            </div>
          )}

          {/* Video Soundtrack Tab */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('selectVideo')}</label>
                <input
                  type="text"
                  placeholder="Video URL"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('videoQuality')}</label>
                <div className="flex gap-2">
                  {['720p', '1080p', '4k'].map(q => (
                    <button
                      key={q}
                      onClick={() => setVideoQuality(q)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        videoQuality === q
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated text-text-secondary border border-border'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('audioVolume')}: {audioVolume}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={audioVolume}
                  onChange={e => setAudioVolume(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={handleVideoSoundtrack}
                disabled={isProcessing || !videoUrl}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('processingVideo') : t('addToVideo')}
              </button>
            </div>
          )}

          {/* Translate Tab */}
          {activeTab === 'translate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('originalLyrics')}</label>
                <textarea
                  value={originalLyrics}
                  onChange={e => setOriginalLyrics(e.target.value)}
                  placeholder="Paste lyrics here..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-foreground resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('targetLanguages')}</label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLanguages(prev =>
                          prev.includes(lang.code)
                            ? prev.filter(c => c !== lang.code)
                            : [...prev, lang.code]
                        )
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        targetLanguages.includes(lang.code)
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated text-text-secondary border border-border'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleTranslate}
                disabled={isProcessing || !originalLyrics || targetLanguages.length === 0}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? t('translating') : t('translateButton')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
