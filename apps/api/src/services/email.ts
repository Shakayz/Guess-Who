import pino from 'pino'
import { env } from '../config/env'

const logger = pino({ name: 'email-service' })

const EMAIL_HTML = (code: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="font-size:28px;font-weight:800;color:#fff;background:#7c3aed;padding:16px 24px;border-radius:12px;text-align:center;margin:0 0 24px">
    🎭 Imposter Game
  </h1>
  <p style="font-size:16px;color:#374151">Your verification code:</p>
  <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#7c3aed;text-align:center;padding:20px;background:#f5f3ff;border-radius:12px;margin:16px 0">
    ${code}
  </div>
  <p style="font-size:14px;color:#6b7280">This code expires in <strong>15 minutes</strong>. If you didn't request this, ignore this email.</p>
</div>
`

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  // 1. Resend (preferred — no extra package, just fetch)
  if (env.RESEND_API_KEY) {
    logger.info({ to }, 'sending verification email via Resend')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Imposter Game <onboarding@resend.dev>',
        to,
        subject: 'Your Imposter Game verification code',
        html: EMAIL_HTML(code),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Resend error: ${JSON.stringify(err)}`)
    }
    return
  }

  // 2. SMTP via nodemailer (dynamic import — only if package installed)
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    logger.info({ to }, 'sending verification email via SMTP')
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Your Imposter Game verification code',
      html: EMAIL_HTML(code),
    })
    return
  }

  // 3. Dev fallback
  logger.info({ to, code }, 'verification email (dev fallback)')
}

const RESET_EMAIL_HTML = (resetLink: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="font-size:28px;font-weight:800;color:#fff;background:#7c3aed;padding:16px 24px;border-radius:12px;text-align:center;margin:0 0 24px">
    🎭 Imposter Game
  </h1>
  <p style="font-size:16px;color:#374151">You requested a password reset. Click the link below to set a new password:</p>
  <div style="text-align:center;margin:24px 0">
    <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px">
      Reset Password
    </a>
  </div>
  <p style="font-size:14px;color:#6b7280">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>
</div>
`

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetLink = `${env.APP_URL}/reset-password?token=${token}`

  // 1. Resend (preferred — no extra package, just fetch)
  if (env.RESEND_API_KEY) {
    logger.info({ to }, 'sending password reset email via Resend')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Imposter Game <onboarding@resend.dev>',
        to,
        subject: 'Reset your Imposter Game password',
        html: RESET_EMAIL_HTML(resetLink),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Resend error: ${JSON.stringify(err)}`)
    }
    return
  }

  // 2. SMTP via nodemailer (dynamic import — only if package installed)
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    logger.info({ to }, 'sending password reset email via SMTP')
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Reset your Imposter Game password',
      html: RESET_EMAIL_HTML(resetLink),
    })
    return
  }

  // 3. Dev fallback
  logger.info({ to, resetLink }, 'password reset email (dev fallback)')
}
