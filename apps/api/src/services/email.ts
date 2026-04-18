import { env } from '../config/env'
import { childLogger } from '../config/logger'

const logger = childLogger('email-service')

const EMAIL_HTML = (code: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="font-size:28px;font-weight:800;color:#fff;background:#7c3aed;padding:16px 24px;border-radius:12px;text-align:center;margin:0 0 24px">
    🎭 Red Handed !
  </h1>
  <p style="font-size:16px;color:#374151">Your verification code:</p>
  <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#7c3aed;text-align:center;padding:20px;background:#f5f3ff;border-radius:12px;margin:16px 0">
    ${code}
  </div>
  <p style="font-size:14px;color:#6b7280">This code expires in <strong>15 minutes</strong>. If you didn't request this, ignore this email.</p>
</div>
`

export type SendEmailResult =
  | { transport: 'resend'; providerId: string }
  | { transport: 'smtp' }
  | { transport: 'dev' }

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly providerStatus: number,
    public readonly providerBody: unknown,
  ) {
    super(message)
    this.name = 'EmailProviderError'
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<SendEmailResult> {
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
        from: 'Red Handed ! <contact@redhanded-game.com>',
        to,
        subject: 'Your Red Handed ! verification code',
        html: EMAIL_HTML(code),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string; name?: string }
      const reason = body.message ?? body.name ?? 'Unknown error'
      logger.error({ status: res.status, body, to }, 'Resend verification email rejected')
      throw new EmailProviderError(`Resend error ${res.status}: ${reason}`, res.status, body)
    }
    const body = await res.json().catch(() => ({})) as { id?: string }
    const providerId = body.id ?? 'unknown'
    logger.info({ to, providerId }, 'Resend accepted verification email')
    return { transport: 'resend', providerId }
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
      subject: 'Your Red Handed ! verification code',
      html: EMAIL_HTML(code),
    })
    return { transport: 'smtp' }
  }

  // 3. No transport configured. In production this is a misconfiguration: the
  // UI would otherwise show "Code sent" while nothing is actually dispatched.
  // Fail loudly so the operator notices instead of silently eating the send.
  if (env.NODE_ENV === 'production') {
    logger.error({ to }, 'no email transport configured in production')
    throw new EmailProviderError(
      'Email service not configured on this server.',
      503,
      { reason: 'no-transport' },
    )
  }

  // Dev fallback — log the code so it can be used in local development.
  logger.info({ to, code }, 'verification email (dev fallback)')
  return { transport: 'dev' }
}

const RESET_EMAIL_HTML = (resetLink: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="font-size:28px;font-weight:800;color:#fff;background:#7c3aed;padding:16px 24px;border-radius:12px;text-align:center;margin:0 0 24px">
    🎭 Red Handed !
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

type SupportMessageParams = {
  fromEmail: string
  username: string
  userId: string
  subject: string
  message: string
}

const SUPPORT_EMAIL_HTML = ({ fromEmail, username, userId, subject, message }: SupportMessageParams) => {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
  <h1 style="font-size:20px;font-weight:800;color:#fff;background:#7c3aed;padding:12px 20px;border-radius:10px;margin:0 0 20px">
    🎭 Red Handed — Support
  </h1>
  <p style="font-size:14px;color:#374151;margin:0 0 4px"><strong>From:</strong> ${escape(username)} &lt;${escape(fromEmail)}&gt;</p>
  <p style="font-size:12px;color:#6b7280;margin:0 0 16px"><strong>User ID:</strong> ${escape(userId)}</p>
  <p style="font-size:14px;color:#374151;margin:0 0 4px"><strong>Subject:</strong> ${escape(subject)}</p>
  <div style="font-size:14px;color:#111827;background:#f5f3ff;padding:16px;border-radius:10px;white-space:pre-wrap;word-break:break-word">${escape(message)}</div>
</div>
`
}

export async function sendSupportMessage(params: SupportMessageParams): Promise<void> {
  const to = 'contact@redhanded-game.com'
  const subject = `[Support] ${params.subject}`
  const html = SUPPORT_EMAIL_HTML(params)
  const replyTo = params.fromEmail

  if (env.RESEND_API_KEY) {
    logger.info({ from: params.fromEmail, userId: params.userId }, 'sending support email via Resend')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Sending to contact@ via Resend: FROM must not also be contact@,
        // or PrivateEmail drops it on DMARC (mail appears self-spoofed).
        from: 'Red Handed ! <noreply@redhanded-game.com>',
        to,
        reply_to: replyTo,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Resend error: ${JSON.stringify(err)}`)
    }
    return
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    logger.info({ from: params.fromEmail, userId: params.userId }, 'sending support email via SMTP')
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
      replyTo,
      subject,
      html,
    })
    return
  }

  logger.info({ to, ...params }, 'support email (dev fallback)')
}

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
        from: 'Red Handed ! <contact@redhanded-game.com>',
        to,
        subject: 'Reset your Red Handed ! password',
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
      subject: 'Reset your Red Handed ! password',
      html: RESET_EMAIL_HTML(resetLink),
    })
    return
  }

  // 3. Dev fallback
  logger.info({ to, resetLink }, 'password reset email (dev fallback)')
}
