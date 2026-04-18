import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    beforeSend(event) {
      // Filter out certain errors in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Sentry] Event captured:', event.event_id)
      }
      return event
    },
    ignoreErrors: [
      // Ignore network errors that are handled gracefully
      'Failed to fetch',
      'Network request failed',
      // Ignore browser extensions
      'Extension context invalidated',
    ],
  })
}

export default Sentry
