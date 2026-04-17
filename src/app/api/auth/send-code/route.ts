import { NextRequest, NextResponse } from "next/server"
import { createTransport } from "nodemailer"
import { verificationCodes, generateCode } from "@/lib/auth-codes"

async function sendVerificationEmail(email: string, code: string) {
  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT || "587")
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Development mode - return code in response
    console.log(`[DEV] Verification code for ${email}: ${code}`)
    return { success: true, devCode: code }
  }

  try {
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    await transporter.sendMail({
      from: `"TaoyBeats" <${smtpFrom}>`,
      to: email,
      subject: "Your TaoyBeats Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 20px; }
              .container { max-width: 480px; margin: 0 auto; background: #111; border-radius: 16px; padding: 40px; border: 1px solid #222; }
              .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
              .title { font-size: 24px; font-weight: bold; margin-bottom: 16px; }
              .text { color: #888; line-height: 1.6; margin-bottom: 30px; }
              .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #a855f7; background: #1a1a1a; padding: 20px 30px; border-radius: 12px; text-align: center; margin: 20px 0; }
              .footer { color: #555; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">TaoyBeats</div>
              <div class="title">Verification Code</div>
              <div class="text">
                Your verification code for signing in to TaoyBeats is:
              </div>
              <div class="code">${code}</div>
              <div class="text">
                This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
              </div>
              <div class="footer">
                © 2026 TaoyBeats. All rights reserved.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Your TaoyBeats verification code is: ${code}. This code will expire in 10 minutes.`,
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to send email:", error)
    return { success: false, error }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    // Check if email is valid (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      )
    }

    // Generate code
    const code = generateCode()
    const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Store code
    verificationCodes.set(email, { code, expires })

    // Send verification email
    const result = await sendVerificationEmail(email, code)

    if (!result.success && (process.env.SMTP_HOST || process.env.SMTP_USER)) {
      return NextResponse.json(
        { error: "Failed to send verification email. Please check SMTP configuration." },
        { status: 500 }
      )
    }

    // In development without SMTP, return the code for testing
    if (result.devCode) {
      return NextResponse.json({
        success: true,
        message: "Verification code sent (dev mode - check console)",
        devCode: result.devCode,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    })
  } catch (error) {
    console.error("Send code error:", error)
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    )
  }
}
