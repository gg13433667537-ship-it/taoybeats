import type { MiniMaxModel } from "@/lib/ai-providers"

const DEFAULT_LYRICS_LIMIT = 3500
const COVER_LYRICS_LIMIT = 1000
const ELLIPSIS = "..."

type LyricsPreparationParams = {
  lyrics?: string
  model?: MiniMaxModel
  isInstrumental?: boolean
}

export type PreparedLyrics = {
  lyrics: string
  applied: boolean
  originalLyrics?: string
  reason: "lyrics_over_model_limit" | null
  originalLength: number
  compressedLength: number
  maxLength: number
  model: MiniMaxModel
}

export function getLyricsLimitForModel(
  model: MiniMaxModel = "music-2.6",
  isInstrumental = false
): number {
  if (isInstrumental) {
    return DEFAULT_LYRICS_LIMIT
  }

  if (model === "music-cover") {
    return COVER_LYRICS_LIMIT
  }

  return DEFAULT_LYRICS_LIMIT
}

function normalizeLyrics(lyrics?: string): string {
  if (!lyrics) {
    return ""
  }

  return lyrics.replace(/\r\n/g, "\n").trim()
}

function trimToLimitByLine(lyrics: string, maxLength: number): string {
  const lines = lyrics.split("\n")
  const acceptedLines: string[] = []

  for (const line of lines) {
    const nextLyrics = acceptedLines.length === 0 ? line : `${acceptedLines.join("\n")}\n${line}`
    if (nextLyrics.length <= maxLength) {
      acceptedLines.push(line)
      continue
    }

    if (acceptedLines.length === 0) {
      if (maxLength <= ELLIPSIS.length) {
        return lyrics.slice(0, maxLength)
      }

      return `${line.slice(0, maxLength - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`
    }

    break
  }

  let trimmed = acceptedLines.join("\n").trimEnd()
  if (!trimmed) {
    trimmed = lyrics.slice(0, maxLength).trimEnd()
  }

  if (trimmed.length > maxLength) {
    trimmed = trimmed.slice(0, maxLength).trimEnd()
  }

  if (trimmed.length < lyrics.length && trimmed.length <= maxLength - ELLIPSIS.length) {
    trimmed = `${trimmed}${ELLIPSIS}`
  }

  return trimmed
}

export function prepareLyricsForModel({
  lyrics,
  model = "music-2.6",
  isInstrumental = false,
}: LyricsPreparationParams): PreparedLyrics {
  const normalizedLyrics = normalizeLyrics(lyrics)
  const maxLength = getLyricsLimitForModel(model, isInstrumental)

  if (!normalizedLyrics) {
    return {
      lyrics: "",
      applied: false,
      originalLength: 0,
      compressedLength: 0,
      maxLength,
      reason: null,
      model,
    }
  }

  if (normalizedLyrics.length <= maxLength) {
    return {
      lyrics: normalizedLyrics,
      applied: false,
      originalLength: normalizedLyrics.length,
      compressedLength: normalizedLyrics.length,
      maxLength,
      reason: null,
      model,
    }
  }

  const compressedLyrics = trimToLimitByLine(normalizedLyrics, maxLength)

  return {
    lyrics: compressedLyrics,
    applied: true,
    originalLyrics: normalizedLyrics,
    originalLength: normalizedLyrics.length,
    compressedLength: compressedLyrics.length,
    maxLength,
    reason: "lyrics_over_model_limit",
    model,
  }
}
