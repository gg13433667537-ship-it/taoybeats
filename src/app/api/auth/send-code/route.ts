import { NextRequest, NextResponse } from "next/server"
import { verificationCodes, generateCode } from "@/lib/auth-codes"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    // Generate code
    const code = generateCode()
    const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Store code
    verificationCodes.set(email, { code, expires })

    // In production, send email via Resend/SendGrid/etc.
    // For demo, we'll return the code in response (NOT SECURE - for testing only)
    console.log(`[DEV] Verification code for ${email}: ${code}`)

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      // REMOVE THIS IN PRODUCTION - only for testing
      devCode: code,
    })
  } catch (error) {
    console.error("Send code error:", error)
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    )
  }
}
