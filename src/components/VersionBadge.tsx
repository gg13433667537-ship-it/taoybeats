'use client'

import { GitCommit, Package } from 'lucide-react'

const VERSION = process.env.NEXT_PUBLIC_VERSION || '0.1.0'
const COMMIT = process.env.NEXT_PUBLIC_COMMIT || 'local'

export default function VersionBadge() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-text-muted">
      <span className="flex items-center gap-1">
        <Package className="w-3 h-3" />
        v{VERSION}
      </span>
      <span className="text-border">|</span>
      <span className="flex items-center gap-1">
        <GitCommit className="w-3 h-3" />
        {COMMIT.slice(0, 7)}
      </span>
    </div>
  )
}
