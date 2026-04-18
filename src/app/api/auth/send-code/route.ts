import { NextRequest, NextResponse } from "next/server"
import { createTransport } from "nodemailer"
import crypto from "crypto"
import { generateCode } from "@/lib/auth-codes"
import {
  rateLimitMiddleware,
  sanitizeEmail,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
  verifyCSRFToken,
  generateCSRFToken,
} from "@/lib/security"

function createVerifyToken(email: string, code: string): string {
  // Use CSRF secret for signing verification tokens
  const csrfSecret = process.env.CSRF_SECRET || process.env.AUTH_SECRET
  if (!csrfSecret) {
    throw new Error("CSRF_SECRET or AUTH_SECRET environment variable is required")
  }

  const payload = {
    email,
    code,
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes
  }
  const payloadStr = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadStr).toString("base64")
  const signature = crypto.createHmac("sha256", csrfSecret).update(payloadBase64).digest("hex")
  return `${payloadBase64}.${signature}`
}

async function sendVerificationEmail(email: string, code: string) {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT || "587")
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER

  if (!smtpHost || !smtpUser || !smtpPass) {
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
      subject: "【TaoyBeats】您的验证码",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
              .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; color: #a855f7; }
              .title { font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #1a1a1a; }
              .text { color: #666; line-height: 1.6; margin-bottom: 30px; }
              .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #a855f7; background: #f8f8f8; padding: 20px 30px; border-radius: 12px; text-align: center; margin: 20px 0; border: 2px dashed #a855f7; }
              .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">TaoyBeats</div>
              <div class="title">验证码</div>
              <div class="text">
                您好！您的 TaoyBeats 登录验证码是：
              </div>
              <div class="code">${code}</div>
              <div class="text">
                验证码将在 10 分钟内有效。请勿将验证码告诉他人。
              </div>
              <div class="footer">
                © 2026 TaoyBeats. 如果您没有请求此验证码，请忽略此邮件。
              </div>
            </div>
          </body>
        </html>
      `,
      text: `您的 TaoyBeats 验证码是：${code}，10分钟内有效。`,
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to send email:", error)
    return { success: false, error }
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting for send-code endpoint
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "send-code")
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const body = await request.json()
    const { email, csrfToken } = body

    // Validate CSRF token (use email as session identifier for non-authenticated endpoint)
    if (csrfToken && !verifyCSRFToken(csrfToken, email || "anonymous")) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
      )
    }

    // Input validation and sanitization
    const sanitizedEmail = sanitizeEmail(email)

    if (!sanitizedEmail) {
      // Use consistent timing to prevent email enumeration
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请输入有效的邮箱地址" },
          { status: 400 }
        )
      )
    }

    const code = generateCode()
    const token = createVerifyToken(sanitizedEmail, code)

    // Send verification email in background to prevent timing attacks
    // Always perform a small delay to normalize response time
    const sendPromise = sendVerificationEmail(sanitizedEmail, code)
    const delayPromise = new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))

    const [result] = await Promise.all([sendPromise, delayPromise])

    // Log failure but don't reveal specifics to user (prevents enumeration)
    if (!result.success && process.env.SMTP_HOST) {
      console.error(`[SendCode] Email send failed for ${sanitizedEmail}:`, result.error)
      // Return success anyway to prevent email enumeration
      // The user won't be able to verify without a valid code
    }

    // Set token in HTTP-only cookie (secure, prevents XSS)
    const response = NextResponse.json({
      success: true,
      message: result.devCode ? "验证码已生成（开发模式）" : "验证码已发送到您的邮箱",
    })

    response.cookies.set("verify-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60, // 10 minutes
      path: "/",
    })

    // In dev mode, return the code in a separate cookie for convenience
    // This is httpOnly for safety even in dev, but logged to console
    if (result.devCode) {
      console.log(`[DEV] Verification code for ${sanitizedEmail}: ${code}`)
      response.cookies.set("dev-code", code, {
        httpOnly: true, // Keep httpOnly even in dev for security best practices
        secure: false,
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      })
    }

    // Also generate a CSRF token for the verification step
    response.cookies.set("csrf-token", generateCSRFToken(sanitizedEmail), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60, // 10 minutes
      path: "/",
    })

    return applySecurityHeaders(response)
  } catch (error) {
    console.error("Send code error:", error)
    // Use consistent error message to prevent enumeration
    return applySecurityHeaders(
      NextResponse.json(
        { error: "发送验证码失败" },
        { status: 500 }
      )
    )
  }
}
