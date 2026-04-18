"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Music, Loader2, Download, Share2, AlertCircle, RefreshCw, Shield, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"
import AudioPlayer from "@/components/AudioPlayer"
import LyricsAssistantModal from "@/components/LyricsAssistantModal"
import LoginGuideModal from "@/components/LoginGuideModal"
import SelectorDrawer, { SelectOption } from "@/components/SelectorDrawer"
import { usePresets } from "@/lib/usePresets"
import VoiceSelector from "@/components/VoiceSelector"
import PersonaSelector from "@/components/PersonaSelector"
import AdvancedOptions from "@/components/AdvancedOptions"
import GenerationProgress from "@/components/GenerationProgress"
import { useToast } from "@/components/Toast"

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

// Duration options
const DURATIONS = [
  { label: 'Short (30s)', value: 30, description: 'Quick clip' },
  { label: 'Standard (2min)', value: 120, description: 'Standard song' },
  { label: 'Extended (3min)', value: 180, description: 'Full song' },
  { label: 'Extended (5min)', value: 300, description: 'Complete album version' },
]

// Selector drawer options
const GENRE_OPTIONS: SelectOption[] = GENRES.map(g => ({ value: g, label: g }))

const MOOD_OPTIONS: SelectOption[] = MOODS.map(m => ({ value: m, label: m }))

// Grouped instruments
const INSTRUMENT_GROUPS: Record<string, string[]> = {
  '弦乐': ['Guitar', 'Violin', 'Cello', 'Harp', 'Banjo', 'Ukulele', 'Mandolin'],
  '键盘': ['Piano', 'Organ', 'Accordion'],
  '打击乐': ['Drum', 'Tabla', 'Steel Drum'],
  '电子': ['Synth', 'Electric Guitar'],
  '管乐': ['Saxophone', 'Trumpet', 'Clarinet', 'Flute', 'Bagpipes'],
  '人声': ['Vocals', 'Choir'],
  '其他': ['Bass', 'Strings', 'Brass', 'Harmonica', 'Didgeridoo'],
}

const INSTRUMENT_OPTIONS: SelectOption[] = Object.entries(INSTRUMENT_GROUPS).flatMap(
  ([group, instruments]) => instruments.map(i => ({ value: i, label: i, group }))
)

type GenerationStage = 'idle' | 'initializing' | 'generating' | 'finalizing' | 'completed' | 'failed'

