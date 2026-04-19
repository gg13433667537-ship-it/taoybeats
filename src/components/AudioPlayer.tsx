"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download, AlertCircle, Loader2 } from "lucide-react"
import WaveSurfer from "wavesurfer.js"

interface AudioPlayerProps {
  src?: string
  title?: string
  artist?: string
  onEnded?: () => void
  filename?: string
  playlist?: string[]
  playlistTitles?: string[]
  playlistArtists?: string[]
}

export default function AudioPlayer({
  src,
  title,
  artist,
  onEnded,
  filename,
  playlist,
  playlistTitles,
  playlistArtists,
}: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaylistActive, setIsPlaylistActive] = useState(false)

  // Determine effective src (playlist or single track)
  const effectiveSrc = playlist && playlist.length > 0 ? playlist[currentTrackIndex] : src
  const totalTracks = playlist?.length || 1
  const isMultiPart = totalTracks > 1

  // Get current track info (from playlist arrays or fall back to props)
  const currentTitle = isMultiPart && playlistTitles?.[currentTrackIndex]
    ? playlistTitles[currentTrackIndex]
    : (playlist && playlist.length > 0 ? title : title)
  const currentArtist = isMultiPart && playlistArtists?.[currentTrackIndex]
    ? playlistArtists[currentTrackIndex]
    : artist

  // Handle track finished - play next in playlist or call onEnded
  const handleTrackFinished = useCallback(() => {
    setIsPlaying(false)
    if (playlist && playlist.length > 1 && currentTrackIndex < playlist.length - 1) {
      setCurrentTrackIndex((prev) => prev + 1)
    } else {
      onEnded?.()
    }
  }, [playlist, currentTrackIndex, onEnded])

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !effectiveSrc) return

    // Reset state when src changes
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setIsLoading(true)
    setLoadError(null)
    setIsPlaylistActive(playlist && playlist.length > 1)

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
      setIsLoading(false)
    })

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    wavesurfer.on('timeupdate', () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    })

    wavesurfer.on('play', () => setIsPlaying(true))
    wavesurfer.on('pause', () => setIsPlaying(false))
    wavesurfer.on('finish', handleTrackFinished)

    wavesurfer.on('error', (err) => {
      console.error('WaveSurfer error:', err)
      setIsLoading(false)
      setLoadError(err instanceof Error ? err.message : 'Failed to load audio')
    })

    wavesurfer.load(effectiveSrc)

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [effectiveSrc, onEnded, handleTrackFinished, playlist])

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

  const goToNextTrack = useCallback(() => {
    if (!playlist || currentTrackIndex >= playlist.length - 1) return
    setCurrentTrackIndex((prev) => prev + 1)
  }, [playlist, currentTrackIndex])

  const goToPreviousTrack = useCallback(() => {
    // If more than 3 seconds in, restart current track instead of going to previous
    if (currentTime > 3 && wavesurferRef.current) {
      wavesurferRef.current.seekTo(0)
      return
    }
    if (!playlist || currentTrackIndex <= 0) return
    setCurrentTrackIndex((prev) => prev - 1)
  }, [playlist, currentTrackIndex, currentTime])

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Download audio file via API proxy to handle CORS from external URLs
  const handleDownload = useCallback(async () => {
    if (!effectiveSrc) return
    try {
      // Extract song ID from src path to use API proxy for CORS
      const songIdMatch = effectiveSrc.match(/\/songs\/([^/]+)/)
      if (songIdMatch) {
        const songId = songIdMatch[1]
        const response = await fetch(`/api/songs/${songId}/download`)
        if (!response.ok) throw new Error('Download failed')
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename || currentTitle || 'audio'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)
        return
      }
      // Fallback: direct fetch (may fail with CORS for external URLs)
      const response = await fetch(effectiveSrc)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || currentTitle || 'audio'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }, [effectiveSrc, filename, currentTitle])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && effectiveSrc) {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        skip(-10)
      } else if (e.code === 'ArrowRight') {
        skip(10)
      } else if (e.code === 'ArrowUp' && isPlaylistActive) {
        e.preventDefault()
        goToPreviousTrack()
      } else if (e.code === 'ArrowDown' && isPlaylistActive) {
        e.preventDefault()
        goToNextTrack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [effectiveSrc, togglePlay, skip, isPlaylistActive, goToPreviousTrack, goToNextTrack])

  if (!effectiveSrc) return null

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 rounded-xl bg-surface border border-border">
      {/* Top row: Play controls, track info, download */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={isLoading || !!loadError}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" aria-hidden="true" />
          ) : isPlaying ? (
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

        {/* Previous/Next track buttons (playlist only) */}
        {isPlaylistActive && (
          <>
            <button
              onClick={goToPreviousTrack}
              aria-label="Previous track"
              disabled={currentTrackIndex === 0}
              className="text-text-secondary hover:text-foreground transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              <span className="sr-only">Prev</span>
            </button>
            <button
              onClick={goToNextTrack}
              aria-label="Next track"
              disabled={currentTrackIndex === totalTracks - 1}
              className="text-text-secondary hover:text-foreground transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              <span className="sr-only">Next</span>
            </button>
          </>
        )}

        {/* Track info */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{currentTitle || 'Unknown'}</p>
            {isMultiPart && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent flex-shrink-0">
                Part {currentTrackIndex + 1}/{totalTracks}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">{currentArtist || 'TaoyBeats'}</p>
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
          {loadError && (
            <div className="flex items-center gap-2 mb-2 text-error text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Audio error: {loadError}</span>
            </div>
          )}
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
