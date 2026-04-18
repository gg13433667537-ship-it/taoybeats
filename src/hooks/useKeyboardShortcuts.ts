"use client"

import { useEffect, useCallback } from "react"

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          event.preventDefault()
          shortcut.action()
          return
        }
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

// Common shortcut definitions
export const SHORTCUTS = {
  PLAY_PAUSE: (action: () => void) => ({
    key: " ",
    action,
    description: "Play/Pause",
  }),
  SHARE: (action: () => void) => ({
    key: "s",
    ctrl: true,
    action,
    description: "Share",
  }),
  DOWNLOAD: (action: () => void) => ({
    key: "d",
    ctrl: true,
    action,
    description: "Download",
  }),
  FULLSCREEN: (action: () => void) => ({
    key: "f",
    ctrl: true,
    action,
    description: "Fullscreen",
  }),
  MUTE: (action: () => void) => ({
    key: "m",
    ctrl: true,
    action,
    description: "Mute/Unmute",
  }),
  CLOSE_MODAL: (action: () => void) => ({
    key: "Escape",
    action,
    description: "Close modal",
  }),
} as const
