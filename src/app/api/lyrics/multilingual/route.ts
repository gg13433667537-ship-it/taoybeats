import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken } from "@/lib/auth-utils"


if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
if (!global.users) global.users = new Map()

function getSessionUser(request: NextRequest): { id: string; email: string; role: string } | null {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null
  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export type Language = 'en' | 'zh' | 'zh-TW' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar'

export interface MultilingualLyricsRequest {
  originalLyrics: string
  targetLanguages: Language[]
  preserveFormat?: boolean // Preserve [Verse], [Chorus] tags
  keepRhymes?: boolean // Try to maintain rhyme scheme
  styleMatch?: boolean // Match original style/tone
}

interface TranslatedLyrics {
  language: Language
  lyrics: string
  translatedTitle?: string
}

/**
 * Multilingual Lyrics Translation API
 *
 * Translates lyrics into multiple languages while preserving:
 * - Structure (verse, chorus tags)
 * - Rhyme scheme (when possible)
 * - Style and tone
 *
 * In production:
 * - Use a translation API (DeepL, Google Translate, OpenAI)
 * - Custom post-processing to preserve lyrics structure
 * - Human review step for quality assurance
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: MultilingualLyricsRequest = await request.json()
    const { originalLyrics, targetLanguages, preserveFormat = true, keepRhymes = true, styleMatch = true } = body

    if (!originalLyrics) {
      return NextResponse.json({ error: "originalLyrics is required" }, { status: 400 })
    }

    if (!targetLanguages || targetLanguages.length === 0) {
      return NextResponse.json({ error: "At least one target language is required" }, { status: 400 })
    }

    if (targetLanguages.length > 5) {
      return NextResponse.json({ error: "Maximum 5 languages allowed per request" }, { status: 400 })
    }

    // Check user tier
    const usersMap = global.users as Map<string, User>
    const userData = usersMap.get(user.id)
    const isPro = userData?.tier === 'PRO' || user.role === 'ADMIN'

    if (targetLanguages.length > 2 && !isPro) {
      return NextResponse.json(
        { error: "Free users can translate to up to 2 languages. Upgrade to Pro for up to 5." },
        { status: 403 }
      )
    }

    // In production, this would:
    // 1. Send lyrics to translation API for each target language
    // 2. Post-process to preserve structure tags
    // 3. Attempt to preserve rhyme scheme if requested
    // 4. Return all translations

    // Placeholder - simulate translations
    const languageNames: Record<Language, string> = {
      en: 'English',
      zh: 'Chinese',
      'zh-TW': 'Traditional Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ar: 'Arabic'
    }

    const translations: TranslatedLyrics[] = targetLanguages.map(lang => ({
      language: lang,
      lyrics: `[Translation to ${languageNames[lang]} - Placeholder]\n\n${originalLyrics}`,
      translatedTitle: undefined // Would be translated in production
    }))

    return NextResponse.json({
      success: true,
      originalLyrics,
      translations,
      options: {
        preserveFormat,
        keepRhymes,
        styleMatch
      },
      message: "Multilingual translation is a placeholder. Production would use translation API."
    })
  } catch (error) {
    console.error("Multilingual lyrics error:", error)
    return NextResponse.json({ error: "Failed to translate lyrics" }, { status: 500 })
  }
}
