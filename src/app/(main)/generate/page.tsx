"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Music, Loader2, Download, Share2, AlertCircle, RefreshCw, Shield, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"
import { decodeSessionToken } from "@/lib/auth-utils"
import AudioPlayer from "@/components/AudioPlayer"
import LyricsAssistantModal from "@/components/LyricsAssistantModal"
import VoiceSelector from "@/components/VoiceSelector"
import PersonaSelector from "@/components/PersonaSelector"
import AdvancedOptions from "@/components/AdvancedOptions"
import GenerationProgress from "@/components/GenerationProgress"

// Genre options
const GENRES = [
  "Pop", "Hip-Hop", "Rock", "Electronic", "R&B", "Jazz",
  "Classical", "Country", "Reggae", "Folk", "Metal", "Indie", "Mandopop", "K-Pop", "Latin"
]

// Mood options
const MOODS = [
  "Happy", "Sad", "Energetic", "Calm", "Romantic", "Epic", "Dark", "Dreamy",
  "Festive", "Celebration", "Chill", "Uplifting", "Melancholic", "Intense"
]

// Instrument options - expanded for competitive features
const INSTRUMENTS = [
  "Guitar", "Piano", "Drum", "Bass", "Synth", "Strings", "Brass", "Vocals",
  "Violin", "Cello", "Flute", "Saxophone", "Trumpet", "Clarinet", "Harp",
  "Choir", "Organ", "Harmonica", "Banjo", "Ukulele", "Mandolin", "Tabla",
  "Steel Drum", "Bagpipes", "Didgeridoo"
]

// Duration options
const DURATIONS = [
  { label: 'Short (30s)', value: 30, description: 'Quick clip' },
  { label: 'Medium (1min)', value: 60, description: 'Standard' },
  { label: 'Long (2min)', value: 120, description: 'Extended' },
  { label: 'Full (3min)', value: 180, description: 'Complete song' },
]

// Quick generate presets
interface GenerationPreset {
  id: string
  name: string
  genre: string[]
  mood: string
  instruments: string[]
  isInstrumental: boolean
  duration: number
}

const DEFAULT_PRESETS: GenerationPreset[] = [
  { id: 'quick-pop', name: 'Quick Pop', genre: ['Pop'], mood: 'Happy', instruments: ['Guitar', 'Piano', 'Drum'], isInstrumental: false, duration: 60 },
  { id: 'quick-chill', name: 'Chill Vibes', genre: ['Electronic', 'Indie'], mood: 'Calm', instruments: ['Synth', 'Piano'], isInstrumental: true, duration: 120 },
  { id: 'quick-energy', name: 'High Energy', genre: ['Hip-Hop', 'Electronic'], mood: 'Energetic', instruments: ['Drum', 'Bass', 'Synth'], isInstrumental: false, duration: 60 },
]

function loadPresets(): GenerationPreset[] {
  if (typeof window === 'undefined') return DEFAULT_PRESETS
  const saved = localStorage.getItem('taoybeats-presets')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return DEFAULT_PRESETS
    }
  }
  return DEFAULT_PRESETS
}

type GenerationStage = 'idle' | 'initializing' | 'generating' | 'finalizing' | 'completed' | 'failed'

