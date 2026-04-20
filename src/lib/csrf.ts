/**
 * CSRF token utilities for form protection
 * Uses Double Submit Cookie pattern
 */

const CSRF_COOKIE_NAME = "csrf-token"
const CSRF_HEADER_NAME = "x-csrf-token"

/**
 * Get the CSRF token from cookies
 */
export function getCSRFToken(): string | null {
  if (typeof document === "undefined") {
    return null
  }

  const cookies = document.cookie.split(";")
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=")
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Fetch CSRF token from the API and store in cookie
 * Call this on page load to ensure a fresh token is available
 */
export async function refreshCSRFToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/csrf")
    if (res.ok) {
      const data = await res.json()
      return data.csrfToken
    }
  } catch (error) {
    console.error("Failed to refresh CSRF token:", error)
  }
  return null
}

/**
 * Get headers with CSRF token included
 * Use this for all form submissions
 */
export function getHeadersWithCSRF(additionalHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  }

  const csrfToken = getCSRFToken()
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken
  }

  return headers
}

/**
 * Fetch with CSRF token automatically included
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCSRFToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }

  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken
  }

  return fetch(url, {
    ...options,
    headers,
  })
}