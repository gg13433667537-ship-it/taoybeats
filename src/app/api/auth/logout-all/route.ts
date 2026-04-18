import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Clear the session token
    const response = NextResponse.json({ success: true })
    response.cookies.set("session-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })

    // Note: In a real application with proper session management,
    // you would invalidate all sessions for the user here.
    // For this MVP with base64-encoded tokens, clearing the current
    // session cookie is sufficient.

    return response
  } catch (error) {
    console.error("Logout all error:", error)
    return NextResponse.json({ error: "Failed to sign out" }, { status: 500 })
  }
}