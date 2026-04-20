"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { getLyricsLimitForModel } from "@/lib/minimax-music"
import { useToast } from "@/components/Toast"
import { downloadSongFile } from "@/lib/song-download"

type TranslateFn = ReturnType<typeof useI18n>["t"]

// Genre options (English values for API)
const GENRES = [
  "Pop", "Hip-Hop", "Rock", "Electronic", "R&B", "Jazz",
  "Classical", "Country", "Reggae", "Folk", "Metal", "Indie", "Mandopop", "K-Pop", "Latin"
]

// Mood options (English values for API)
const MOODS = [
  "Happy", "Sad", "Energetic", "Calm", "Romantic", "Epic", "Dark", "Dreamy",
  "Festive", "Celebration", "Chill", "Uplifting", "Melancholic", "Intense"
]

// Grouped instruments (English values for API)
const INSTRUMENT_GROUPS: Record<string, string[]> = {
  'Strings': ['Guitar', 'Violin', 'Cello', 'Harp', 'Banjo', 'Ukulele', 'Mandolin'],
  'Keyboard': ['Piano', 'Organ', 'Accordion'],
  'Percussion': ['Drum', 'Tabla', 'Steel Drum'],
  'Electronic': ['Synth', 'Electric Guitar'],
  'Wind': ['Saxophone', 'Trumpet', 'Clarinet', 'Flute', 'Bagpipes'],
  'Vocal': ['Vocals', 'Choir'],
  'Other': ['Bass', 'Strings', 'Brass', 'Harmonica', 'Didgeridoo'],
}

// Helper to get translated genre label
const getGenreLabel = (genre: string, t: TranslateFn): string => {
  const labels: Record<string, string> = {
    'Pop': t('genrePop'),
    'Hip-Hop': t('genreHipHop'),
    'Rock': t('genreRock'),
    'Electronic': t('genreElectronic'),
    'R&B': t('genreRB'),
    'Jazz': t('genreJazz'),
    'Classical': t('genreClassical'),
    'Country': t('genreCountry'),
    'Reggae': t('genreReggae'),
    'Folk': t('genreFolk'),
    'Metal': t('genreMetal'),
    'Indie': t('genreIndie'),
    'Mandopop': t('genreMandopop'),
    'K-Pop': t('genreKPop'),
    'Latin': t('genreLatin'),
  }
  return labels[genre] || genre
}

// Helper to get translated mood label
const getMoodLabel = (mood: string, t: TranslateFn): string => {
  const labels: Record<string, string> = {
    'Happy': t('moodHappy'),
    'Sad': t('moodSad'),
    'Energetic': t('moodEnergetic'),
    'Calm': t('moodCalm'),
    'Romantic': t('moodRomantic'),
    'Epic': t('moodEpic'),
    'Dark': t('moodDark'),
    'Dreamy': t('moodDreamy'),
    'Festive': t('moodFestive'),
    'Celebration': t('moodCelebration'),
    'Chill': t('moodChill'),
    'Uplifting': t('moodUplifting'),
    'Melancholic': t('moodMelancholic'),
    'Intense': t('moodIntense'),
  }
  return labels[mood] || mood
}

// Helper to get translated instrument label
const getInstrumentLabel = (instrument: string, t: TranslateFn): string => {
  const labels: Record<string, string> = {
    'Guitar': t('instrumentGuitar'),
    'Violin': t('instrumentViolin'),
    'Cello': t('instrumentCello'),
    'Harp': t('instrumentHarp'),
    'Banjo': t('instrumentBanjo'),
    'Ukulele': t('instrumentUkulele'),
    'Mandolin': t('instrumentMandolin'),
    'Piano': t('instrumentPiano'),
    'Organ': t('instrumentOrgan'),
    'Accordion': t('instrumentAccordion'),
    'Drum': t('instrumentDrum'),
    'Tabla': t('instrumentTabla'),
    'Steel Drum': t('instrumentSteelDrum'),
    'Synth': t('instrumentSynth'),
    'Electric Guitar': t('instrumentElectricGuitar'),
    'Saxophone': t('instrumentSaxophone'),
    'Trumpet': t('instrumentTrumpet'),
    'Clarinet': t('instrumentClarinet'),
    'Flute': t('instrumentFlute'),
    'Bagpipes': t('instrumentBagpipes'),
    'Vocals': t('instrumentVocals'),
    'Choir': t('instrumentChoir'),
    'Bass': t('instrumentBass'),
    'Strings': t('instrumentStrings'),
    'Brass': t('instrumentBrass'),
    'Harmonica': t('instrumentHarmonica'),
    'Didgeridoo': t('instrumentDidgeridoo'),
  }
  return labels[instrument] || instrument
}

