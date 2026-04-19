"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Search, Check } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export interface SelectOption {
  value: string
  label: string
  group?: string
}

interface SelectorDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  options: SelectOption[]
  selectedValues: string[]
  onConfirm: (values: string[]) => void
  multiSelect?: boolean
  searchPlaceholder?: string
}

export default function SelectorDrawer({
  isOpen,
  onClose,
  title,
  options,
  selectedValues,
  onConfirm,
  multiSelect = true,
  searchPlaceholder,
}: SelectorDrawerProps) {
  const { t } = useI18n()
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [tempSelected, setTempSelected] = useState<string[]>(selectedValues)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const [translateY, setTranslateY] = useState(0)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)

  // Group options
  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || ""
    if (!acc[group]) acc[group] = []
    acc[group].push(option)
    return acc
  }, {} as Record<string, SelectOption[]>)

  // Filter options by search
  const filteredGroupedOptions = Object.entries(groupedOptions).reduce((acc, [group, opts]) => {
    const filtered = opts.filter(o =>
      o.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filtered.length > 0) acc[group] = filtered
    return acc
  }, {} as Record<string, SelectOption[]>)

  // Handle open/close animations
  useEffect(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true)
      setTempSelected(selectedValues)
      requestAnimationFrame(() => setIsAnimating(true))
    } else {
      if (!isVisible) return
      setIsAnimating(false)
      closeTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false)
        closeTimeoutRef.current = null
      }, 300)
    }
  }, [isOpen, isVisible, selectedValues])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  // Touch handlers for swipe to close on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return // Only on mobile
    startYRef.current = e.touches[0].clientY
    isDraggingRef.current = true
    setIsDragging(true)
    setTranslateY(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || window.innerWidth >= 640) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current
    // Only allow dragging down (positive diff)
    if (diff > 0) {
      setTranslateY(diff)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (window.innerWidth >= 640) return
    isDraggingRef.current = false
    setIsDragging(false)
    // If dragged more than 100px, close the drawer
    if (translateY > 100) {
      onClose()
    }
    setTranslateY(0)
  }, [translateY, onClose])

  const handleToggle = (value: string) => {
    if (multiSelect) {
      setTempSelected(prev =>
        prev.includes(value)
          ? prev.filter(v => v !== value)
          : [...prev, value]
      )
    } else {
      setTempSelected([value])
      // Single select auto-confirms
      onConfirm([value])
      onClose()
    }
  }

  const handleConfirm = () => {
    onConfirm(tempSelected)
    onClose()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`absolute bg-surface border border-border shadow-2xl transition-all duration-300 ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        } ${
          // Desktop: side drawer from right, Mobile: bottom drawer
          "w-full sm:w-[420px] sm:inset-y-0 sm:right-0 sm:left-auto sm:translate-x-0 sm:rounded-l-2xl bottom-0 sm:translate-y-0 rounded-t-2xl"
        }`}
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : undefined,
        }}
      >
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-sm text-text-muted">
              {tempSelected.length > 0
                ? `${t('selectedCount')} ${tempSelected.length}`
                : multiSelect ? t('multiple') : t('single')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder || t('searchPlaceholderShort')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Options */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {Object.entries(filteredGroupedOptions).map(([group, opts]) => (
            <div key={group} className="mb-4 last:mb-0">
              {group && (
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                  {group}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {opts.map((option) => {
                  const isSelected = tempSelected.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      data-testid={`selector-option-${option.value}`}
                      onClick={() => handleToggle(option.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-accent text-white"
                          : "bg-background border border-border text-text-secondary hover:border-accent"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                      <span className="truncate">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {Object.keys(filteredGroupedOptions).length === 0 && (
            <div className="text-center py-8 text-text-muted">
              {t('noResults')}
            </div>
          )}
        </div>

        {/* Footer - Confirm button */}
        <div className="px-6 py-4 border-t border-border bg-surface/80 backdrop-blur">
          <button
            data-testid="selector-confirm"
            onClick={handleConfirm}
            disabled={multiSelect && tempSelected.length === 0}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t('confirm')} ({tempSelected.length})
          </button>
        </div>
      </div>
    </div>
  )
}
