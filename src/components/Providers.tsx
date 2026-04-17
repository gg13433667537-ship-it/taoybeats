'use client'

import { I18nProvider } from '@/lib/i18n'

export function Providers({ children, initialLang = 'en' }: { children: React.ReactNode; initialLang?: 'en' | 'zh' }) {
  return <I18nProvider lang={initialLang}>{children}</I18nProvider>
}