// Helper to get translated instrument group name
const getInstrumentGroupLabel = (group: string, t: TranslateFn): string => {
  const labels: Record<string, string> = {
    'Strings': t('instrumentStrings'),
    'Keyboard': t('instrumentKeyboard'),
    'Percussion': t('instrumentPercussion'),
    'Electronic': t('instrumentElectronicGroup'),
    'Wind': t('instrumentWind'),
    'Vocal': t('instrumentVocal'),
    'Other': t('instrumentOther'),
  }
  return labels[group] || group
}

// Selector drawer options factory
const createGenreOptions = (t: TranslateFn): SelectOption[] =>
  GENRES.map(g => ({ value: g, label: getGenreLabel(g, t) }))

const createMoodOptions = (t: TranslateFn): SelectOption[] =>
  MOODS.map(m => ({ value: m, label: getMoodLabel(m, t) }))

const createInstrumentOptions = (t: TranslateFn): SelectOption[] =>
  Object.entries(INSTRUMENT_GROUPS).flatMap(
    ([group, instruments]) => instruments.map(i => ({
      value: i,
      label: getInstrumentLabel(i, t),
      group: getInstrumentGroupLabel(group, t)
    }))
  )

type GenerationStage = 'idle' | 'initializing' | 'generating' | 'finalizing' | 'completed' | 'failed'
type BackendGenerationStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'

