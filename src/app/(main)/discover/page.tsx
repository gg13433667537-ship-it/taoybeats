"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Music, Clock, Filter, ChevronLeft, ChevronRight, Share2, User, Play, Pause, Search, ArrowUpDown, AlertTriangle, RefreshCw, Check } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"
import { DiscoverGridSkeleton, FilterBarSkeleton } from "@/components/Skeleton"

interface DiscoverSong {
  id: string
  title: string
  genre: string[]
  mood?: string
  instruments: string[]
  audioUrl?: string
  coverUrl?: string
  shareToken?: string
  userName: string
  userEmail?: string
  createdAt: string
}

interface DiscoverResponse {
  songs: DiscoverSong[]
  page: number
  limit: number
  total: number
 totalPages: number
}

interface ErrorState {
  hasError: boolean
  message: string
}

const MOOD_LABEL_KEYS = {
  Happy: 'moodHappy',
  Sad: 'moodSad',
  Energetic: 'moodEnergetic',
  Calm: 'moodCalm',
  Romantic: 'moodRomantic',
  Epic: 'moodEpic',
  Dark: 'moodDark',
  Dreamy: 'moodDreamy',
  Festive: 'moodFestive',
  Uplifting: 'moodUplifting',
} as const

export default function DiscoverPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [songs, setSongs] = useState<DiscoverSong[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [genreFilter, setGenreFilter] = useState("")
  const [moodFilter, setMoodFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false, message: "" })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const GENRES = ["Pop", "Hip-Hop", "Rock", "Electronic", "R&B", "Jazz", "Classical", "Country", "Folk", "Metal", "Indie", "Mandopop", "K-Pop", "Latin"]
  const MOODS = Object.keys(MOOD_LABEL_KEYS) as Array<keyof typeof MOOD_LABEL_KEYS>

  const fetchSongs = useCallback(async (pageNum: number) => {
    setLoading(true)
    setErrorState({ hasError: false, message: "" })
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "12",
      })
      if (genreFilter) params.set('genre', genreFilter)
      if (moodFilter) params.set('mood', moodFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (sortBy) params.set('sort', sortBy)

      const res = await fetch(`/api/discover?${params}`)
      if (res.ok) {
        const data: DiscoverResponse = await res.json()
        setSongs(data.songs)
        setPage(data.page)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      } else if (res.status === 500) {
        setErrorState({ hasError: true, message: "Server error. Please try again later." })
      }
    } catch (error) {
      console.error("Failed to fetch songs:", error)
      setErrorState({ hasError: true, message: "Failed to load songs. Please check your connection." })
    } finally {
      setLoading(false)
    }
  }, [genreFilter, moodFilter, debouncedSearch, sortBy])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reload when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSongs(1)
  }, [debouncedSearch, sortBy, genreFilter, moodFilter, fetchSongs])

  // Audio controls
  const togglePlay = (song: DiscoverSong, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    if (playingId === song.id) {
      audioRef.current.pause()
      setPlayingId(null)
    } else {
      if (audioRef.current.src !== song.audioUrl) {
        audioRef.current.src = song.audioUrl || ''
      }
      audioRef.current.play().catch(console.error)
      setPlayingId(song.id)
    }
  }

  // Stop playing when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (audioRef.current && playingId) {
        audioRef.current.pause()
        setPlayingId(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // playingId is captured in closure, no need to re-run effect when it changes

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const handleShare = async (song: DiscoverSong, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/song/${song.shareToken || song.id}`
    if (navigator.share) {
      await navigator.share({
        title: song.title,
        text: `Listen to "${song.title}" by ${song.userName} on TaoyBeats!`,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedId(song.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              {t('dashboard')}
            </button>
            <button
              onClick={() => router.push('/generate')}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              {t('createSong')}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('discover')}</h1>
            <p className="text-text-secondary">{t('discoverExplore')}</p>
          </div>

          {/* Filters */}
          <div className="mb-8 p-4 rounded-2xl bg-surface border border-border">
            {loading && !songs.length ? (
              <FilterBarSkeleton />
            ) : (
              <div className="flex flex-wrap gap-4">
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('discoverSearchPlaceholder')}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent placeholder:text-text-muted"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-text-muted" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="newest">{t('discoverNewestFirst')}</option>
                    <option value="oldest">{t('discoverOldestFirst')}</option>
                    <option value="title">{t('discoverByTitle')}</option>
                  </select>
                </div>

                {/* Genre Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-muted" />
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="">{t('discoverAllGenres')}</option>
                    {GENRES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Mood Filter */}
                <div className="flex items-center gap-2">
                  <select
                    value={moodFilter}
                    onChange={(e) => setMoodFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="">{t('discoverAllMoods')}</option>
                    {MOODS.map(m => (
                      <option key={m} value={m}>{t(MOOD_LABEL_KEYS[m])}</option>
                    ))}
                  </select>
                </div>

                {/* Results count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">
                    {total} {total === 1 ? t('discoverSongFound') : t('discoverSongsFound')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Songs Grid */}
          {loading && !songs.length ? (
            <DiscoverGridSkeleton count={6} />
          ) : errorState.hasError ? (
            <div className="text-center py-20">
              <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('discoverSomethingWentWrong')}</h3>
              <p className="text-text-secondary mb-6">{errorState.message}</p>
              <button
                onClick={() => fetchSongs(1)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('discoverTryAgain')}
              </button>
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-20">
              <Music className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('discoverNoSongsYet')}</h3>
              <p className="text-text-secondary mb-6">{t('discoverBeFirst')}</p>
              <Link
                href="/generate"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                <Music className="w-4 h-4" />
                {t('discoverCreateFirstSong')}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {songs.map((song) => (
                  <Link
                    key={song.id}
                    href={`/song/${song.shareToken || song.id}`}
                    className="group p-6 rounded-2xl bg-surface border border-border hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/5"
                  >
                    {/* Cover / Waveform Placeholder */}
                    <div className="h-32 rounded-xl bg-gradient-to-br from-accent/20 to-accent-glow/20 mb-4 flex items-center justify-center overflow-hidden relative group/cover">
                      {song.coverUrl ? (
                        <Image src={song.coverUrl || ""} alt={song.title} fill className="object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 32 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-accent/60 rounded-full animate-pulse"
                              style={{
                                height: `${Math.random() * 24 + 8}px`,
                                animationDelay: `${i * 50}ms`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Play Button Overlay */}
                      <button
                        onClick={(e) => togglePlay(song, e)}
                        className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity`}
                        aria-label={playingId === song.id ? t('pause') : t('play')}
                      >
                        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
                          {playingId === song.id ? (
                            <Pause className="w-6 h-6 text-white" />
                          ) : (
                            <Play className="w-6 h-6 text-white ml-1" />
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Song Info */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                        {song.title}
                      </h3>

                      {/* Creator */}
                      <div className="flex items-center gap-2 text-sm text-text-muted">
                        <User className="w-3 h-3" />
                        <span>{song.userName}</span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {song.genre?.slice(0, 2).map(g => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs"
                          >
                            {g}
                          </span>
                        ))}
                        {song.mood && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted text-xs">
                            {song.mood}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(song.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleShare(song, e)}
                            className={`p-2 rounded-lg transition-colors ${
                              copiedId === song.id
                                ? "bg-success/10 text-success"
                                : "hover:bg-background text-text-muted hover:text-accent"
                            }`}
                            aria-label={copiedId === song.id ? "Copied!" : "Share"}
                          >
                            {copiedId === song.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => fetchSongs(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-text-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => fetchSongs(page + 1)}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