export default function GeneratePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const { showToast } = useToast()

  // Handle fork parameter (remix from shared song)
  // fork param = original song ID to pre-fill from
  // songId param = newly created fork ID (not yet generated)
  const forkedSongId = searchParams.get('fork')

  // User state from profile API
  const [userRole, setUserRole] = useState<string>('USER')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            setUserRole(data.user.role || 'USER')
            setIsLoggedIn(true)
          }
        }
      } catch {
        // ignore profile fetch errors
      }
    }
    fetchProfile()
  }, [])

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

  // Enhanced Audio-to-Audio options
  const [audioOptions, setAudioOptions] = useState({
    timbreSimilarity: 0.7,
    mixMode: false,
    mixModeVocalVolume: 0.5,
    referenceLyrics: [] as { text: string; startTime?: number; endTime?: number; section?: string }[],
    referenceAudioUrl: '',
  })

  // Handler for partial audio options updates
  const handleAudioOptionsChange = (partial: Partial<typeof audioOptions>) => {
    setAudioOptions(prev => ({ ...prev, ...partial }))
  }

  // Model and format selection
  const [model, setModel] = useState<'music-2.6' | 'music-cover'>('music-2.6')
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav' | 'pcm'>('mp3')
  const [lyricsOptimizer, setLyricsOptimizer] = useState(false)

  // Audio quality settings
  const [sampleRate, setSampleRate] = useState<16000 | 24000 | 32000 | 44100>(44100)
  const [bitrate, setBitrate] = useState<32000 | 64000 | 128000 | 256000>(256000)
  const [aigcWatermark, setAigcWatermark] = useState(false)

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Modal states
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false)
  const [showLoginGuide, setShowLoginGuide] = useState(false)

  // Drawer states for selector components
  const [isGenreDrawerOpen, setIsGenreDrawerOpen] = useState(false)
  const [isMoodDrawerOpen, setIsMoodDrawerOpen] = useState(false)
  const [isInstrumentDrawerOpen, setIsInstrumentDrawerOpen] = useState(false)

  // Cloud sync presets
  const { presets: cloudPresets, createPreset: savePresetToCloud } = usePresets()

  // Generation state
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle')
  const [progress, setProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageMessage, setStageMessage] = useState<string>('')
  const [forkError, setForkError] = useState<string | null>(null)

  // Load forked song data if fork parameter is present
  useEffect(() => {
    if (forkedSongId) {
      fetch(`/api/songs/${forkedSongId}`)
        .then(res => {
          if (!res.ok) throw new Error('Forked song not found')
          return res.json()
        })
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
        .catch((err) => {
          setForkError(err.message || 'Failed to load forked song')
        })
    }
  }, [forkedSongId])

  // Beat Maker mode effect - enables instrumental and pre-selects beat instruments
  useEffect(() => {
    if (beatMakerMode) {
      /* eslint-disable react-hooks/set-state-in-effect */
      // Intentionally updating form state based on beatMakerMode toggle
      setIsInstrumental(true)
      setSelectedInstruments(['Drum', 'Bass', 'Synth'])
      setSelectedGenres(['Electronic', 'Hip-Hop'])
      setMood('Energetic')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [beatMakerMode])

  // Handle generation
  const handleGenerate = async () => {
    // Clear previous errors
    setError(null)
    setFieldErrors({})

    // Validate fields
    const errors: Record<string, string> = {}
    if (!title.trim()) {
      errors.title = "Please enter a song title"
    }
    if (!isInstrumental && !lyrics.trim()) {
      errors.lyrics = "Lyrics are required for song generation"
    }
    if (selectedGenres.length === 0) {
      errors.genres = "Please select at least one genre"
    }
    if (!mood) {
      errors.mood = "Please select a mood"
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError("Please fill in all required fields")
      return
    }

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
          // Enhanced Audio-to-Audio options
          timbreSimilarity: audioOptions.timbreSimilarity,
          mixMode: audioOptions.mixMode,
          mixModeVocalVolume: audioOptions.mixModeVocalVolume,
          referenceLyrics: audioOptions.referenceLyrics,
          referenceAudioUrl: audioOptions.referenceAudioUrl,
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
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null
      const maxRetries = 5
      const baseDelay = 1000
      const connectionTimeoutMs = 30000 // 30 seconds timeout for initial connection

      const clearConnectionTimeout = () => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
      }

      const closeEventSource = () => {
        clearConnectionTimeout()
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
      }

      const connectSSE = () => {
        // Clean up any existing connection before creating new one
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }

        // Set connection timeout
        clearConnectionTimeout()
        connectionTimeout = setTimeout(() => {
          closeEventSource()
          setGenerationStage('failed')
          setError('Connection timeout. The server took too long to respond. Please try again.')
        }, connectionTimeoutMs)

        eventSource = new EventSource(`/api/songs/${newSongId}/stream`)

        eventSource.onmessage = (event) => {
          retryCount = 0 // Reset retry count on successful message
          clearConnectionTimeout() // Clear timeout on any message received

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
              closeEventSource()
              break
            case 'FAILED':
              setGenerationStage('failed')
              setError(data.error || 'Generation failed')
              closeEventSource()
              break
            case 'UNKNOWN':
              // Handle unknown status - treat as transient error, allow retry
              console.warn('Received UNKNOWN status from SSE, waiting for next update...')
              break
            default:
              // Log unexpected status for debugging
              console.warn(`Unexpected SSE status: ${data.status}, waiting for next update...`)
              break
          }
        }

        eventSource.onerror = () => {
          closeEventSource()

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
      showToast("success", "Download started!")
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
      showToast("success", "Link copied to clipboard!")
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
    setBeatMakerMode(false)
    setSelectedVoiceId('')
    setReferenceAudio(null)
    setAudioOptions({
      timbreSimilarity: 0.7,
      mixMode: false,
      mixModeVocalVolume: 0.5,
      referenceLyrics: [],
      referenceAudioUrl: '',
    })
    setModel('music-2.6')
    setOutputFormat('mp3')
    setLyricsOptimizer(false)
    setSampleRate(44100)
    setBitrate(256000)
    setAigcWatermark(false)
    setDuration(60)
    setGenerationStage('idle')
    setProgress(0)
    setAudioUrl(null)
    setError(null)
    setFieldErrors({})
    setSongId(null)
  }

  // Handle lyrics confirmed from modal
  const handleLyricsConfirmed = (confirmedLyrics: string, confirmedTitle?: string, styleTags?: string[]) => {
    setLyrics(confirmedLyrics)
    if (confirmedTitle) {
      setTitle(confirmedTitle)
    }
    // Auto-fill genre from style tags if available
    if (styleTags && styleTags.length > 0) {
      const validGenres = GENRES.filter(g =>
        styleTags.some(tag => tag.toLowerCase().includes(g.toLowerCase()))
      )
      if (validGenres.length > 0) {
        setSelectedGenres(validGenres.slice(0, 2))
      }
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

          {forkError && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {forkError}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Quick Generate Presets */}
              {generationStage === 'idle' && (
                <section className="p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-accent-glow/10 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">{t('quickGenerate')}</h2>
                    <button
                      onClick={async () => {
                        const name = prompt('Preset name:')
                        if (name) {
                          const result = await savePresetToCloud({
                            name,
                            genre: selectedGenres,
                            mood,
                            instruments: selectedInstruments,
                            isInstrumental,
                            duration,
                          })
                          if (!result.success) {
                            alert(result.error || 'Failed to save preset')
                          }
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                    >
                      + {t('saveCurrent')}
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
                      <p className="text-sm font-medium text-foreground">{t('beatMakerMode')}</p>
                      <p className="text-xs text-text-muted">{t('beatMakerModeDesc')}</p>
                    </div>
                    {beatMakerMode && (
                      <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-medium">
                        {t('plusDrumsBassSynth')}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {cloudPresets.map(preset => (
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
                      onChange={(e) => {
                        setTitle(e.target.value)
                        if (fieldErrors.title) {
                          setFieldErrors(prev => ({ ...prev, title: "" }))
                        }
                      }}
                      placeholder="My Awesome Song"
                      maxLength={100}
                      className={`w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-text-muted focus:outline-none ${
                        fieldErrors.title
                          ? "border-2 border-error focus:border-error"
                          : "border border-border focus:border-accent"
                      }`}
                    />
                    {fieldErrors.title && (
                      <p className="mt-1 text-xs text-error flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.title}
                      </p>
                    )}
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
                          onClick={() => {
                            if (isLoggedIn) {
                              setIsLyricsModalOpen(true)
                            } else {
                              setShowLoginGuide(true)
                            }
                          }}
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
                      onChange={(e) => {
                        setLyrics(e.target.value)
                        if (fieldErrors.lyrics) {
                          setFieldErrors(prev => ({ ...prev, lyrics: "" }))
                        }
                      }}
                      placeholder="Paste your lyrics here... Use [Verse], [Chorus], [Bridge] tags for structure"
                      rows={8}
                      maxLength={5000}
                      disabled={isInstrumental}
                      className={`w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-text-muted focus:outline-none resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        fieldErrors.lyrics && !isInstrumental
                          ? "border-2 border-error focus:border-error"
                          : "border border-border focus:border-accent"
                      }`}
                    />
                    {fieldErrors.lyrics && !isInstrumental && (
                      <p className="mt-1 text-xs text-error flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.lyrics}
                      </p>
                    )}
                    {isInstrumental ? (
                      <p className="mt-1 text-xs text-accent">{t('lyricsDisabledBecauseInstrumental')}</p>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-text-muted">
                          {lyrics.length}/5000 {t('characters')}
                          {lyrics.length > 0 && (
                            <span className="ml-2">
                              • {lyrics.split(/\s+/).filter(w => w.length > 0).length} {t('words')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">
                          {lyrics.split('\n').filter(l => l.trim()).length} {t('lines')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Genre */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('genre')} <span className="text-error">*</span>
                    </label>
                    <button
                      onClick={() => {
                        setIsGenreDrawerOpen(true)
                        if (fieldErrors.genres) {
                          setFieldErrors(prev => ({ ...prev, genres: "" }))
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-xl bg-background text-foreground text-left hover:border-accent transition-colors flex items-center justify-between ${
                        fieldErrors.genres
                          ? "border-2 border-error"
                          : "border border-border"
                      }`}
                    >
                      <span className={selectedGenres.length > 0 ? "text-foreground" : "text-text-muted"}>
                        {selectedGenres.length > 0 ? selectedGenres.join(', ') : t('selectStyle')}
                      </span>
                      <span className="text-sm text-accent">{selectedGenres.length} selected</span>
                    </button>
                    {fieldErrors.genres && (
                      <p className="mt-1 text-xs text-error flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.genres}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('duration')}
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
                    <button
                      onClick={() => setIsMoodDrawerOpen(true)}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-left hover:border-accent transition-colors flex items-center justify-between"
                    >
                      <span className={mood ? "text-foreground" : "text-text-muted"}>
                        {mood || t('selectMood')}
                      </span>
                      {mood && <span className="text-sm text-accent">{mood}</span>}
                    </button>
                  </div>

                  {/* Instruments */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('instruments')}
                    </label>
                    <button
                      onClick={() => setIsInstrumentDrawerOpen(true)}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-left hover:border-accent transition-colors flex items-center justify-between"
                    >
                      <span className={selectedInstruments.length > 0 ? "text-foreground" : "text-text-muted"}>
                        {selectedInstruments.length > 0 ? selectedInstruments.join(', ') : t('selectInstruments')}
                      </span>
                      <span className="text-sm text-accent">{selectedInstruments.length} selected</span>
                    </button>
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
                audioOptions={audioOptions}
                onAudioOptionsChange={handleAudioOptionsChange}
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

      {/* Login Guide Modal for unauthenticated users */}
      <LoginGuideModal
        isOpen={showLoginGuide}
        onClose={() => setShowLoginGuide(false)}
      />

      {/* Genre Selector Drawer */}
      <SelectorDrawer
        isOpen={isGenreDrawerOpen}
        onClose={() => setIsGenreDrawerOpen(false)}
        title={t('selectStyle')}
        options={GENRE_OPTIONS}
        selectedValues={selectedGenres}
        onConfirm={(values) => setSelectedGenres(values)}
        multiSelect={true}
        searchPlaceholder={t('searchPlaceholderShort')}
      />

      {/* Mood Selector Drawer */}
      <SelectorDrawer
        isOpen={isMoodDrawerOpen}
        onClose={() => setIsMoodDrawerOpen(false)}
        title={t('selectMood')}
        options={MOOD_OPTIONS}
        selectedValues={mood ? [mood] : []}
        onConfirm={(values) => setMood(values[0] || '')}
        multiSelect={false}
        searchPlaceholder={t('searchPlaceholderShort')}
      />

      {/* Instrument Selector Drawer */}
      <SelectorDrawer
        isOpen={isInstrumentDrawerOpen}
        onClose={() => setIsInstrumentDrawerOpen(false)}
        title={t('selectInstruments')}
        options={INSTRUMENT_OPTIONS}
        selectedValues={selectedInstruments}
        onConfirm={(values) => setSelectedInstruments(values)}
        multiSelect={true}
        searchPlaceholder={t('searchPlaceholderShort')}
      />
    </div>
  )
}
