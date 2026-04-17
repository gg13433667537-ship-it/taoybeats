"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, Plus, Play, MoreHorizontal, Clock, Trash2, Share2, Download } from "lucide-react"

// Demo songs data
const DEMO_SONGS = [
  {
    id: "1",
    title: "Summer Vibes",
    status: "COMPLETED",
    createdAt: "2 hours ago",
    duration: "3:24",
    genre: ["Pop", "Dance"]
  },
  {
    id: "2",
    title: "Midnight Dreams",
    status: "COMPLETED",
    createdAt: "1 day ago",
    duration: "4:12",
    genre: ["R&B", "Soul"]
  },
  {
    id: "3",
    title: "Electric Pulse",
    status: "GENERATING",
    createdAt: "Just now",
    progress: 65,
    genre: ["Electronic"]
  }
]

export default function DashboardPage() {
  const router = useRouter()
  const [songs] = useState(DEMO_SONGS)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-success/10 text-success'
      case 'GENERATING':
        return 'bg-accent/10 text-accent'
      case 'FAILED':
        return 'bg-error/10 text-error'
      default:
        return 'bg-text-muted/10 text-text-muted'
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
              onClick={() => router.push('/generate')}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
              D
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Your Music</h1>
            <p className="text-text-secondary">Create, manage, and share your AI-generated songs</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-surface border border-border">
              <p className="text-2xl font-bold text-foreground">{songs.filter(s => s.status === 'COMPLETED').length}</p>
              <p className="text-sm text-text-secondary">Total Songs</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <p className="text-2xl font-bold text-foreground">
                {songs.filter(s => s.status === 'COMPLETED' && s.duration).reduce((acc, s) => {
                  const [mins, secs] = (s.duration || '0:00').split(':').map(Number)
                  return acc + mins * 60 + secs
                }, 0) || 0}
              </p>
              <p className="text-sm text-text-secondary">Total Minutes</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <p className="text-2xl font-bold text-foreground">3</p>
              <p className="text-sm text-text-secondary">Daily Remaining</p>
            </div>
          </div>

          {/* Songs List */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Songs</h2>

            {songs.length === 0 ? (
              <div className="p-12 rounded-2xl bg-surface border border-border text-center">
                <Music className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
                <p className="text-text-secondary mb-6">Create your first AI-generated song</p>
                <Link
                  href="/generate"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Song
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {songs.map(song => (
                  <div
                    key={song.id}
                    className="p-4 rounded-xl bg-surface border border-border hover:border-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Play Button / Status */}
                      <div className="relative">
                        {song.status === 'COMPLETED' ? (
                          <button className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors">
                            <Play className="w-5 h-5 ml-0.5" />
                          </button>
                        ) : song.status === 'GENERATING' ? (
                          <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center">
                            <span className="text-sm">!</span>
                          </div>
                        )}

                        {/* Progress ring for generating */}
                        {song.status === 'GENERATING' && song.progress !== undefined && (
                          <svg className="absolute inset-0 w-12 h-12 -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-accent/30"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 22}`}
                              strokeDashoffset={`${2 * Math.PI * 22 * (1 - song.progress / 100)}`}
                              className="text-accent"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{song.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-text-secondary">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(song.status)}`}>
                            {song.status === 'COMPLETED' ? 'Ready' :
                             song.status === 'GENERATING' ? `${song.progress}%` : 'Failed'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {song.createdAt}
                          </span>
                          {song.duration && (
                            <span>{song.duration}</span>
                          )}
                          {song.genre && (
                            <span>{song.genre.join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {song.status === 'COMPLETED' && (
                          <>
                            <button className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                              <Download className="w-4 h-4" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button className="p-2 rounded-lg hover:bg-background text-text-secondary hover:text-foreground transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
