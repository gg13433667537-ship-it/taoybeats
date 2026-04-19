"use client"

import { useEffect, useRef } from "react"
import { Check, AlertCircle, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface GenerationProgressProps {
  stage: 'idle' | 'initializing' | 'generating' | 'finalizing' | 'completed' | 'failed'
  progress: number
  stageMessage?: string
  error?: string
}

export default function GenerationProgress({
  stage,
  progress,
  stageMessage,
  error,
}: GenerationProgressProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const isWaitingState = stage === 'initializing' || stage === 'generating' || stage === 'finalizing'
  const normalizedProgress = Math.max(0, Math.min(progress, 100))

  // Waveform animation
  useEffect(() => {
    // Clear canvas when not generating
    if (!isWaitingState) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = undefined
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0
    const animate = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const barCount = 32
      const barWidth = width / barCount - 2

      for (let i = 0; i < barCount; i++) {
        // Create wave effect with some randomness
        const baseHeight = Math.sin(phase + i * 0.3) * 0.3 + 0.5
        const randomFactor = Math.random() * 0.3
        const barHeight = (baseHeight + randomFactor) * height * 0.8

        const x = i * (barWidth + 2) + 1
        const y = (height - barHeight * 0.2) / 2

        // Gradient effect
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight * 0.2)
        if (stage === 'finalizing') {
          gradient.addColorStop(0, '#14b8a6')
          gradient.addColorStop(1, '#22c55e')
        } else if (stage === 'initializing') {
          gradient.addColorStop(0, '#6366f1')
          gradient.addColorStop(1, '#8b5cf6')
        } else {
          gradient.addColorStop(0, '#a855f7')
          gradient.addColorStop(1, '#ec4899')
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight * 0.2, 2)
        ctx.fill()
      }

      phase += 0.15
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isWaitingState, stage])

  const stageMeta = (() => {
    switch (stage) {
      case 'initializing':
        return {
          badge: t('queued'),
          title: t('queuedStageTitle'),
          description: stageMessage || t('queuedStageBody'),
        }
      case 'generating':
        return {
          badge: t('creatingMusic'),
          title: t('generatingStageTitle'),
          description: stageMessage || t('generatingStageBody'),
        }
      case 'finalizing':
        return {
          badge: t('almostDone'),
          title: t('finalizingStageTitle'),
          description: stageMessage || t('finalizingStageBody'),
        }
      case 'completed':
        return {
          badge: t('complete'),
          title: t('yourSongReady'),
          description: t('completedStageBody'),
        }
      case 'failed':
        return {
          badge: t('failed'),
          title: t('generationFailed'),
          description: error || t('failedStageBody'),
        }
      default:
        return {
          badge: t('processing'),
          title: t('generationProgress'),
          description: stageMessage || t('pleaseWait'),
        }
    }
  })()

  const milestones = [
    { key: 'queued', label: t('queued') },
    { key: 'generating', label: t('creatingMusic') },
    { key: 'finalizing', label: t('almostDone') },
  ] as const

  const getMilestoneState = (key: typeof milestones[number]['key']) => {
    if (stage === 'failed') return 'idle'
    if (stage === 'completed') return 'done'
    if (stage === 'initializing') return key === 'queued' ? 'active' : 'idle'
    if (stage === 'generating') {
      return key === 'queued' ? 'done' : key === 'generating' ? 'active' : 'idle'
    }
    if (stage === 'finalizing') {
      return key === 'finalizing' ? 'active' : 'done'
    }
    return 'idle'
  }

  const getStatusIcon = () => {
    switch (stage) {
      case 'completed':
        return (
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
          </div>
        )
      case 'failed':
        return (
          <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-error flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        )
      default:
        return (
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-surface">
      <div className="border-b border-border/80 bg-gradient-to-r from-accent/10 via-accent-glow/10 to-transparent px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {stageMeta.badge}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{stageMeta.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">{stageMeta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{t('generationProgress')}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{normalizedProgress}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="grid gap-2 sm:grid-cols-3">
          {milestones.map((milestone) => {
            const milestoneState = getMilestoneState(milestone.key)
            const stateClasses =
              milestoneState === 'done'
                ? 'border-success/30 bg-success/10 text-success'
                : milestoneState === 'active'
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-border bg-background/60 text-text-muted'

            return (
              <div
                key={milestone.key}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${stateClasses}`}
              >
                {milestone.label}
              </div>
            )
          })}
        </div>

        <div>
          <div className="h-3 overflow-hidden rounded-full bg-background">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-glow transition-all duration-500 ease-out"
              style={{ width: `${normalizedProgress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <p className="text-sm text-text-secondary">{stageMessage || stageMeta.description}</p>
            <p className="text-sm font-mono text-text-muted">{normalizedProgress}%</p>
          </div>
        </div>

        {isWaitingState && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={60}
              className="h-16 w-full"
            />
          </div>
        )}

        {stage === 'generating' && (
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-accent">{t('tipLabel')}</span> {t('tip4')}
            </p>
          </div>
        )}

        {stage === 'failed' && error && (
          <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
