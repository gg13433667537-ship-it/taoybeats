"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  Share2,
  Music,
} from "lucide-react"

interface LyricsPlayerProps {
  src?: string
  title?: string
  artist?: string
  genre?: string[]
  mood?: string
  lyrics?: string
  songId?: string
  shareToken?: string | null
  onDownload?: () => void
  onShare?: () => void
}

interface ParsedLine {
  text: string
  isHeader: boolean
  estimatedTime: number
}

function parseLyrics(lyrics: string, duration: number): ParsedLine[] {
  if (!lyrics || !duration) return []

  const rawLines = lyrics.split("\n")
  const lines: ParsedLine[] = []

  // First pass: identify headers and content lines
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const isHeader = /^\[.*\]$/.test(trimmed)
    lines.push({ text: trimmed, isHeader, estimatedTime: 0 })
  }

  // Count singable (non-header) lines
  const singableCount = lines.filter((l) => !l.isHeader).length
  if (singableCount === 0) return lines

  const timePerLine = duration / singableCount
  let singableIndex = 0

  // Assign estimated times
  for (const line of lines) {
    if (line.isHeader) {
      // Headers share time with the next singable line
      line.estimatedTime = singableIndex * timePerLine
    } else {
      line.estimatedTime = singableIndex * timePerLine
      singableIndex++
    }
  }

  return lines
}

