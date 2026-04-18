"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react"
import WaveSurfer from "wavesurfer.js"

interface AudioPlayerProps {
  src?: string
  title?: string
  artist?: string
  onEnded?: () => void
}

export default function AudioPlayer({ src, title, artist, onEnded }: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !src) return

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4a4a4a',
      progressColor: '#a855f7',
      cursorColor: '#ec4899',
      barWidth: 2,
      barRadius: 2,
      cursorWidth: 1,
      height: 48,
      barGap: 2,
    })

    wavesurferRef.current = wavesurfer

    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration())
      setIsReady(true)
    })

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    wavesurfer.on('timeupdate', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    wavesurfer.on('play', () => setIsPlaying(true))
    wavesurfer.on('pause', () => setIsPlaying(false))
    wavesurfer.on('finish', () => {
      setIsPlaying(false)
      onEnded?.()
    })

    wavesurfer.load(src)

    return () => {
      wavesurfer.destroy()
    }
  }, [src, onEnded])

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    wavesurferRef.current.playPause()
  }, [isReady])

  const toggleMute = useCallback(() => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.setMuted(!isMuted)
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume)
    }
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const skip = useCallback((seconds: number) => {
    if (!wavesurferRef.current) return
    const newTime = wavesurferRef.current.getCurrentTime() + seconds
    wavesurferRef.current.seekTo(newTime / wavesurferRef.current.getDuration())
  }, [])

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

  if (!src) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" aria-hidden="true" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
        )}
      </button>

      {/* Skip buttons */}
      <button
        onClick={() => skip(-10)}
        aria-label="Back 10 seconds"
        className="text-text-secondary hover:text-foreground transition-colors"
      >
        <SkipBack className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        onClick={() => skip(10)}
        aria-label="Forward 10 seconds"
        className="text-text-secondary hover:text-foreground transition-colors"
      >
        <SkipForward className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Track info */}
      <div className="w-32 flex-shrink-0 hidden sm:block">
        <p className="text-sm font-medium text-foreground truncate">{title || 'Unknown'}</p>
        <p className="text-xs text-text-muted truncate">{artist || 'TaoyBeats'}</p>
      </div>

      {/* Waveform Progress */}
      <div className="flex-1 min-w-0">
        <div ref={waveformRef} className="w-full cursor-pointer" />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-text-muted">{formatTime(currentTime)}</span>
          <span className="text-xs text-text-muted">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
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
          aria-label={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          className="w-20 h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
        />
      </div>
    </div>
  )
}
