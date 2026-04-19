"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Music, Plus, Loader2, Trash2, Edit2, ListMusic, Lock, Globe, X, Check } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useI18n } from "@/lib/i18n"
import PlaylistDrawer from "@/components/PlaylistDrawer"
import { downloadSongFile } from "@/lib/song-download"

interface Playlist {
  id: string
  name: string
  description?: string
  songIds: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
  songCount: number
}

interface PlaylistSong {
  id: string
  title?: string
  status?: string
  audioUrl?: string | null
}

export default function PlaylistsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("")
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [drawerSongs, setDrawerSongs] = useState<PlaylistSong[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists')
      if (res.ok) {
        const data = await res.json()
        setPlaylists(data.playlists || [])
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlaylists()
  }, [fetchPlaylists])

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDesc,
          isPublic: newPlaylistPublic,
        }),
      })

      if (res.ok) {
        setShowCreateModal(false)
        setNewPlaylistName("")
        setNewPlaylistDesc("")
        setNewPlaylistPublic(false)
        fetchPlaylists()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create playlist')
      }
    } catch {
      setError('Failed to create playlist')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Delete this playlist?')) return

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchPlaylists()
      }
    } catch {
      console.error("Failed to delete playlist")
    }
  }

  const handleUpdatePlaylist = async () => {
    if (!editingPlaylist || !newPlaylistName.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/playlists/${editingPlaylist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDesc,
          isPublic: newPlaylistPublic,
        }),
      })

      if (res.ok) {
        setEditingPlaylist(null)
        setNewPlaylistName("")
        setNewPlaylistDesc("")
        setNewPlaylistPublic(false)
        fetchPlaylists()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update playlist')
      }
    } catch {
      setError('Failed to update playlist')
    } finally {
      setIsSaving(false)
    }
  }

  const openEditModal = (playlist: Playlist) => {
    setEditingPlaylist(playlist)
    setNewPlaylistName(playlist.name)
    setNewPlaylistDesc(playlist.description || "")
    setNewPlaylistPublic(playlist.isPublic)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || null

  const openPlaylistDrawer = useCallback(async (playlist: Playlist) => {
    setActivePlaylistId(playlist.id)
    setDrawerLoading(true)

    try {
      const response = await fetch(`/api/playlists/${playlist.id}/songs`)
      if (!response.ok) {
        throw new Error("Failed to load playlist songs")
      }

      const data = await response.json()
      setDrawerSongs(data.songs || [])
    } catch (err) {
      console.error("Failed to load playlist songs:", err)
      setDrawerSongs([])
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  const closePlaylistDrawer = useCallback(() => {
    setActivePlaylistId(null)
    setDrawerSongs([])
    setDrawerLoading(false)
  }, [])

  const handleRemoveSongFromPlaylist = useCallback(async (songId: string) => {
    if (!activePlaylistId) return

    try {
      const response = await fetch(`/api/playlists/${activePlaylistId}/songs?songId=${encodeURIComponent(songId)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove song from playlist")
      }

      setDrawerSongs((current) => current.filter((song) => song.id !== songId))
      fetchPlaylists()
    } catch (err) {
      console.error("Failed to remove song from playlist:", err)
    }
  }, [activePlaylistId, fetchPlaylists])

  const handleOpenSong = useCallback((songId: string) => {
    router.push(`/song/${songId}`)
  }, [router])

  const handleDownloadSong = useCallback(async (song: PlaylistSong) => {
    if (!song.id) return

    try {
      await downloadSongFile({
        songId: song.id,
        fallbackFilename: song.title || "audio",
      })
    } catch (err) {
      console.error("Failed to download playlist song:", err)
    }
  }, [])

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
              onClick={() => router.push('/settings')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              {t('settings')}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('createPlaylist') || 'New Playlist'}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('myPlaylists') || 'My Playlists'}</h1>
            <p className="text-text-secondary">Organize your favorite songs into playlists</p>
          </div>

          {/* Playlists Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-20">
              <ListMusic className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('noPlaylists') || 'No playlists yet'}</h3>
              <p className="text-text-secondary mb-6">Create your first playlist to organize your music</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('createPlaylist') || 'Create Playlist'}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="cursor-pointer p-6 rounded-2xl bg-surface border border-border hover:border-accent/50 transition-all"
                  onClick={() => {
                    void openPlaylistDrawer(playlist)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent/20 to-accent-glow/20 flex items-center justify-center">
                        <ListMusic className="w-8 h-8 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{playlist.name}</h3>
                        {playlist.description && (
                          <p className="text-sm text-text-secondary mt-1">{playlist.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                          <span>{playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}</span>
                          <span>•</span>
                          <span>{formatDate(playlist.updatedAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {playlist.isPublic ? (
                              <>
                                <Globe className="w-3 h-3" /> Public
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Private
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          openEditModal(playlist)
                        }}
                        className="p-2 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-foreground transition-colors"
                        aria-label="Edit playlist"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeletePlaylist(playlist.id)
                        }}
                        className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                        aria-label="Delete playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPlaylist) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingPlaylist ? (t('editPlaylist') || 'Edit Playlist') : (t('createPlaylist') || 'Create Playlist')}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingPlaylist(null)
                    setNewPlaylistName("")
                    setNewPlaylistDesc("")
                    setNewPlaylistPublic(false)
                  }}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('playlistName') || 'Playlist Name'} *
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="My Awesome Playlist"
                  className="w-full px-4 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('description') || 'Description'}
                </label>
                <textarea
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder={t('optionalDescription') || 'Optional description...'}
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPlaylistPublic}
                  onChange={(e) => setNewPlaylistPublic(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background accent-accent"
                />
                <span className="text-sm text-foreground">{t('makePublic') || 'Make playlist public'}</span>
              </label>
              {error && (
                <p className="text-sm text-error">{error}</p>
              )}
            </div>
            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingPlaylist(null)
                }}
                className="flex-1 py-2 rounded-xl border border-border text-text-secondary hover:bg-surface-elevated transition-colors"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={editingPlaylist ? handleUpdatePlaylist : handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || isSaving}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingPlaylist ? (t('save') || 'Save') : (t('create') || 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <PlaylistDrawer
        isOpen={Boolean(activePlaylist)}
        playlist={activePlaylist ? {
          id: activePlaylist.id,
          name: activePlaylist.name,
          description: activePlaylist.description,
        } : null}
        songs={drawerSongs}
        loading={drawerLoading}
        onClose={closePlaylistDrawer}
        onRemoveSong={handleRemoveSongFromPlaylist}
        onOpenSong={handleOpenSong}
        onDownloadSong={handleDownloadSong}
      />
    </div>
  )
}
