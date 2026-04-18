'use client'

import { I18nProvider, Language } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'

export function Providers({ children, initialLang = 'en', initialTheme = 'dark' }: { children: React.ReactNode; initialLang?: Language; initialTheme?: 'dark' | 'light' }) {
  return (
    <ErrorBoundary>
      <ThemeProvider initialTheme={initialTheme}>
        <I18nProvider lang={initialLang}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
