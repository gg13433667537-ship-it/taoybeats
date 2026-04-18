"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Music, Play, Pause, Download, Share2, Check, Loader2, Volume2, VolumeX, RefreshCw, AlertCircle, X, Layers, Plus } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useKeyboardShortcuts, SHORTCUTS } from "@/hooks/useKeyboardShortcuts"

export default function SongSharePage() {
  const { t } = useI18n()
  const params = useParams()
  const songId = params.id as string

  const [song, setSong] = useState<{
    title?: string
    genre?: string[]
    mood?: string
    lyrics?: string
    instruments?: string[]
    audioUrl?: string
    status?: string
    [key: string]: unknown
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isRemixing, setIsRemixing] = useState(false)
  const [isSplitting, setIsSplitting] = useState(false)
  const [stemsResult, setStemsResult] = useState<{
    stems: Array<{ stem_type: string; label: string; audioUrl: string }>
  } | null>(null)
  const [showStemsModal, setShowStemsModal] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [songError, setSongError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  // Helper to update meta tags
  const updateMetaTag = (property: string, content: string) => {
    let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('property', property)
      document.head.appendChild(meta)
    }
    meta.content = content
  }

  // Fetch song data
  useEffect(() => {
    const fetchSong = async () => {
      try {
        // Check if songId looks like a shareToken (8 alphanumeric chars)
        const isShareToken = /^[a-z0-9]{8}$/i.test(songId)

        const endpoint = isShareToken
          ? `/api/songs/by-share/${songId}`
          : `/api/songs/${songId}`

        const res = await fetch(endpoint)
        if (res.ok) {
          const data = await res.json()
          setSong(data)
          // Generate random waveform data for visualization
          if (data.status === 'COMPLETED') {
            const bars = Array.from({ length: 64 }, () => Math.random() * 0.7 + 0.3)
            setWaveformData(bars)
          }
        }
      } catch (error) {
        console.error("Error fetching song:", error)
        setSongError(t('songLoadFailed'))
      } finally {
        setLoading(false)
      }
    }

    fetchSong()
  }, [songId, t])

  // Update OG meta tags when song data changes
  useEffect(() => {
    if (song?.title) {
      const title = `${song.title} - TaoyBeats`
      const description = `Listen to "${song.title}"${song.genre?.length ? ` - ${song.genre.join(', ')}` : ''} created with AI on TaoyBeats`
      const imageUrl = (song.coverUrl as string | undefined) || `https://api.dicebear.com/7.x/identicon/svg?seed=${song.id}`

      document.title = title
      updateMetaTag('og:title', title)
      updateMetaTag('og:description', description)
      updateMetaTag('og:image', imageUrl)
      updateMetaTag('og:type', 'music.song')
      updateMetaTag('twitter:card', 'summary_large_image')
      updateMetaTag('twitter:title', title)
      updateMetaTag('twitter:description', description)
      updateMetaTag('twitter:image', imageUrl)
    }
  }, [song])

  // Keyboard shortcuts

  // Audio controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
    setCurrentTime(time)
  }, [])

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [song?.audioUrl])

  // Canvas waveform animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      const barWidth = width / waveformData.length
      const progress = duration > 0 ? currentTime / duration : 0

      ctx.clearRect(0, 0, width, height)

      waveformData.forEach((value, i) => {
        const barHeight = value * height * 0.8
        const x = i * barWidth
        const y = (height - barHeight) / 2

        // Color based on playback position
        const isPlayed = (i / waveformData.length) < progress
        ctx.fillStyle = isPlayed ? '#a855f7' : '#4a4a4a'

        // Rounded bars
        const radius = Math.min(barWidth * 0.4, 3)
        ctx.beginPath()
        ctx.roundRect(x + 1, y, barWidth - 2, barHeight, radius)
        ctx.fill()
      })

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [waveformData, isPlaying, currentTime, duration])

  const handleShare = async () => {
    // Use shareToken for public URL, fall back to current URL
    const shareToken = (song as { shareToken?: string })?.shareToken
    const shareUrl = shareToken
      ? `${window.location.origin}/song/${shareToken}`
      : window.location.href
    const shareTitle = song?.title || "TaoyBeats Song"
    const shareText = `Check out "${shareTitle}" on TaoyBeats!`

    if (navigator.share) {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setShowShareMenu(false)
  }

  const shareToTwitter = () => {
    const shareToken = (song as { shareToken?: string })?.shareToken
    const shareUrl = shareToken
      ? `${window.location.origin}/song/${shareToken}`
      : window.location.href
    const shareTitle = encodeURIComponent(song?.title || "TaoyBeats Song")
    window.open(`https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(shareUrl)}`, '_blank')
    setShowShareMenu(false)
  }

  const shareToFacebook = () => {
    const shareToken = (song as { shareToken?: string })?.shareToken
    const shareUrl = shareToken
      ? `${window.location.origin}/song/${shareToken}`
      : window.location.href
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
    setShowShareMenu(false)
  }

  const handleDownload = () => {
    if (song?.audioUrl) {
      window.open(song.audioUrl, "_blank")
    }
  }

  const handleRemix = async () => {
    if (!song) return

    setIsRemixing(true)
    try {
      const res = await fetch(`/api/songs/${songId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        const data = await res.json()
        // Redirect to generate page with fork parameters
        window.location.href = `/generate?fork=${songId}&songId=${data.id}`
      } else {
        setSongError(t('remixFailed'))
      }
    } catch (error) {
      console.error('Remix error:', error)
      setSongError(t('remixFailed'))
    } finally {
      setIsRemixing(false)
    }
  }

  const handleContinue = async () => {
    if (!song) return

    const customPrompt = prompt('Enter a prompt for the continuation (optional):')
    if (customPrompt === null) return // User cancelled

    setIsRemixing(true)
    try {
      const res = await fetch(`/api/songs/${songId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt || undefined }),
      })

      if (res.ok) {
        const data = await res.json()
        // Redirect to the new continued song
        window.location.href = data.redirectUrl || `/song/${data.id}`
      } else {
        const error = await res.json()
        setSongError(error.error || t('continueFailed'))
      }
    } catch (error) {
      console.error('Continue error:', error)
      setSongError(t('continueFailed'))
    } finally {
      setIsRemixing(false)
    }
  }

  const handleSplitStems = async () => {
    if (!song) return

    setIsSplitting(true)
    try {
      const res = await fetch(`/api/songs/${songId}/stems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        setStemsResult(data)
        setShowStemsModal(true)
      } else {
        const error = await res.json()
        setSongError(error.error || t('stemSplitFailed'))
      }
    } catch (error) {
      console.error('Stem split error:', error)
      setSongError(t('stemSplitFailed'))
    } finally {
      setIsSplitting(false)
    }
  }

  const isGenerating = song?.status === 'GENERATING' || song?.status === 'PENDING'

  // Keyboard shortcuts
  useKeyboardShortcuts([
    /* eslint-disable react-hooks/refs */
    SHORTCUTS.PLAY_PAUSE(togglePlay),
    SHORTCUTS.SHARE(() => setShowShareMenu(true)),
    SHORTCUTS.DOWNLOAD(handleDownload),
    SHORTCUTS.MUTE(() => setIsMuted(!isMuted)),
    SHORTCUTS.CLOSE_MODAL(() => {
      setShowShareMenu(false)
      setShowStemsModal(false)
    }),
  ])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-text-secondary">{t('generatingEllipsis')}</p>
        </div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('songNotFound')}</h1>
          <p className="text-text-secondary mb-6">{t('songRemovedOrInvalid')}</p>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
          >
            {t('goToTaoyBeats')}
          </Link>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Hidden audio element */}
      {song.audioUrl && (
        <audio
          ref={audioRef}
          src={song.audioUrl}
          preload="metadata"
        />
      )}

      {/* Error Banner */}
      {songError && (
        <div className="mx-auto mt-4 max-w-5xl px-4 pt-4">
          <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-error" />
              <span className="text-error text-sm">{songError}</span>
            </div>
            <button
              onClick={() => setSongError(null)}
              className="p-1 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            {t('createYourOwn')}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Song Card */}
          <div className="p-8 rounded-2xl bg-surface border border-border">
            {/* Title & Genre */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-3">{song.title}</h1>
              <div className="flex flex-wrap gap-2">
                {song.genre?.map((g: string) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm"
                  >
                    {g}
                  </span>
                ))}
                {song.mood && (
                  <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-secondary text-sm">
                    {song.mood}
                  </span>
                )}
                {song.instruments && song.instruments.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-secondary text-sm">
                    {song.instruments.slice(0, 3).join(", ")}
                  </span>
                )}
              </div>
            </div>

            {/* Waveform Canvas */}
            <div className="h-32 rounded-xl bg-background mb-6 flex items-center justify-center overflow-hidden">
              {isGenerating ? (
                <div className="flex items-center gap-2 text-text-muted">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{t('generatingEllipsis')}</span>
                </div>
              ) : song.audioUrl ? (
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={100}
                  className="w-full h-full px-4"
                />
              ) : (
                <div className="flex items-center gap-2 text-text-muted">
                  <span>{t('audioNotAvailable')}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={togglePlay}
                disabled={!song.audioUrl || isGenerating}
                aria-label={isPlaying ? t('pause') : t('play')}
                className="w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Play className="w-6 h-6 ml-1" aria-hidden="true" />
                )}
              </button>

              <div className="flex-1">
                {/* Progress bar */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={!song.audioUrl || isGenerating}
                  aria-label={`Progress: ${formatTime(currentTime)} of ${formatTime(duration)}`}
                  className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, #a855f7 ${duration ? (currentTime / duration) * 100 : 0}%, #2a2a2a ${duration ? (currentTime / duration) * 100 : 0}%)`,
                  }}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-sm text-text-muted">{formatTime(currentTime)}</p>
                  <p className="text-sm text-text-muted">{formatTime(duration)}</p>
                </div>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? t('unmute') : t('mute')}
                  className="text-text-secondary hover:text-foreground transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  className="w-20 h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                />
              </div>
            </div>

            {/* Lyrics */}
            {song.lyrics && (
              <div className="mb-6 p-4 rounded-xl bg-background border border-border">
                <h3 className="text-sm font-medium text-text-secondary mb-2">{t('lyrics')}</h3>
                <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                  {song.lyrics}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                disabled={!song.audioUrl || isGenerating}
                aria-label={t('download')}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                {t('download')}
              </button>
              <button
                onClick={handleRemix}
                disabled={isGenerating || isRemixing}
                aria-label={isRemixing ? t('remixing') : t('remix')}
                className="flex-1 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemixing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                )}
                {isRemixing ? t('remixing') : t('remix')}
              </button>
              <button
                onClick={handleContinue}
                disabled={isGenerating || isRemixing || !song.audioUrl}
                aria-label={isRemixing ? t('continuing') : t('continue')}
                className="flex-1 py-3 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 text-green-400 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('continueDesc')}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                {isRemixing ? t('continuing') : t('continue')}
              </button>
              <button
                onClick={handleSplitStems}
                disabled={isGenerating || isSplitting || !song.audioUrl}
                aria-label={isSplitting ? t('splittingStems') : t('splitStems')}
                className="flex-1 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('splitStemsDesc')}
              >
                {isSplitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Layers className="w-4 h-4" aria-hidden="true" />
                )}
                {isSplitting ? t('splittingStems') : t('splitStems')}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  aria-label={t('share')}
                  aria-expanded={showShareMenu}
                  className="py-3 px-4 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  {t('share')}
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-lg overflow-hidden z-50">
                    <button
                      onClick={shareToTwitter}
                      className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
                    >
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                      Share on Twitter
                    </button>
                    <button
                      onClick={shareToFacebook}
                      className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
                    >
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                      Share on Facebook
                    </button>
                    <div className="border-t border-border" />
                    <button
                      onClick={handleShare}
                      className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
                    >
                      {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
                      {copied ? t('copied') : 'Copy Link'}
                    </button>
                  </div>
                )}
              </div>
              {showShareMenu && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareMenu(false)}
                />
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-text-secondary text-sm">
                {t('createdWith')}{" "}
                <Link href="/" className="text-accent hover:underline">
                  TaoyBeats
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Stems Modal */}
      {showStemsModal && stemsResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t('stemsModalTitle')}</h2>
                  <p className="text-sm text-text-secondary mt-1">{t('stemsModalDesc')}</p>
                </div>
                <button
                  onClick={() => setShowStemsModal(false)}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {stemsResult.stems.map((stem) => (
                <div
                  key={stem.stem_type}
                  className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{stem.label}</p>
                      <p className="text-xs text-text-muted capitalize">{stem.stem_type}</p>
                    </div>
                  </div>
                  <a
                    href={stem.audioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium transition-colors"
                  >
                    {t('download')}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
