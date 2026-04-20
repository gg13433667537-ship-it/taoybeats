"use client"

import { useState, useRef, useEffect, useCallback, useReducer } from "react"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download, AlertCircle, Loader2 } from "lucide-react"
import { downloadSongFile } from "@/lib/song-download"

interface AudioPlayerProps {
  src?: string
  title?: string
  artist?: string
  onEnded?: () => void
  onDurationResolved?: (seconds: number) => void
  filename?: string
  songId?: string
  playlist?: string[]
  playlistSongIds?: string[]
  playlistTitles?: string[]
  playlistArtists?: string[]
}

// Player state for useReducer to batch related updates
interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isLoading: boolean
  loadError: string | null
}

type PlayerAction =
  | { type: 'RESET' }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_CURRENT_TIME'; currentTime: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_VOLUME'; volume: number; isMuted?: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ALL'; isPlaying: boolean; currentTime: number; duration: number; isLoading: boolean; loadError: null }

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'RESET':
      return { ...state, isPlaying: false, currentTime: 0, duration: 0, isLoading: true, loadError: null }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying }
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.currentTime }
    case 'SET_DURATION':
      return { ...state, duration: action.duration }
    case 'SET_VOLUME':
      return { ...state, volume: action.volume, isMuted: action.isMuted ?? state.isMuted }
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }
    case 'SET_ERROR':
      return { ...state, loadError: action.error, isLoading: false }
    case 'SET_ALL':
      return { ...state, isPlaying: action.isPlaying, currentTime: action.currentTime, duration: action.duration, isLoading: action.isLoading, loadError: action.loadError }
    default:
      return state
  }
}

const initialPlayerState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isLoading: false,
  loadError: null,
}