export default function GeneratePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  // Handle fork parameter (remix from shared song)
  // fork param = original song ID to pre-fill from
  // songId param = newly created fork ID (not yet generated)
  const forkedSongId = searchParams.get('fork')
  const userRole = (() => {
    if (typeof document === 'undefined') return 'USER'
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'session-token') {
        try {
          const payload = decodeSessionToken(value)
          return payload?.role || 'USER'
        } catch {
          return 'USER'
        }
      }
    }
    return 'USER'
  })()

  // Form state
  const [title, setTitle] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [mood, setMood] = useState("")
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [referenceSinger, setReferenceSinger] = useState("")
  const [referenceSong, setReferenceSong] = useState("")
  const [userNotes, setUserNotes] = useState("")
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [beatMakerMode, setBeatMakerMode] = useState(false)
  const [songId, setSongId] = useState<string | null>(null)
  const [duration, setDuration] = useState(60) // Default 1 minute

  // Voice state
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('')

  // Reference audio for cover generation
  const [referenceAudio, setReferenceAudio] = useState<string | null>(null)

  // Model and format selection
  const [model, setModel] = useState<'music-2.6' | 'music-cover'>('music-2.6')
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav' | 'pcm'>('mp3')
  const [lyricsOptimizer, setLyricsOptimizer] = useState(false)

  // Audio quality settings
  const [sampleRate, setSampleRate] = useState<16000 | 24000 | 32000 | 44100>(44100)
  const [bitrate, setBitrate] = useState<32000 | 64000 | 128000 | 256000>(256000)
  const [aigcWatermark, setAigcWatermark] = useState(false)

  // Modal states
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false)

  // Generation state
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle')
  const [progress, setProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageMessage, setStageMessage] = useState<string>('')

  // Load forked song data if fork parameter is present
  useEffect(() => {
    if (forkedSongId) {
      fetch(`/api/songs/${forkedSongId}`)
        .then(res => res.json())
        .then(song => {
          if (song) {
            setTitle(song.title || '')
            setLyrics(song.lyrics || '')
            setSelectedGenres(song.genre || [])
            setMood(song.mood || '')
            setSelectedInstruments(song.instruments || [])
            setReferenceSinger(song.referenceSinger || '')
            setReferenceSong(song.referenceSong || '')
            setUserNotes(song.userNotes || '')
            setIsInstrumental(song.isInstrumental || false)
          }
        })
        .catch(() => {
          // Forked song not found - silently ignore
        })
    }
  }, [forkedSongId])

  // Beat Maker mode effect - enables instrumental and pre-selects beat instruments
  useEffect(() => {
    if (beatMakerMode) {
      setIsInstrumental(true)
      setSelectedInstruments(['Drum', 'Bass', 'Synth'])
      setSelectedGenres(['Electronic', 'Hip-Hop'])
      setMood('Energetic')
    }
  }, [beatMakerMode])

  // Handle genre toggle
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  // Handle instrument toggle
  const toggleInstrument = (instrument: string) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument) ? prev.filter(i => i !== instrument) : [...prev, instrument]
    )
  }

  // Handle generation
  const handleGenerate = async () => {
    if (!title) {
      setError("Please enter a song title.")
      return
    }
    if (!isInstrumental && !lyrics.trim()) {
      setError("Lyrics are required for song generation.")
      return
    }
    if (selectedGenres.length === 0) {
      setError("Please select at least one genre.")
      return
    }
    if (!mood) {
      setError("Please select a mood.")
      return
    }

    setError(null)
    setGenerationStage('initializing')
    setProgress(0)
    setAudioUrl(null)
    setStageMessage('Initializing...')

    try {
      // Create song record via API
      const createResponse = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          lyrics: isInstrumental ? '' : lyrics,
          genre: selectedGenres,
          mood,
          instruments: selectedInstruments,
          referenceSinger,
          referenceSong,
          userNotes,
          isInstrumental,
          voiceId: selectedVoiceId,
          referenceAudio,
          duration,
          model,
          outputFormat,
          lyricsOptimizer,
          sampleRate,
          bitrate,
          aigcWatermark,
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        if (createResponse.status === 429) {
          throw new Error(errorData.message || 'Daily or monthly limit reached. Please upgrade to Pro for more generations.')
        }
        throw new Error(errorData.error || 'Failed to create song')
      }

      const { id: newSongId } = await createResponse.json()
      setSongId(newSongId)

      // SSE connection state
      let eventSource: EventSource | null = null
      let retryCount = 0
      const maxRetries = 5
      const baseDelay = 1000

      const connectSSE = () => {
        eventSource = new EventSource(`/api/songs/${newSongId}/stream`)

        eventSource.onmessage = (event) => {
          retryCount = 0 // Reset retry count on successful message
          const data = JSON.parse(event.data)
          setProgress(data.progress || 0)

          if (data.stage) {
            setStageMessage(data.stage)
          }

          switch (data.status) {
            case 'PENDING':
              setGenerationStage('initializing')
              break
            case 'GENERATING':
              setGenerationStage('generating')
              break
            case 'COMPLETED':
              setGenerationStage('completed')
              if (data.audioUrl) {
                setAudioUrl(data.audioUrl)
              }
              eventSource?.close()
              break
            case 'FAILED':
              setGenerationStage('failed')
              setError(data.error || 'Generation failed')
              eventSource?.close()
              break
          }
        }

        eventSource.onerror = () => {
          eventSource?.close()

          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount)
            retryCount++
            setError(`Connection lost. Reconnecting in ${Math.round(delay/1000)}s... (Attempt ${retryCount}/${maxRetries})`)
            setTimeout(connectSSE, delay)
          } else {
            setGenerationStage('failed')
            setError('Connection lost after multiple attempts. Please try again.')
          }
        }
      }

      connectSSE()
    } catch (err) {
      setGenerationStage('failed')
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  // Handle download
  const handleDownload = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank')
    }
  }

  // Handle share
  const handleShare = async () => {
    if (!songId) return
    const shareUrl = `${window.location.origin}/song/${songId}`
    if (navigator.share) {
      await navigator.share({
        title: title,
        text: `Check out my song "${title}" on TaoyBeats!`,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }
  }

  // Handle reset
  const handleReset = () => {
    setTitle("")
    setLyrics("")
    setSelectedGenres([])
    setMood("")
    setSelectedInstruments([])
    setReferenceSinger("")
    setReferenceSong("")
    setUserNotes("")
    setIsInstrumental(false)
    setSelectedVoiceId('')
    setReferenceAudio(null)
    setDuration(60)
    setGenerationStage('idle')
    setProgress(0)
    setAudioUrl(null)
    setError(null)
    setSongId(null)
  }

  // Handle lyrics confirmed from modal
  const handleLyricsConfirmed = (confirmedLyrics: string, confirmedTitle?: string) => {
    setLyrics(confirmedLyrics)
    if (confirmedTitle) {
      setTitle(confirmedTitle)
    }
  }

  // Handle persona selected
  const handlePersonaSelected = (persona: { voiceId?: string; referenceSinger?: string; referenceSong?: string }) => {
    if (persona.voiceId) {
      setSelectedVoiceId(persona.voiceId)
    }
    if (persona.referenceSinger) {
      setReferenceSinger(persona.referenceSinger)
    }
    if (persona.referenceSong) {
      setReferenceSong(persona.referenceSong)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </button>
          <nav className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              {t('dashboard')}
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              {t('pricing')}
            </button>
            {userRole === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">{t('admin')}</span>
              </button>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {t('createNewSongPage')}
              </h1>
              <p className="text-text-secondary">
                {t('fillDetails')}
              </p>
            </div>
            {generationStage === 'completed' && (
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-border hover:border-accent text-foreground text-sm font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('createAnotherSong')}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Quick Generate Presets */}
              {generationStage === 'idle' && (
                <section className="p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-accent-glow/10 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">Quick Generate</h2>
                    <button
                      onClick={() => {
                        const name = prompt('Preset name:')
                        if (name) {
                          const newPreset: GenerationPreset = {
                            id: `custom-${Date.now()}`,
                            name,
                            genre: selectedGenres,
                            mood,
                            instruments: selectedInstruments,
                            isInstrumental,
                            duration,
                          }
                          const currentPresets = loadPresets()
                          const updated = [...currentPresets, newPreset]
                          localStorage.setItem('taoybeats-presets', JSON.stringify(updated))
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                    >
                      + Save Current
                    </button>
                  </div>

                  {/* Beat Maker Mode Toggle */}
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-surface border border-border">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={beatMakerMode}
                      onClick={() => setBeatMakerMode(!beatMakerMode)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        beatMakerMode ? 'bg-purple-500' : 'bg-border'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          beatMakerMode ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Beat Maker Mode</p>
                      <p className="text-xs text-text-muted">Generate instrumentals without vocals</p>
                    </div>
                    {beatMakerMode && (
                      <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Drums + Bass + Synth
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {loadPresets().map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedGenres(preset.genre)
                          setMood(preset.mood)
                          setSelectedInstruments(preset.instruments)
                          setIsInstrumental(preset.isInstrumental)
                          setDuration(preset.duration)
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-surface border border-border hover:border-accent transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Song Details */}
              <section className="p-6 rounded-2xl bg-surface border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">{t('songDetails')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('songTitle')} <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="My Awesome Song"
                      maxLength={100}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Instrumental Toggle */}
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-elevated border border-border">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isInstrumental}
                      onClick={() => setIsInstrumental(!isInstrumental)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        isInstrumental ? 'bg-accent' : 'bg-border'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          isInstrumental ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('instrumental')}</p>
                      <p className="text-xs text-text-muted">{t('instrumentalDesc')}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-text-secondary">
                        {t('lyrics')} {!isInstrumental && <span className="text-error">*</span>}
                      </label>
                      {!isInstrumental && (
                        <button
                          type="button"
                          onClick={() => setIsLyricsModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-medium transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {t('aiLyricsAssistant')}
                        </button>
                      )}
                    </div>

                    {/* Quick Structure Tags */}
                    {!isInstrumental && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {['[Verse]', '[Chorus]', '[Bridge]', '[Pre-Chorus]', '[Intro]', '[Outro]'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setLyrics(prev => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n') + tag + '\n')}
                            className="px-2 py-1 rounded bg-surface-elevated hover:bg-accent/10 text-xs text-text-muted hover:text-accent border border-border transition-colors"
                            title={`Insert ${tag}`}
                          >
                            {tag.replace('[', '').replace(']', '')}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder="Paste your lyrics here... Use [Verse], [Chorus], [Bridge] tags for structure"
                      rows={8}
                      maxLength={5000}
                      disabled={isInstrumental}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {isInstrumental ? (
                      <p className="mt-1 text-xs text-accent">{t('lyricsDisabledBecauseInstrumental')}</p>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-text-muted">
                          {lyrics.length}/5000 characters
                          {lyrics.length > 0 && (
                            <span className="ml-2">
                              • {lyrics.split(/\s+/).filter(w => w.length > 0).length} words
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">
                          {lyrics.split('\n').filter(l => l.trim()).length} lines
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Genre */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('genre')} <span className="text-error">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(genre => (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedGenres.includes(genre)
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Duration
                    </label>
                    <div className="flex gap-2">
                      {DURATIONS.map(d => (
                        <button
                          key={d.value}
                          onClick={() => setDuration(d.value)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            duration === d.value
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                          title={d.description}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('mood')} <span className="text-error">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MOODS.map(m => (
                        <button
                          key={m}
                          onClick={() => setMood(m)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            mood === m
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instruments */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('instruments')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INSTRUMENTS.map(instrument => (
                        <button
                          key={instrument}
                          onClick={() => toggleInstrument(instrument)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedInstruments.includes(instrument)
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                        >
                          {instrument}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        {t('referenceSinger')}
                      </label>
                      <input
                        type="text"
                        value={referenceSinger}
                        onChange={(e) => setReferenceSinger(e.target.value)}
                        placeholder="e.g., Taylor Swift"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        {t('referenceSong')}
                      </label>
                      <input
                        type="text"
                        value={referenceSong}
                        onChange={(e) => setReferenceSong(e.target.value)}
                        placeholder="e.g., Shape of You"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* User Notes */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('yourNotesPrivate')}
                    </label>
                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder={t('notesPlaceholder')}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    />
                  </div>

                  {/* Voice Selector */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('voiceSelector')}
                    </label>
                    <div className="flex gap-2">
                      <VoiceSelector
                        selectedVoiceId={selectedVoiceId}
                        onSelectVoice={setSelectedVoiceId}
                      />
                      <PersonaSelector
                        onSelectPersona={handlePersonaSelected}
                        currentVoiceId={selectedVoiceId}
                        currentReferenceSinger={referenceSinger}
                        currentReferenceSong={referenceSong}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Advanced Options */}
              <AdvancedOptions
                referenceAudio={referenceAudio}
                onReferenceAudioChange={setReferenceAudio}
                model={model}
                onModelChange={setModel}
                outputFormat={outputFormat}
                onOutputFormatChange={setOutputFormat}
                lyricsOptimizer={lyricsOptimizer}
                onLyricsOptimizerChange={setLyricsOptimizer}
                sampleRate={sampleRate}
                onSampleRateChange={setSampleRate}
                bitrate={bitrate}
                onBitrateChange={setBitrate}
                aigcWatermark={aigcWatermark}
                onAigcWatermarkChange={setAigcWatermark}
              />

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generationStage !== 'idle' && generationStage !== 'completed' && generationStage !== 'failed'}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generationStage !== 'idle' && generationStage !== 'completed' && generationStage !== 'failed' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('generatingEllipsis')}
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5" />
                    {t('generateSong')}
                  </>
                )}
              </button>

              {generationStage === 'failed' && (
                <button
                  onClick={handleGenerate}
                  className="w-full py-4 rounded-xl border border-error text-error font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t('pleaseTryAgain')}
                </button>
              )}
            </div>

            {/* Right Column - Preview & Progress */}
            <div className="space-y-6">
              {/* Progress */}
              {generationStage !== 'idle' && (
                <GenerationProgress
                  stage={generationStage}
                  progress={progress}
                  stageMessage={stageMessage}
                  error={error || undefined}
                />
              )}

              {/* Audio Player */}
              {audioUrl && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>

                  <AudioPlayer
                    src={audioUrl}
                    title={title}
                    artist="TaoyBeats"
                  />

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-3 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('download')}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 py-3 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      {t('share')}
                    </button>
                  </div>
                </section>
              )}

              {/* Tips */}
              <section className="p-6 rounded-2xl bg-surface border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">{t('tipsBetterResults')}</h2>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    {t('tip1')}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    {t('tip2')}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    {t('tip3')}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    {t('tip4')}
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Lyrics Assistant Modal */}
      <LyricsAssistantModal
        isOpen={isLyricsModalOpen}
        onClose={() => setIsLyricsModalOpen(false)}
        onConfirm={handleLyricsConfirmed}
        initialTitle={title}
        initialMood={mood}
      />
    </div>
  )
}
