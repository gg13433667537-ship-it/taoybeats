"use client"

import { Loader2 } from "lucide-react"

export default function GenerateLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading generator...</p>
      </div>
    </div>
  )
}
