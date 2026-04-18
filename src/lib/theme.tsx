"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    // Sync with document class on mount
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(theme)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    // Save to cookie
    document.cookie = `taoybeats-theme=${newTheme}; path=/; max-age=31536000`
  }

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
