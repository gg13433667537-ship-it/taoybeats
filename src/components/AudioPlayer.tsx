"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download } from "lucide-react"
import WaveSurfer from "wavesurfer.js"

interface AudioPlayerProps {
  src?: string
  title?: string
  artist?: string
  onEnded?: () => void
  filename?: string
}

export default function AudioPlayer({ src, title, artist, onEnded, filename }: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !src) return

    // Reset state when src changes
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

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
      const dur = wavesurfer.getDuration()
      setDuration(dur)
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

    wavesurfer.on('error', (err) => {
      console.error('WaveSurfer error:', err)
    })

    wavesurfer.load(src)

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [src, onEnded])

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current) return
    // Check if wavesurfer is ready by checking if it has a duration
    const duration = wavesurferRef.current.getDuration()
    if (!duration || duration === 0) {
      console.warn('WaveSurfer not ready yet')
      return
    }
    wavesurferRef.current.playPause()
  }, [])

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
    const duration = wavesurferRef.current.getDuration()
    if (!duration || duration === 0) return
    const newTime = wavesurferRef.current.getCurrentTime() + seconds
    wavesurferRef.current.seekTo(Math.max(0, Math.min(1, newTime / duration)))
  }, [])

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Download audio file directly to user's local machine
  const handleDownload = useCallback(async () => {
    if (!src) return
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || title || 'audio'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }, [src, filename, title])

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

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 rounded-xl bg-surface border border-border">
      {/* Top row: Play controls, track info, download */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors flex-shrink-0"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" aria-hidden="true" />
          )}
        </button>

        {/* Skip buttons */}
        <button
          onClick={() => skip(-10)}
          aria-label="Back 10 seconds"
          className="text-text-secondary hover:text-foreground transition-colors p-1"
        >
          <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </button>
        <button
          onClick={() => skip(10)}
          aria-label="Forward 10 seconds"
          className="text-text-secondary hover:text-foreground transition-colors p-1"
        >
          <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="text-sm font-medium text-foreground truncate">{title || 'Unknown'}</p>
          <p className="text-xs text-text-muted truncate">{artist || 'TaoyBeats'}</p>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          aria-label="Download"
          className="text-text-secondary hover:text-foreground transition-colors p-1 flex-shrink-0"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Bottom row: Waveform and Volume */}
      <div className="flex items-center gap-3 w-full">
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
            className="text-text-secondary hover:text-foreground transition-colors p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
            className="w-16 sm:w-20 h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
          />
        </div>
      </div>
    </div>
  )
}
