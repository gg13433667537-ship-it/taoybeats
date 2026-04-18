import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/generate", "/settings"]

// Routes that require admin role
const adminRoutes = ["/admin"]

// Routes that redirect to dashboard if authenticated
const authRoutes = ["/login", "/register"]

// Lightweight role extraction for middleware (Edge Runtime compatible)
// Note: This only decodes the token without verifying the signature.
// Actual signature verification happens in API routes.
function getUserRole(token: string): string {
  try {
    const [payloadBase64] = token.split(".")
    if (!payloadBase64) return 'USER'
    const payload = JSON.parse(atob(payloadBase64))
    return payload?.role || 'USER'
  } catch {
    return 'USER'
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for auth token (JWT in cookie)
  const token = request.cookies.get("session-token")?.value
  const isAuthenticated = !!token
  const userRole = token ? getUserRole(token) : 'USER'

  // Admin routes - require ADMIN role
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Check if user is ADMIN
    if (userRole !== 'ADMIN') {
      // Not admin - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  // Protected routes - require authentication
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Auth routes (login/register) - redirect to dashboard if authenticated
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
