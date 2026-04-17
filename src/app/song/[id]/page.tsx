"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Music, Play, Pause, Download, Share2, Check, Loader2, Volume2, VolumeX, RefreshCw, AlertCircle, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"

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
  const [songError, setSongError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  // Fetch song data
  useEffect(() => {
    const fetchSong = async () => {
      try {
        const res = await fetch(`/api/songs/${songId}`)
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
        setSongError("加载歌曲失败，请刷新页面重试")
      } finally {
        setLoading(false)
      }
    }

    fetchSong()
  }, [songId])

  // Audio controls
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
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
    if (navigator.share) {
      await navigator.share({
        title: song?.title || "TaoyBeats Song",
        text: `Check out my song on TaoyBeats!`,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (song?.audioUrl) {
      window.open(song.audioUrl, "_blank")
    }
  }

  const handleRemix = async () => {
    if (!song) return

    // Get API key from localStorage or prompt user
    const apiKey = localStorage.getItem('minimax_api_key')
    if (!apiKey) {
      setSongError('请先在生成页面设置 MiniMax API Key')
      return
    }

    setIsRemixing(true)
    try {
      const res = await fetch(`/api/songs/${songId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      if (res.ok) {
        const data = await res.json()
        // Redirect to generate page with fork parameters
        window.location.href = `/generate?fork=${songId}&songId=${data.id}`
      } else {
        setSongError('Remix失败，请重试')
      }
    } catch (error) {
      console.error('Remix error:', error)
      setSongError('Remix失败，请重试')
    } finally {
      setIsRemixing(false)
    }
  }

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

  const isGenerating = song.status === 'GENERATING' || song.status === 'PENDING'

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
                  <span>Audio not available</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={togglePlay}
                disabled={!song.audioUrl || isGenerating}
                aria-label={isPlaying ? "Pause" : "Play"}
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
                  aria-label={isMuted ? "Unmute" : "Mute"}
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
                <h3 className="text-sm font-medium text-text-secondary mb-2">Lyrics</h3>
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
                aria-label="Download song"
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Download
              </button>
              <button
                onClick={handleRemix}
                disabled={isGenerating || isRemixing}
                aria-label={isRemixing ? "Remixing..." : "Remix this song"}
                className="flex-1 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemixing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                )}
                {isRemixing ? "Remixing..." : "Remix"}
              </button>
              <button
                onClick={handleShare}
                aria-label={copied ? "Link copied!" : "Share song"}
                className="py-3 px-4 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
                {copied ? "Copied!" : "Share"}
              </button>
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
    </div>
  )
}
