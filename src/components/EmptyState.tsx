"use client"

import Link from "next/link"
import { Music, Plus } from "lucide-react"

interface EmptyStateProps {
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mb-6">
        <Music className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-text-secondary max-w-sm mb-6">{description}</p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
