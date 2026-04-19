"use client"

import { Download, ExternalLink, Loader2, Trash2, X } from "lucide-react"

interface PlaylistSong {
  id: string
  title?: string
  status?: string
  audioUrl?: string | null
}

interface PlaylistDrawerProps {
  isOpen: boolean
  playlist: {
    id: string
    name: string
    description?: string
  } | null
  songs: PlaylistSong[]
  loading: boolean
  onClose: () => void
  onRemoveSong: (songId: string) => void
  onOpenSong: (songId: string) => void
  onDownloadSong: (song: PlaylistSong) => void
}

export default function PlaylistDrawer({
  isOpen,
  playlist,
  songs,
  loading,
  onClose,
  onRemoveSong,
  onOpenSong,
  onDownloadSong,
}: PlaylistDrawerProps) {
  if (!isOpen || !playlist) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close playlist drawer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={playlist.name}
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Playlist</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{playlist.name}</h2>
            {playlist.description ? (
              <p className="mt-2 text-sm text-text-secondary">{playlist.description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-background hover:text-foreground"
            aria-label="Close playlist drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-6 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading songs...
            </div>
          ) : songs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-8 text-center text-sm text-text-secondary">
              This playlist does not have any songs yet.
            </div>
          ) : (
            songs.map((song) => {
              const isReady = song.status === "COMPLETED"

              return (
                <div
                  key={song.id}
                  className="rounded-2xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-foreground">{song.title || "Untitled song"}</h3>
                      <p className="mt-2 text-sm text-text-secondary">{song.status || "UNKNOWN"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSong(song.id)}
                        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface hover:text-foreground"
                        aria-label={`Open ${song.title || "song"}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadSong(song)}
                        disabled={!isReady || !song.audioUrl}
                        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Download ${song.title || "song"}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveSong(song.id)}
                        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-error/10 hover:text-error"
                        aria-label={`Remove ${song.title || "song"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
