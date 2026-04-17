'use client'

import { useI18n, languages } from '@/lib/i18n'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-text-secondary" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as 'en' | 'zh')}
        className="bg-transparent text-sm text-text-secondary hover:text-foreground cursor-pointer focus:outline-none"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code} className="bg-surface text-foreground">
            {l.name}
          </option>
        ))}
      </select>
    </div>
  )
}
