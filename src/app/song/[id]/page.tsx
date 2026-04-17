"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Music, Play, Pause, Download, Share2, Copy, Check, Loader2 } from "lucide-react"

export default function SongSharePage() {
  const params = useParams()
  const songId = params.id as string

  const [song, setSong] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Fetch song data
    const fetchSong = async () => {
      try {
        const res = await fetch(`/api/songs/${songId}`)
        if (res.ok) {
          const data = await res.json()
          setSong(data)
        }
      } catch (error) {
        console.error("Error fetching song:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSong()
  }, [songId])

  const handleShare = async () => {
    const shareUrl = window.location.href
    if (navigator.share) {
      await navigator.share({
        title: song?.title || "TaoyBeats Song",
        text: `Check out my song on TaoyBeats!`,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (song?.audioUrl) {
      window.open(song.audioUrl, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Song Not Found</h1>
          <p className="text-text-secondary mb-6">This song may have been removed or the link is invalid.</p>
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
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Create Your Own
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Song Card */}
          <div className="p-8 rounded-2xl bg-surface border border-border">
            {/* Title & Genre */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-3">{song.title}</h1>
              <div className="flex flex-wrap gap-2">
                {song.genre?.map((g: string) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm"
                  >
                    {g}
                  </span>
                ))}
                {song.mood && (
                  <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-secondary text-sm">
                    {song.mood}
                  </span>
                )}
              </div>
            </div>

            {/* Waveform Placeholder */}
            <div className="h-32 rounded-xl bg-background mb-6 flex items-center justify-center">
              <div className="flex items-end gap-1 h-20">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-accent rounded-full"
                    style={{
                      height: `${Math.sin(i * 0.3) * 30 + Math.random() * 50 + 20}%`,
                      opacity: isPlaying ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </button>
              <div className="flex-1">
                <div className="h-1 rounded-full bg-border">
                  <div className="h-full w-1/3 bg-accent rounded-full" />
                </div>
                <p className="mt-1 text-sm text-text-muted">0:00 / 3:24</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-3 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? "Copied!" : "Share"}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-text-secondary text-sm">
                Created with{" "}
                <Link href="/" className="text-accent hover:underline">
                  TaoyBeats
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
