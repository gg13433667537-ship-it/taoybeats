"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Music, Loader2, Play, Pause, Download, Share2, Copy, Check, AlertCircle, RefreshCw } from "lucide-react"

// Genre options
const GENRES = [
  "Pop", "Hip-Hop", "Rock", "Electronic", "R&B", "Jazz",
  "Classical", "Country", "Reggae", "Folk", "Metal", "Indie"
]

// Mood options
const MOODS = [
  "Happy", "Sad", "Energetic", "Calm", "Romantic", "Epic", "Dark", "Dreamy"
]

// Instrument options
const INSTRUMENTS = [
  "Guitar", "Piano", "Drum", "Bass", "Synth", "Strings", "Brass", "Vocals"
]

type GenerationStage = 'idle' | 'initializing' | 'generating' | 'finalizing' | 'completed' | 'failed'

export default function GeneratePage() {
  const router = useRouter()

  // Form state
  const [apiUrl, setApiUrl] = useState("https://api.minimax.chat")
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState("minimax")
  const [title, setTitle] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [mood, setMood] = useState("")
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [referenceSinger, setReferenceSinger] = useState("")
  const [referenceSong, setReferenceSong] = useState("")
  const [userNotes, setUserNotes] = useState("")

  // Generation state
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle')
  const [progress, setProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [copied, setCopied] = useState(false)

  // Handle genre toggle
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  // Handle instrument toggle
  const toggleInstrument = (instrument: string) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument) ? prev.filter(i => i !== instrument) : [...prev, instrument]
    )
  }

  // Handle generation
  const handleGenerate = async () => {
    if (!apiKey || !title || !lyrics || selectedGenres.length === 0 || !mood) {
      setError("Please fill in all required fields (API Key, Title, Lyrics, Genre, Mood)")
      return
    }

    setError(null)
    setGenerationStage('initializing')
    setProgress(0)
    setAudioUrl(null)

    try {
      // Step 1: Create song record via API
      const createResponse = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          lyrics,
          genre: selectedGenres,
          mood,
          instruments: selectedInstruments,
          referenceSinger,
          referenceSong,
          userNotes,
          apiKey,
          apiUrl: apiUrl || 'https://api.minimax.chat',
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        if (createResponse.status === 429) {
          throw new Error(errorData.message || 'Daily or monthly limit reached. Please upgrade to Pro for more generations.')
        }
        throw new Error(errorData.error || 'Failed to create song')
      }

      const { id: songId } = await createResponse.json()

      // Step 2: Connect to SSE stream for progress updates
      const eventSource = new EventSource(`/api/songs/${songId}/stream`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setProgress(data.progress)

        switch (data.stage) {
          case 'initializing':
            setGenerationStage('initializing')
            break
          case 'generating_melody':
          case 'generating_lyrics':
          case 'rendering_audio':
            setGenerationStage('generating')
            break
          case 'finalizing':
            setGenerationStage('finalizing')
            break
          case 'completed':
            setGenerationStage('completed')
            if (data.audioUrl) {
              setAudioUrl(data.audioUrl)
            }
            eventSource.close()
            break
        }
      }

      eventSource.onerror = () => {
        setGenerationStage('failed')
        setError('Connection lost. Please try again.')
        eventSource.close()
      }
    } catch (err) {
      setGenerationStage('failed')
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  // Handle download
  const handleDownload = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank')
    }
  }

  // Handle share
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/song/${Date.now()}`
    if (navigator.share) {
      await navigator.share({
        title: title,
        text: `Check out my song "${title}" on TaoyBeats!`,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Handle reset
  const handleReset = () => {
    setTitle("")
    setLyrics("")
    setSelectedGenres([])
    setMood("")
    setSelectedInstruments([])
    setReferenceSinger("")
    setReferenceSong("")
    setUserNotes("")
    setGenerationStage('idle')
    setProgress(0)
    setAudioUrl(null)
    setError(null)
    router.replace('/generate')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </button>
          <nav className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Create New Song
              </h1>
              <p className="text-text-secondary">
                Fill in the details below to generate your AI music
              </p>
            </div>
            {generationStage === 'completed' && (
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-border hover:border-accent text-foreground text-sm font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Create Another
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* API Configuration */}
              <section className="p-6 rounded-2xl bg-surface border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">API Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="minimax">MiniMax</option>
                      <option value="suno">Suno</option>
                      <option value="udio">Udio</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      API URL <span className="text-error">*</span>
                    </label>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.minimax.chat"
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      API Key <span className="text-error">*</span>
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </section>

              {/* Song Details */}
              <section className="p-6 rounded-2xl bg-surface border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Song Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Song Title <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="My Awesome Song"
                      maxLength={100}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Lyrics <span className="text-error">*</span>
                    </label>
                    <textarea
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder="Paste your lyrics here..."
                      rows={6}
                      maxLength={5000}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    />
                    <p className="mt-1 text-xs text-text-muted">{lyrics.length}/5000 characters</p>
                  </div>

                  {/* Genre */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Genre <span className="text-error">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(genre => (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedGenres.includes(genre)
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Mood <span className="text-error">*</span>
                    </label>
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="">Select mood...</option>
                      {MOODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Instruments */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Instruments
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INSTRUMENTS.map(instrument => (
                        <button
                          key={instrument}
                          onClick={() => toggleInstrument(instrument)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedInstruments.includes(instrument)
                              ? 'bg-accent text-white'
                              : 'bg-background border border-border text-text-secondary hover:border-accent'
                          }`}
                        >
                          {instrument}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Reference Singer
                      </label>
                      <input
                        type="text"
                        value={referenceSinger}
                        onChange={(e) => setReferenceSinger(e.target.value)}
                        placeholder="e.g., Taylor Swift"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Reference Song
                      </label>
                      <input
                        type="text"
                        value={referenceSong}
                        onChange={(e) => setReferenceSong(e.target.value)}
                        placeholder="e.g., Shape of You"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* User Notes */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Your Notes <span className="text-text-muted">(private)</span>
                    </label>
                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="What is this song about? Any specific feelings or ideas you want to convey?"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generationStage !== 'idle' && generationStage !== 'completed' && generationStage !== 'failed'}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generationStage !== 'idle' && generationStage !== 'completed' && generationStage !== 'failed' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5" />
                    Generate Song
                  </>
                )}
              </button>

              {generationStage === 'failed' && (
                <button
                  onClick={handleGenerate}
                  className="w-full py-4 rounded-xl border border-error text-error font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
              )}
            </div>

            {/* Right Column - Preview & Progress */}
            <div className="space-y-6">
              {/* Progress */}
              {generationStage !== 'idle' && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Generation Progress</h2>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-accent-glow transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-text-secondary text-right">{progress}%</p>
                  </div>

                  {/* Stage */}
                  <div className="flex items-center gap-3">
                    {generationStage === 'completed' ? (
                      <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : generationStage === 'failed' ? (
                      <div className="w-10 h-10 rounded-full bg-error flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground capitalize">
                        {generationStage === 'completed' ? 'Generation Complete!' :
                         generationStage === 'failed' ? 'Generation Failed' :
                         generationStage === 'initializing' ? 'Initializing...' :
                         generationStage === 'generating' ? 'Creating Music...' :
                         'Finalizing...'}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {generationStage === 'completed' ? 'Your song is ready!' :
                         generationStage === 'failed' ? 'Please try again' :
                         generationStage === 'initializing' ? 'Setting up...' :
                         generationStage === 'generating' ? `${progress}% complete` :
                         'Almost done...'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Audio Player */}
              {audioUrl && (
                <section className="p-6 rounded-2xl bg-surface border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>

                  {/* Waveform placeholder */}
                  <div className="h-24 rounded-xl bg-background mb-4 flex items-center justify-center overflow-hidden">
                    <div className="flex items-end gap-1 h-16 px-4">
                      {Array.from({ length: 50 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-accent rounded-full transition-all duration-300"
                          style={{
                            height: `${Math.sin(i * 0.3) * 30 + Math.random() * 50 + 20}%`,
                            opacity: isPlaying ? (i < 25 ? 1 : 0.4) : 0.6
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                    <div className="flex-1">
                      <div className="h-1 rounded-full bg-border">
                        <div className="h-full w-1/3 bg-accent rounded-full" />
                      </div>
                      <p className="mt-1 text-xs text-text-muted">0:00 / 3:24</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-3 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 py-3 rounded-xl border border-border hover:border-accent text-foreground font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Share'}
                    </button>
                  </div>
                </section>
              )}

              {/* Tips */}
              <section className="p-6 rounded-2xl bg-surface border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Tips for Better Results</h2>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Use specific and descriptive lyrics for better AI understanding
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Matching mood and genre creates more coherent songs
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Adding reference artists helps shape the style
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Generation usually takes 2-5 minutes depending on complexity
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
