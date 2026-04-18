"use client"

import { useState, useCallback } from "react"
import { Bookmark, BookmarkPlus, Trash2, Loader2, AlertCircle, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface Persona {
  id: string
  name: string
  description?: string
  voiceId?: string
  voiceName?: string
  referenceSinger?: string
  referenceSong?: string
  referenceAudio?: string
  vocalTone?: string
  vocalStyle?: string
  createdAt: string
  updatedAt: string
}

interface PersonaSelectorProps {
  onSelectPersona: (persona: Persona) => void
  currentVoiceId?: string
  currentReferenceSinger?: string
  currentReferenceSong?: string
}

export default function PersonaSelector({
  onSelectPersona,
  currentVoiceId,
  currentReferenceSinger,
  currentReferenceSong,
}: PersonaSelectorProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaDesc, setNewPersonaDesc] = useState('')

  const loadPersonas = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/personas')
      if (!response.ok) {
        throw new Error('Failed to load personas')
      }
      const data = await response.json()
      setPersonas(data.personas || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load personas')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleOpen = () => {
    setIsOpen(true)
    loadPersonas()
  }

  const handleSavePersona = async () => {
    if (!newPersonaName.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonaName,
          description: newPersonaDesc,
          voiceId: currentVoiceId,
          referenceSinger: currentReferenceSinger,
          referenceSong: currentReferenceSong,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save persona')
      }

      const data = await response.json()
      setPersonas(prev => [...prev, data.persona])
      setShowSaveModal(false)
      setNewPersonaName('')
      setNewPersonaDesc('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save persona')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePersona = async (personaId: string) => {
    if (!confirm('Delete this persona?')) return

    try {
      const response = await fetch(`/api/personas?id=${personaId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete persona')
      }

      setPersonas(prev => prev.filter(p => p.id !== personaId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete persona')
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-accent transition-colors"
          title="Voice Personas"
        >
          <Bookmark className="w-4 h-4 text-text-muted" />
          <span className="text-sm text-foreground">{t('personas') || 'Personas'}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-20">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{t('personas') || 'Voice Personas'}</span>
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  {t('savePersona') || 'Save'}
                </button>
              </div>

              <div className="p-2">
                {personas.length === 0 && !isLoading && (
                  <div className="p-6 text-center text-text-muted text-sm">
                    {t('noPersonas') || 'No saved personas'}
                  </div>
                )}

                {personas.map(persona => (
                  <div
                    key={persona.id}
                    className="p-3 rounded-lg hover:bg-surface-elevated transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          onSelectPersona(persona)
                          setIsOpen(false)
                        }}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-foreground">{persona.name}</p>
                        {persona.description && (
                          <p className="text-xs text-text-muted">{persona.description}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          {persona.referenceSinger && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted">
                              {persona.referenceSinger}
                            </span>
                          )}
                          {persona.voiceName && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              {persona.voiceName}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeletePersona(persona.id)}
                        className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Delete persona"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="p-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  </div>
                )}

                {error && (
                  <div className="p-4 flex items-center gap-2 text-error text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save Persona Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {t('savePersona') || 'Save Persona'}
                </h2>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('personaName') || 'Persona Name'} *
                </label>
                <input
                  type="text"
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                  placeholder="e.g., Soulful Male Vocal"
                  className="w-full px-4 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('description') || 'Description'}
                </label>
                <textarea
                  value={newPersonaDesc}
                  onChange={(e) => setNewPersonaDesc(e.target.value)}
                  placeholder={t('personaDescPlaceholder') || 'Optional description...'}
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated text-xs text-text-muted">
                <p>{t('willSave') || 'Will save:'}</p>
                <ul className="mt-1 space-y-0.5">
                  {currentVoiceId && <li>• Voice: {currentVoiceId}</li>}
                  {currentReferenceSinger && <li>• Reference: {currentReferenceSinger}</li>}
                  {currentReferenceSong && <li>• Song: {currentReferenceSong}</li>}
                  {!currentVoiceId && !currentReferenceSinger && !currentReferenceSong && (
                    <li>• No voice settings configured</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-xl border border-border text-text-secondary hover:bg-surface-elevated transition-colors"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSavePersona}
                disabled={!newPersonaName.trim() || isSaving}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  t('save') || 'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
