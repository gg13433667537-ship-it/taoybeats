'use client'

import { I18nProvider } from '@/lib/i18n'
import ErrorBoundary from '@/components/ErrorBoundary'

export function Providers({ children, initialLang = 'en' }: { children: React.ReactNode; initialLang?: 'en' | 'zh' }) {
  return (
    <ErrorBoundary>
      <I18nProvider lang={initialLang}>{children}</I18nProvider>
    </ErrorBoundary>
  )
}
