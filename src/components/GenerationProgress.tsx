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

  // Waveform animation
  useEffect(() => {
    // Clear canvas when not generating
    if (stage !== 'generating' && stage !== 'finalizing' && stage !== 'initializing') {
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
        gradient.addColorStop(0, '#a855f7')
        gradient.addColorStop(1, '#ec4899')

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
  }, [stage])

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

  const getStageLabel = () => {
    switch (stage) {
      case 'initializing':
        return t('initializing')
      case 'generating':
        return t('creatingYourMusic')
      case 'finalizing':
        return t('almostDone')
      case 'completed':
        return t('complete')
      case 'failed':
        return t('generationFailed')
      default:
        return t('processing')
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-surface border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-4">{t('generationProgress')}</h2>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-3 rounded-full bg-background overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-glow transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-sm text-text-secondary">{stageMessage || getStageLabel()}</p>
          <p className="text-sm text-text-muted font-mono">{progress}%</p>
        </div>
      </div>

      {/* Waveform Visualization */}
      {stage !== 'completed' && stage !== 'failed' && (
        <div className="mb-6 p-4 rounded-xl bg-background">
          <canvas
            ref={canvasRef}
            width={400}
            height={60}
            className="w-full h-16"
          />
          <p className="text-xs text-text-muted text-center mt-2">
            {stage === 'initializing' && t('initializing')}
            {stage === 'generating' && t('creatingYourMusic')}
            {stage === 'finalizing' && t('almostDone')}
          </p>
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center gap-4">
        {getStatusIcon()}
        <div>
          <p className="font-medium text-foreground capitalize">
            {stage === 'completed' ? t('yourSongReady') :
             stage === 'failed' ? t('pleaseTryAgain') :
             getStageLabel()}
          </p>
          <p className="text-sm text-text-secondary">
            {stage === 'completed' && t('clickPlayToPreview')}
            {stage === 'failed' && (error || t('generationFailed'))}
            {stage === 'generating' && `${progress}% ${t('complete').toLowerCase()}`}
            {(stage === 'initializing' || stage === 'finalizing') && t('pleaseWait')}
          </p>
        </div>
      </div>

      {/* Tips during generation */}
      {stage === 'generating' && (
        <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-accent">Tip:</span> Generation usually takes 2-5 minutes depending on the complexity of your request.
          </p>
        </div>
      )}
    </div>
  )
}