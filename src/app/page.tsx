import Link from "next/link"
import { Music, Zap, Share2, Download } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/generate" className="text-sm text-text-secondary hover:text-foreground transition-colors">
              Generate
            </Link>
            <Link href="/pricing" className="text-sm text-text-secondary hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-text-secondary hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border mb-8">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm text-text-secondary">AI-Powered Music Generation</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight">
              Create Music with AI,<br />
              <span className="bg-gradient-to-r from-accent to-accent-glow bg-clip-text text-transparent">
                Share Your Sound
              </span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10">
              Configure your own AI music backend, write lyrics, choose styles and moods.
              Generate unique songs in minutes. Share and download with one click.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-lg font-semibold transition-all hover:shadow-lg hover:shadow-accent/25"
              >
                Start Creating Free
              </Link>
              <Link
                href="/generate"
                className="px-8 py-4 rounded-xl border border-border hover:border-accent text-foreground text-lg font-medium transition-colors"
              >
                Try Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-surface/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
              Everything You Need to Create
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <FeatureCard
                icon={<Music className="w-6 h-6" />}
                title="Customizable Generation"
                description="Configure your AI backend, choose genres, moods, and instruments. Full control over your music creation."
              />
              <FeatureCard
                icon={<Share2 className="w-6 h-6" />}
                title="Easy Sharing"
                description="Generate shareable links for your songs. Let friends and fans listen with a single click."
              />
              <FeatureCard
                icon={<Download className="w-6 h-6" />}
                title="Download Anywhere"
                description="Export your generated music as MP3 files. Use them anywhere you want."
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
              How It Works
            </h2>
            <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <StepCard step={1} title="Sign Up" description="Create your free account in seconds" />
              <StepCard step={2} title="Configure" description="Set up your AI music API" />
              <StepCard step={3} title="Generate" description="Write lyrics and create music" />
              <StepCard step={4} title="Share" description="Download and share your creation" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-b from-surface/50 to-transparent">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Create?
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              Join thousands of music creators using TaoyBeats to bring their ideas to life.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-lg font-semibold transition-all hover:shadow-lg hover:shadow-accent/25"
            >
              <Zap className="w-5 h-5" />
              Get Started for Free
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">TaoyBeats</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-text-secondary">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <span>© 2026 TaoyBeats. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-border hover:border-accent transition-colors">
      <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-accent text-white font-bold flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-text-secondary text-sm">{description}</p>
    </div>
  )
}
