"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Music, Play, Loader2, User, Calendar, ListMusic } from "lucide-react"

interface ProfileSong {
  id: string
  title: string
  genre: string[]
  mood?: string
  audioUrl?: string
  coverUrl?: string
  shareToken?: string
  createdAt: string
}

interface ProfilePlaylist {
  id: string
  name: string
  description?: string
  songCount: number
  isPublic: boolean
}

interface ProfileData {
  userId: string
  name: string
  email?: string
  createdAt: string
  songs: ProfileSong[]
  playlists: ProfilePlaylist[]
  totalSongs: number
}

export default function ProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'songs' | 'playlists'>('songs')

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      } else if (res.status === 404) {
        setError('User not found')
      } else {
        setError('Failed to load profile')
      }
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile()
  }, [fetchProfile])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{error || 'User not found'}</h1>
          <p className="text-text-secondary mb-6">This profile doesn&apos;t exist or is private</p>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
          >
            Go to TaoyBeats
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </Link>
          <Link
            href="/generate"
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Create Music
          </Link>
        </div>
      </header>

      {/* Profile Header */}
      <div className="bg-surface border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">{profile.name || 'Anonymous'}</h1>
                <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {formatDate(profile.createdAt)}
                  </span>
                  <span>{profile.totalSongs} songs</span>
                  <span>{profile.playlists.length} playlists</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex gap-6 border-t border-border">
            <button
              onClick={() => setActiveTab('songs')}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'songs'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-foreground'
              }`}
            >
              Songs ({profile.songs.length})
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'playlists'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-foreground'
              }`}
            >
              Playlists ({profile.playlists.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'songs' ? (
            /* Songs Grid */
            profile.songs.length === 0 ? (
              <div className="text-center py-20">
                <Music className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
                <p className="text-text-secondary">This user hasn&apos;t created any songs</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profile.songs.map((song) => (
                  <Link
                    key={song.id}
                    href={`/song/${song.shareToken || song.id}`}
                    className="group p-6 rounded-2xl bg-surface border border-border hover:border-accent/50 transition-all"
                  >
                    {/* Cover */}
                    <div className="h-32 rounded-xl bg-gradient-to-br from-accent/20 to-accent-glow/20 mb-4 flex items-center justify-center relative">
                      {song.coverUrl ? (
                        <Image src={song.coverUrl || ""} alt={song.title} className="w-full h-full object-cover rounded-xl" loading="lazy" decoding="async" />
                      ) : (
                        <Music className="w-12 h-12 text-accent/40" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <h3 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                      {song.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {song.genre?.slice(0, 2).map((g) => (
                        <span key={g} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
                          {g}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            /* Playlists */
            profile.playlists.length === 0 ? (
              <div className="text-center py-20">
                <ListMusic className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No playlists yet</h3>
                <p className="text-text-secondary">This user hasn&apos;t created any playlists</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {profile.playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="p-6 rounded-2xl bg-surface border border-border hover:border-accent/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent/20 to-accent-glow/20 flex items-center justify-center">
                          <ListMusic className="w-8 h-8 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{playlist.name}</h3>
                          {playlist.description && (
                            <p className="text-sm text-text-secondary mt-1">{playlist.description}</p>
                          )}
                          <p className="text-xs text-text-muted mt-1">
                            {playlist.songCount} songs • {playlist.isPublic ? 'Public' : 'Private'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}
