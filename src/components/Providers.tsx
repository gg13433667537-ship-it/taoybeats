'use client'

import { I18nProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'
import ErrorBoundary from '@/components/ErrorBoundary'

export function Providers({ children, initialLang = 'en', initialTheme = 'dark' }: { children: React.ReactNode; initialLang?: 'en' | 'zh'; initialTheme?: 'dark' | 'light' }) {
  return (
    <ErrorBoundary>
      <ThemeProvider initialTheme={initialTheme}>
        <I18nProvider lang={initialLang}>{children}</I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
