"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react"

interface AudioPlayerProps {
  src?: string
  title?: string
  artist?: string
  onEnded?: () => void
}

export default function AudioPlayer({ src, title, artist, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !src) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, src])

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

  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds))
  }, [duration])

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && src) {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        skip(-10)
      } else if (e.code === 'ArrowRight') {
        skip(10)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [src, togglePlay, skip])

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      onEnded?.()
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [onEnded])

  if (!src) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* Skip buttons */}
      <button
        onClick={() => skip(-10)}
        className="text-text-secondary hover:text-foreground transition-colors"
        title="Back 10s"
      >
        <SkipBack className="w-5 h-5" />
      </button>
      <button
        onClick={() => skip(10)}
        className="text-text-secondary hover:text-foreground transition-colors"
        title="Forward 10s"
      >
        <SkipForward className="w-5 h-5" />
      </button>

      {/* Track info */}
      <div className="w-32 flex-shrink-0 hidden sm:block">
        <p className="text-sm font-medium text-foreground truncate">{title || 'Unknown'}</p>
        <p className="text-xs text-text-muted truncate">{artist || 'TaoyBeats'}</p>
      </div>

      {/* Progress */}
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
          style={{
            background: `linear-gradient(to right, #a855f7 ${progress}%, #2a2a2a ${progress}%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-text-muted">{formatTime(currentTime)}</span>
          <span className="text-xs text-text-muted">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={toggleMute}
          className="text-text-secondary hover:text-foreground transition-colors"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-20 h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
        />
      </div>
    </div>
  )
}
