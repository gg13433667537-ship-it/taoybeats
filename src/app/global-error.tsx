"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error("Global error caught:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 text-center">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-destructive mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              {error.digest && (
                <span className="block mb-2 text-xs opacity-60">
                  Error ID: {error.digest}
                </span>
              )}
              We encountered an unexpected error. Please try again or return to the homepage.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Return home
            </Link>
          </div>

          {process.env.NODE_ENV === "development" && error.message && (
            <details className="mt-6 text-left">
              <summary className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  )
}