export default function AudioPlayer({
  src,
  title,
  artist,
  onEnded,
  onDurationResolved,
  filename,
  songId,
  playlist,
  playlistSongIds,
  playlistTitles,
  playlistArtists,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pendingAutoplayRef = useRef(false)
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)

  // Destructure for convenience
  const { isPlaying, currentTime, duration, volume, isMuted, isLoading, loadError } = playerState

  const effectiveSongId = playlistSongIds && playlistSongIds.length > 0
    ? playlistSongIds[currentTrackIndex]
    : songId
  const effectiveSrc = effectiveSongId
    ? `/api/songs/${effectiveSongId}/audio`
    : (playlist && playlist.length > 0 ? playlist[currentTrackIndex] : src)
  const totalTracks = playlist?.length || 1
  const isMultiPart = totalTracks > 1
  const isPlaylistActive = Boolean(playlist && playlist.length > 1)
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  // Get current track info (from playlist arrays or fall back to props)
  const currentTitle = isMultiPart && playlistTitles?.[currentTrackIndex]
    ? playlistTitles[currentTrackIndex]
    : (playlist && playlist.length > 0 ? title : title)
  const currentArtist = isMultiPart && playlistArtists?.[currentTrackIndex]
    ? playlistArtists[currentTrackIndex]
    : artist

  const handleTrackFinished = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', isPlaying: false })
    dispatch({ type: 'SET_CURRENT_TIME', currentTime: 0 })
    if (playlist && playlist.length > 1 && currentTrackIndex < playlist.length - 1) {
      pendingAutoplayRef.current = true
      setCurrentTrackIndex((prev) => prev + 1)
    } else {
      onEnded?.()
    }
  }, [playlist, currentTrackIndex, onEnded])

  useEffect(() => {
    if (!effectiveSrc) return

    dispatch({ type: 'RESET' })
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    audio.load()

    return () => {
      audio.pause()
    }
  }, [effectiveSrc])

  const getMediaErrorMessage = useCallback(() => {
    const mediaError = audioRef.current?.error
    switch (mediaError?.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return 'Audio playback was aborted'
      case MediaError.MEDIA_ERR_NETWORK:
        return 'Audio network request failed'
      case MediaError.MEDIA_ERR_DECODE:
        return 'Failed to decode audio'
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'Audio format is not supported'
      default:
        return 'Failed to load audio'
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      return
    }

    try {
      await audio.play()
    } catch (error) {
      console.error('Playback failed:', error)
      dispatch({ type: 'SET_ERROR', error: error instanceof Error ? error.message : 'Failed to play audio' })
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const nextMuted = !isMuted
    audio.muted = nextMuted
    dispatch({ type: 'SET_VOLUME', volume, isMuted: nextMuted })
  }, [isMuted, volume])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
      audioRef.current.muted = newVolume === 0
    }
    dispatch({ type: 'SET_VOLUME', volume: newVolume, isMuted: newVolume === 0 })
  }, [])

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const newTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
    audio.currentTime = newTime
    dispatch({ type: 'SET_CURRENT_TIME', currentTime: newTime })
  }, [duration])

  const goToNextTrack = useCallback(() => {
    if (!playlist || currentTrackIndex >= playlist.length - 1) return
    pendingAutoplayRef.current = isPlaying
    setCurrentTrackIndex((prev) => prev + 1)
  }, [playlist, currentTrackIndex, isPlaying])

  const goToPreviousTrack = useCallback(() => {
    const audio = audioRef.current

    if (currentTime > 3 && audio) {
      audio.currentTime = 0
      dispatch({ type: 'SET_CURRENT_TIME', currentTime: 0 })
      return
    }

    if (!playlist || currentTrackIndex <= 0) return
    pendingAutoplayRef.current = isPlaying
    setCurrentTrackIndex((prev) => prev - 1)
  }, [playlist, currentTrackIndex, currentTime, isPlaying])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
    dispatch({ type: 'SET_CURRENT_TIME', currentTime: newTime })
  }, [])

  const handleCanPlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0
    if (nextDuration > 0) {
      onDurationResolved?.(nextDuration)
    }

    if (!pendingAutoplayRef.current) {
      dispatch({ type: 'SET_ALL', isPlaying: false, currentTime: 0, duration: nextDuration, isLoading: false, loadError: null })
      return
    }

    pendingAutoplayRef.current = false

    try {
      await audio.play()
    } catch (error) {
      console.error('Playback failed:', error)
      dispatch({ type: 'SET_ERROR', error: error instanceof Error ? error.message : 'Failed to play audio' })
    }
  }, [onDurationResolved])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0
    if (nextDuration > 0) {
      onDurationResolved?.(nextDuration)
    }
    dispatch({ type: 'SET_DURATION', duration: nextDuration })
    dispatch({ type: 'SET_LOADING', isLoading: false })
  }, [onDurationResolved])

  const handleAudioError = useCallback(() => {
    const message = getMediaErrorMessage()
    console.error('Audio element error:', message, audioRef.current?.error)
    dispatch({ type: 'SET_ERROR', error: message })
  }, [getMediaErrorMessage])

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Download audio file via API proxy to handle CORS from external URLs
  const handleDownload = useCallback(async () => {
    if (!effectiveSongId) return
    try {
      await downloadSongFile({
        songId: effectiveSongId,
        fallbackFilename: filename || currentTitle || 'audio',
      })
    } catch (error) {
      console.error('Download failed:', error)
    }
  }, [effectiveSongId, filename, currentTitle])

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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <audio
        key={effectiveSrc}
        ref={audioRef}
        src={effectiveSrc}
        preload="metadata"
        onLoadStart={() => {
          dispatch({ type: 'SET_LOADING', isLoading: true })
          dispatch({ type: 'SET_ERROR', error: null })
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={() => {
          if (audioRef.current) {
            dispatch({ type: 'SET_CURRENT_TIME', currentTime: audioRef.current.currentTime })
          }
        }}
        onPlay={() => dispatch({ type: 'SET_PLAYING', isPlaying: true })}
        onPause={() => dispatch({ type: 'SET_PLAYING', isPlaying: false })}
        onEnded={handleTrackFinished}
        onError={handleAudioError}
      />

      {/* Top row: Play controls, track info, download */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:gap-4">
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
        <div className="hidden min-w-0 flex-1 sm:block">
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
      <div className="flex w-full min-w-0 flex-wrap items-end gap-4">
        {/* Playback Progress */}
        <div className="min-w-0 flex-1 basis-full">
          {loadError && (
            <div className="flex items-center gap-2 mb-2 text-error text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Audio error: {loadError}</span>
            </div>
          )}
          <div className="relative h-6 flex items-center">
            <div className="absolute inset-x-0 h-2 rounded-full bg-border/70" />
            <div
              className="absolute left-0 h-2 rounded-full bg-gradient-to-r from-accent to-accent-glow transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              disabled={!duration || !!loadError}
              aria-label="Seek"
              className="relative z-10 w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-muted">{formatTime(currentTime)}</span>
            <span className="text-xs text-text-muted">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
            className="h-1 w-full max-w-full flex-1 rounded-full bg-border appearance-none cursor-pointer accent-accent sm:w-24 sm:flex-none md:w-28"
          />
        </div>
      </div>
    </div>
  )
}