function mapGenerationPresentation(
  status: BackendGenerationStatus,
  progress: number,
  stage?: string,
  options?: { hasAudio?: boolean }
): { stage: Exclude<GenerationStage, 'idle'>; progress: number; message: string } {
  if (status === 'PENDING') {
    return {
      stage: 'initializing',
      progress: Math.max(progress, 8),
      message: stage || 'Queued. Preparing your song...',
    }
  }

  if (status === 'GENERATING') {
    return {
      stage: 'generating',
      progress: Math.max(progress, 35),
      message: stage || 'Generating the full song...',
    }
  }

  if (status === 'COMPLETED' && options?.hasAudio === false) {
    return {
      stage: 'finalizing',
      progress: Math.max(progress, 92),
      message: stage || 'Finalizing your song...',
    }
  }

  if (status === 'COMPLETED') {
    return {
      stage: 'completed',
      progress: 100,
      message: 'Song ready',
    }
  }

  return {
    stage: 'failed',
    progress: 0,
    message: 'Generation failed',
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '--:--'
  }

  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function shouldWarnForLyricsCompression(rawLyrics: string, maxLength: number): boolean {
  const trimmedLyrics = rawLyrics.trim()
  if (!trimmedLyrics) {
    return false
  }

  return trimmedLyrics.length > maxLength
}

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
  const [songId, setSongId] = useState<string | null>(null)
  // Fork tracking - store original song info for attribution
  const [forkedFrom, setForkedFrom] = useState<string | undefined>()
  const [originalOwnerId, setOriginalOwnerId] = useState<string | undefined>()

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

  // Memoized translated options for selector drawers
  const genreOptions = useMemo(() => createGenreOptions(t), [t])
  const moodOptions = useMemo(() => createMoodOptions(t), [t])
  const instrumentOptions = useMemo(() => createInstrumentOptions(t), [t])

  // Helper to display translated selected values
  const displayGenres = selectedGenres.map(g => getGenreLabel(g, t)).join(', ')
  const displayMood = mood ? getMoodLabel(mood, t) : ''
  const displayInstruments = selectedInstruments.map(i => getInstrumentLabel(i, t)).join(', ')

  // Cloud sync presets
  const { presets: cloudPresets, createPreset: savePresetToCloud } = usePresets()

  // Generation state
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle')
  const [progress, setProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [resultDurationLabel, setResultDurationLabel] = useState('--:--')
  const [error, setError] = useState<string | null>(null)
  const [stageMessage, setStageMessage] = useState<string>('')
  const [forkError, setForkError] = useState<string | null>(null)
  const [lyricsCompressionSummary, setLyricsCompressionSummary] = useState<{
    applied: boolean
    originalLength: number
    compressedLength: number
    maxLength: number
  } | null>(null)

  // Multi-part song state
  const [playlistUrls, setPlaylistUrls] = useState<string[]>([])
  const [playlistSongIds, setPlaylistSongIds] = useState<string[]>([])

  const applyGenerationPresentation = useCallback(
    (
      status: BackendGenerationStatus,
      nextProgress: number,
      nextStage?: string,
      options?: { hasAudio?: boolean; error?: string | null }
    ) => {
      const presentation = mapGenerationPresentation(status, nextProgress, nextStage, options)

      setGenerationStage(presentation.stage)
      setProgress(presentation.progress)
      setStageMessage(presentation.message)

      if (status === 'FAILED') {
        setError(options?.error || presentation.message)
        return presentation
      }

      setError(null)
      return presentation
    },
    []
  )

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
            setLyricsCompressionSummary(null)
            setSelectedGenres(song.genre || [])
            setMood(song.mood || '')
            setSelectedInstruments(song.instruments || [])
            setReferenceSinger(song.referenceSinger || '')
            setReferenceSong(song.referenceSong || '')
            setUserNotes(song.userNotes || '')
            setIsInstrumental(song.isInstrumental || false)
            // Track fork attribution
            setForkedFrom(forkedSongId)
            setOriginalOwnerId(song.userId)
          }
        })
        .catch((err) => {
          setForkError(err.message || 'Failed to load forked song')
        })
    }
  }, [forkedSongId])

  
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
    if (!isInstrumental && !lyrics.trim() && !lyricsOptimizer) {
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

    applyGenerationPresentation('PENDING', 0)
    setAudioUrl(null)
    setResultDurationLabel('--:--')
    setPlaylistUrls([])
    setPlaylistSongIds([])
    setLyricsCompressionSummary(null)

    const lyricsLimit = getLyricsLimitForModel(model, isInstrumental)

    if (!isInstrumental && shouldWarnForLyricsCompression(lyrics, lyricsLimit)) {
      showToast("info", `歌词超过 MiniMax 当前模型支持的上限，系统会在提交时自动压缩到最长 ${lyricsLimit} 字符以内。`)
    }

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
          forkedFrom,
          originalOwnerId,
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

      const responseData = await createResponse.json()
      const { id: newSongId, compression } = responseData
      setSongId(newSongId)

      if (compression?.applied) {
        if (typeof compression.usedLyrics === "string") {
          setLyrics(compression.usedLyrics)
        }
        setLyricsCompressionSummary({
          applied: true,
          originalLength: compression.originalLength || 0,
          compressedLength: compression.compressedLength || 0,
          maxLength: compression.maxLength || lyricsLimit,
        })
        showToast("info", `歌词已自动压缩到 MiniMax 模型支持的最长范围内，当前生成使用的是 ${compression.compressedLength}/${compression.maxLength} 字符版本。`)
      } else {
        setLyricsCompressionSummary(null)
      }

      // SSE connection state
      let eventSource: EventSource | null = null
      let retryCount = 0
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null
      let statusPollingTimeout: ReturnType<typeof setTimeout> | null = null
      let statusPollingAttempts = 0
      const maxRetries = 5
      const baseDelay = 1000
      const connectionTimeoutMs = 30000 // 30 seconds timeout for initial connection
      const statusPollingIntervalMs = 3000
      const maxStatusPollingAttempts = Math.ceil((30 * 60 * 1000) / statusPollingIntervalMs)

      const clearConnectionTimeout = () => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
      }

      const clearStatusPollingTimeout = () => {
        if (statusPollingTimeout) {
          clearTimeout(statusPollingTimeout)
          statusPollingTimeout = null
        }
      }

      const closeEventSource = () => {
        clearConnectionTimeout()
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
      }

      const handleCompletedSong = (completedSongId: string, completedAudioUrl: string) => {
        applyGenerationPresentation('COMPLETED', 100)
        setSongId(completedSongId)
        setAudioUrl(completedAudioUrl)
        setPlaylistUrls([completedAudioUrl])
        setPlaylistSongIds([completedSongId])
        clearStatusPollingTimeout()
      }

      const applyPolledSongStatus = (song: {
        id?: string
        status?: BackendGenerationStatus
        audioUrl?: string | null
        error?: string | null
        progress?: number
        stage?: string
      }) => {
        switch (song.status) {
          case 'PENDING':
            applyGenerationPresentation('PENDING', song.progress ?? 0, song.stage)
            return false
          case 'GENERATING':
            applyGenerationPresentation(
              'GENERATING',
              song.progress ?? 0,
              song.stage || 'Realtime connection lost. Still checking generation status...'
            )
            return false
          case 'COMPLETED':
            if (song.audioUrl) {
              handleCompletedSong(song.id || newSongId, song.audioUrl)
              return true
            }
            applyGenerationPresentation('COMPLETED', song.progress ?? 100, song.stage, { hasAudio: false })
            return false
          case 'FAILED':
            clearStatusPollingTimeout()
            applyGenerationPresentation('FAILED', song.progress ?? 0, song.stage, { error: song.error })
            return true
          default:
            return false
        }
      }

      const pollSongStatus = async () => {
        clearStatusPollingTimeout()

        try {
          const response = await fetch(`/api/songs/${newSongId}`)
          if (!response.ok) {
            throw new Error('Failed to fetch latest song status')
          }

          const song = await response.json()

          if (applyPolledSongStatus(song)) {
            return
          }

          statusPollingAttempts++
          if (statusPollingAttempts >= maxStatusPollingAttempts) {
            applyGenerationPresentation('FAILED', 0, 'Unable to confirm generation status. Please refresh and check again.')
            return
          }

          statusPollingTimeout = setTimeout(() => {
            void pollSongStatus()
          }, statusPollingIntervalMs)
        } catch {
          statusPollingAttempts++
          if (statusPollingAttempts >= maxStatusPollingAttempts) {
            applyGenerationPresentation('FAILED', 0, 'Unable to confirm generation status. Please refresh and check again.')
            return
          }

          applyGenerationPresentation('GENERATING', 0, 'Realtime connection lost. Retrying status check...')
          statusPollingTimeout = setTimeout(() => {
            void pollSongStatus()
          }, statusPollingIntervalMs)
        }
      }

      const fallbackToStatusPolling = () => {
        closeEventSource()
        applyGenerationPresentation('GENERATING', 0, 'Realtime connection lost. Checking latest song status...')
        void pollSongStatus()
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
          fallbackToStatusPolling()
        }, connectionTimeoutMs)

        eventSource = new EventSource(`/api/songs/${newSongId}/stream`)

        eventSource.onmessage = (event) => {
          retryCount = 0 // Reset retry count on successful message
          clearConnectionTimeout() // Clear timeout on any message received
          clearStatusPollingTimeout()

          const data = JSON.parse(event.data) as {
            status?: BackendGenerationStatus | 'UNKNOWN'
            progress?: number
            stage?: string
            audioUrl?: string
            songId?: string
            error?: string | null
          }

          switch (data.status) {
            case 'PENDING':
              applyGenerationPresentation('PENDING', data.progress ?? 0, data.stage)
              break
            case 'GENERATING':
              applyGenerationPresentation('GENERATING', data.progress ?? 0, data.stage)
              break
            case 'COMPLETED':
              if (data.audioUrl) {
                handleCompletedSong(data.songId || newSongId, data.audioUrl)
                closeEventSource()
                break
              }
              applyGenerationPresentation('COMPLETED', data.progress ?? 100, data.stage, { hasAudio: false })
              closeEventSource()
              void pollSongStatus()
              break
            case 'FAILED':
              applyGenerationPresentation('FAILED', data.progress ?? 0, data.stage, { error: data.error })
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
            fallbackToStatusPolling()
          }
        }
      }

      connectSSE()
    } catch (err) {
      applyGenerationPresentation(
        'FAILED',
        0,
        err instanceof Error ? err.message : 'Generation failed',
        { error: err instanceof Error ? err.message : 'Generation failed' }
      )
    }
  }


  // Handle download - uses API proxy to avoid CORS issues with external audio URLs
  const handleDownload = async () => {
    if (!songId) return
    try {
      await downloadSongFile({
        songId,
        fallbackFilename: `${title || 'audio'}.mp3`,
      })
      showToast("success", "Download started!")
    } catch (error) {
      console.error('Download failed:', error)
      showToast("error", error instanceof Error ? error.message : "Download failed. Please try again.")
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
    setLyricsCompressionSummary(null)
    setSelectedGenres([])
    setMood("")
    setSelectedInstruments([])
    setReferenceSinger("")
    setReferenceSong("")
    setUserNotes("")
    setIsInstrumental(false)
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
    setGenerationStage('idle')
    setProgress(0)
    setAudioUrl(null)
    setResultDurationLabel('--:--')
    setError(null)
    setStageMessage('')
    setFieldErrors({})
    setSongId(null)
    setPlaylistUrls([])
    setPlaylistSongIds([])
  }

  // Handle lyrics confirmed from modal
  const handleLyricsConfirmed = (confirmedLyrics: string, confirmedTitle?: string, styleTags?: string[]) => {
    setLyrics(confirmedLyrics)
    setLyricsCompressionSummary(null)
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

                  
                  <div className="flex gap-2 flex-wrap">
                    {cloudPresets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedGenres(preset.genre)
                          setMood(preset.mood)
                          setSelectedInstruments(preset.instruments)
                          setIsInstrumental(preset.isInstrumental)
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
                      data-testid="song-title-input"
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
                        {['[Verse]', '[Chorus]', '[Bridge]', '[Pre-Chorus]', '[Intro]', '[Outro]', '[Interlude]', '[Post Chorus]', '[Transition]', '[Break]', '[Hook]', '[Build Up]', '[Inst]', '[Solo]'].map(tag => (
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
                      data-testid="lyrics-input"
                      value={lyrics}
                      onChange={(e) => {
                        setLyrics(e.target.value)
                        if (lyricsCompressionSummary) {
                          setLyricsCompressionSummary(null)
                        }
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
                    {lyricsCompressionSummary?.applied && !isInstrumental && (
                      <div className="mt-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
                        当前输入已按 MiniMax 模型上限压缩保存。本次生成使用的是 {lyricsCompressionSummary.compressedLength}/{lyricsCompressionSummary.maxLength} 字符版本，原始输入为 {lyricsCompressionSummary.originalLength} 字符。
                      </div>
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
                      data-testid="genre-selector-trigger"
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
                        {selectedGenres.length > 0 ? displayGenres : t('selectStyle')}
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

                  {/* Mood */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('mood')} <span className="text-error">*</span>
                    </label>
                    <button
                      data-testid="mood-selector-trigger"
                      onClick={() => setIsMoodDrawerOpen(true)}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-left hover:border-accent transition-colors flex items-center justify-between"
                    >
                      <span className={mood ? "text-foreground" : "text-text-muted"}>
                        {displayMood || t('selectMood')}
                      </span>
                      {mood && <span className="text-sm text-accent">{displayMood}</span>}
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
                        {selectedInstruments.length > 0 ? displayInstruments : t('selectInstruments')}
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
                    <p className="text-xs text-text-muted mb-2">
                      音色与 Persona 当前通过提示词、参考歌手和后续参考音频流程间接影响歌曲效果，不保证精确锁定歌声音色。
                    </p>
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
                data-testid="generate-song-button"
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
                <section className="rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/80">
                        {t('generationComplete')}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground break-words">
                        {title}
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        {t('completedStageBody')}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[340px]">
                      <div className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-text-muted">{t('status')}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{t('ready')}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-text-muted">{t('formatLabel')}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{outputFormat.toUpperCase()}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-text-muted">{t('duration')}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{resultDurationLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-background/70 p-4">
                    <AudioPlayer
                      src={audioUrl ?? undefined}
                      title={title}
                      artist="TaoyBeats"
                      songId={songId ?? undefined}
                      playlist={playlistUrls.length > 1 ? playlistUrls : undefined}
                      playlistSongIds={playlistSongIds.length > 1 ? playlistSongIds : undefined}
                      onDurationResolved={(seconds) => setResultDurationLabel(formatDuration(seconds))}
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
        options={genreOptions}
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
        options={moodOptions}
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
        options={instrumentOptions}
        selectedValues={selectedInstruments}
        onConfirm={(values) => setSelectedInstruments(values)}
        multiSelect={true}
        searchPlaceholder={t('searchPlaceholderShort')}
      />
    </div>
  )
}
