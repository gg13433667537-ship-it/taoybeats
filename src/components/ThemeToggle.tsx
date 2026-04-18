"use client"

import { useTheme } from "@/lib/theme"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-foreground transition-colors"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5" aria-hidden="true" />
      )}
    </button>
  )
}