function formatTime(time: number): string {
  const mins = Math.floor(time / 60)
  const secs = Math.floor(time % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function LyricsPlayer({
  src,
  title,
  artist,
  genre,
  mood,
  lyrics,
  songId,
  shareToken,
  onDownload,
  onShare,
}: LyricsPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Parse lyrics with estimated timing
  const parsedLines = useMemo(() => {
    return parseLyrics(lyrics || "", duration)
  }, [lyrics, duration])

  // Find current line index based on playback time
  const currentLineIndex = useMemo(() => {
    if (!parsedLines.length || !duration) return -1

    // Find the line whose estimated time is closest to currentTime
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLines[i].estimatedTime) {
        return i
      }
    }
    return 0
  }, [parsedLines, currentTime, duration])

  // Auto-scroll to keep current line centered
  useEffect(() => {
    if (currentLineIndex < 0 || !lyricsContainerRef.current) return

    const lineEl = lineRefs.current[currentLineIndex]
    const containerEl = lyricsContainerRef.current
    if (!lineEl || !containerEl) return

    const containerRect = containerEl.getBoundingClientRect()
    const lineRect = lineEl.getBoundingClientRect()
    const containerCenter = containerRect.height / 2
    const lineCenter = lineRect.top - containerRect.top + lineRect.height / 2
    const scrollOffset = lineCenter - containerCenter

    containerEl.scrollTo({
      top: containerEl.scrollTop + scrollOffset,
      behavior: "smooth",
    })
  }, [currentLineIndex])

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => {
      const d = audio.duration || 0
      if (Number.isFinite(d) && d > 0) {
        setDuration(d)
      }
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onCanPlay = () => {
      setIsLoading(false)
      const d = audio.duration || 0
      if (Number.isFinite(d) && d > 0) {
        setDuration(d)
      }
    }
    const onError = () => {
      setIsLoading(false)
      setLoadError("Failed to load audio")
    }
    const onLoadStart = () => {
      setIsLoading(true)
      setLoadError(null)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("canplay", onCanPlay)
    audio.addEventListener("error", onError)
    audio.addEventListener("loadstart", onLoadStart)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("canplay", onCanPlay)
      audio.removeEventListener("error", onError)
      audio.removeEventListener("loadstart", onLoadStart)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [src])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch((err) => {
        console.error("Playback failed:", err)
        setLoadError("Playback failed")
      })
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const next = !isMuted
    audio.muted = next
    setIsMuted(next)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = v
      audioRef.current.muted = v === 0
    }
    setVolume(v)
    setIsMuted(v === 0)
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
    setCurrentTime(time)
  }, [])

  const skip = useCallback(
    (seconds: number) => {
      const audio = audioRef.current
      if (!audio || !duration) return
      const newTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
      audio.currentTime = newTime
      setCurrentTime(newTime)
    },
    [duration]
  )

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === "Space" && src) {
        e.preventDefault()
        togglePlay()
      } else if (e.code === "ArrowLeft") {
        skip(-10)
      } else if (e.code === "ArrowRight") {
        skip(10)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [src, togglePlay, skip])

  if (!src) return null

  return (
    <div className="w-full">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Main Player Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface to-background shadow-2xl">
        {/* Background glow effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-6 sm:p-8">
          {/* Top: Album Art + Song Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
            {/* Album Art */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-gradient-to-br from-accent/30 via-purple-500/20 to-accent-glow/30 flex items-center justify-center shadow-lg shadow-accent/10">
                <Music className="w-12 h-12 sm:w-16 sm:h-16 text-accent/60" />
              </div>
              {/* Playing indicator dot */}
              {isPlaying && (
                <div className="absolute -top-1 -right-1 flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse delay-75" />
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse delay-150" />
                </div>
              )}
            </div>

            {/* Song Info */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 truncate">
                {title || "Untitled"}
              </h2>
              <p className="text-text-secondary text-sm mb-3">{artist || "TaoyBeats"}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {genre?.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium"
                  >
                    {g}
                  </span>
                ))}
                {mood && (
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                    {mood}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons (desktop) */}
            <div className="hidden sm:flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-accent/50 text-text-secondary hover:text-foreground transition-all"
                  aria-label="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-accent/50 text-text-secondary hover:text-foreground transition-all"
                  aria-label="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lyrics Display */}
          {parsedLines.length > 0 ? (
            <div
              ref={lyricsContainerRef}
              className="relative h-64 sm:h-80 overflow-y-auto rounded-2xl bg-background/50 border border-border/50 backdrop-blur-sm mb-6 scrollbar-thin"
              style={{ scrollBehavior: "smooth" }}
            >
              {/* Top fade */}
              <div className="sticky top-0 h-12 bg-gradient-to-b from-background/50 to-transparent pointer-events-none z-10" />

              <div className="py-8 px-6 space-y-3">
                {parsedLines.map((line, index) => {
                  const isCurrent = index === currentLineIndex
                  const isPast = index < currentLineIndex

                  return (
                    <div
                      key={index}
                      ref={(el) => {
                        lineRefs.current[index] = el
                      }}
                      className={`transition-all duration-500 ease-out ${
                        line.isHeader
                          ? "pt-4 pb-1"
                          : ""
                      }`}
                    >
                      <p
                        className={`transition-all duration-500 ${
                          line.isHeader
                            ? `text-xs font-bold tracking-widest uppercase ${
                                isCurrent || isPast
                                  ? "text-accent/80"
                                  : "text-text-muted/40"
                              }`
                            : isCurrent
                            ? "text-lg sm:text-xl font-semibold text-accent drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] scale-105 origin-left"
                            : isPast
                            ? "text-sm text-text-secondary/60"
                            : "text-sm text-text-muted/40"
                        }`}
                      >
                        {line.isHeader ? line.text.replace(/[\[\]]/g, "") : line.text}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Bottom fade */}
              <div className="sticky bottom-0 h-12 bg-gradient-to-t from-background/50 to-transparent pointer-events-none z-10" />
            </div>
          ) : (
            <div className="h-32 sm:h-40 rounded-2xl bg-background/50 border border-border/50 flex items-center justify-center mb-6">
              <p className="text-text-muted text-sm">No lyrics available</p>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="group">
              <div className="relative h-6 flex items-center">
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-border/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 transition-[width] duration-100"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* Hover preview track */}
                <div className="absolute inset-x-0 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-full bg-accent/20 rounded-full" />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={handleSeek}
                  disabled={!duration || !!loadError}
                  aria-label="Seek"
                  className="relative z-10 w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    height: "24px",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-text-muted font-mono">{formatTime(currentTime)}</span>
                <span className="text-xs text-text-muted font-mono">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              {/* Left: Skip buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => skip(-10)}
                  className="p-2 rounded-xl text-text-secondary hover:text-foreground hover:bg-surface-elevated transition-all"
                  aria-label="Back 10 seconds"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
              </div>

              {/* Center: Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={isLoading || !!loadError}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all shadow-lg shadow-accent/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-7 sm:h-7" />
                ) : (
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-1" />
                )}
              </button>

              {/* Right: Skip forward + Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => skip(10)}
                  className="p-2 rounded-xl text-text-secondary hover:text-foreground hover:bg-surface-elevated transition-all"
                  aria-label="Forward 10 seconds"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <div className="hidden sm:flex items-center gap-2 ml-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-xl text-text-secondary hover:text-foreground hover:bg-surface-elevated transition-all"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 rounded-full bg-border appearance-none cursor-pointer accent-accent"
                  />
                </div>
              </div>
            </div>

            {/* Error state */}
            {loadError && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm text-center">
                {loadError}
              </div>
            )}

            {/* Mobile action buttons */}
            <div className="flex sm:hidden items-center justify-center gap-3 pt-2">
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-border text-text-secondary text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-border text-text-secondary text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
