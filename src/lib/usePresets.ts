"use client"

import { useState, useEffect, useCallback } from "react"

export interface Preset {
  id: string
  userId?: string
  name: string
  genre: string[]
  mood: string
  instruments: string[]
  isInstrumental: boolean
  duration: number
  shareToken?: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'taoybeats-presets'
const MAX_PRESETS = 10

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Load presets from localStorage
  const loadLocalPresets = useCallback((): Preset[] => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  }, [])

  // Save presets to localStorage
  const saveLocalPresets = useCallback((presets: Preset[]) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  }, [])

  // Sync with server
  const syncWithServer = useCallback(async () => {
    setIsSyncing(true)
    try {
      const localPresets = loadLocalPresets()

      const response = await fetch('/api/presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPresets }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update local storage with merged presets
        saveLocalPresets(data.presets)
        setPresets(data.presets)
      }
    } catch (error) {
      console.error('Failed to sync presets:', error)
      // Fallback to local presets
      const localPresets = loadLocalPresets()
      setPresets(localPresets)
    } finally {
      setIsSyncing(false)
      setIsLoading(false)
    }
  }, [loadLocalPresets, saveLocalPresets])

  // Initial load and sync
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncWithServer()
  }, [syncWithServer])

  // Create preset
  const createPreset = useCallback(async (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      })

      if (response.status === 400 && (await response.json()).code === 'PRESET_LIMIT_REACHED') {
        return { success: false, error: `Maximum of ${MAX_PRESETS} presets reached` }
      }

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to create preset' }
      }

      const data = await response.json()
      const newPreset = data.preset

      // Update local state and storage
      setPresets(prev => {
        const updated = [...prev, newPreset]
        saveLocalPresets(updated)
        return updated
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to create preset:', error)
      return { success: false, error: 'Failed to create preset' }
    }
  }, [saveLocalPresets])

  // Delete preset
  const deletePreset = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/presets/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to delete preset' }
      }

      // Update local state and storage
      setPresets(prev => {
        const updated = prev.filter(p => p.id !== id)
        saveLocalPresets(updated)
        return updated
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to delete preset:', error)
      return { success: false, error: 'Failed to delete preset' }
    }
  }, [saveLocalPresets])

  // Share preset (generate share token)
  const sharePreset = useCallback(async (id: string): Promise<string | null> => {
    // Generate share token locally for now
    const shareToken = crypto.randomUUID().slice(0, 8)

    // Update server
    try {
      await fetch(`/api/presets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken }),
      })
    } catch (error) {
      console.error('Failed to share preset:', error)
    }

    return shareToken
  }, [])

  return {
    presets,
    isLoading,
    isSyncing,
    createPreset,
    deletePreset,
    sharePreset,
    syncWithServer,
    maxPresets: MAX_PRESETS,
  }
}
