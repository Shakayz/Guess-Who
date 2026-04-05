import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We manipulate env before importing the module, so we do a dynamic import
// inside each test group rather than a top-level static import.

const BASE_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
}

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    // Start from a clean env each time
    Object.assign(process.env, BASE_ENV)
    delete process.env.RESEND_API_KEY
    delete process.env.SMTP_HOST
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses Resend transport when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendVerificationEmail } = await import('@/services/email')
    await sendVerificationEmail('user@example.com', '123456')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.headers['Authorization']).toBe('Bearer test-resend-key')
    const body = JSON.parse(opts.body)
    expect(body.to).toBe('user@example.com')
    expect(body.html).toContain('123456')
  })

  it('throws when Resend returns a non-ok response', async () => {
    process.env.RESEND_API_KEY = 'bad-key'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Unauthorized' }),
    }))

    const { sendVerificationEmail } = await import('@/services/email')
    await expect(sendVerificationEmail('u@x.com', '999')).rejects.toThrow('Resend error')
  })

  it('falls back to pino logger when no transport is configured', async () => {
    const { sendVerificationEmail } = await import('@/services/email')
    // Should not throw — it logs via pino instead of sending
    await expect(sendVerificationEmail('dev@example.com', '654321')).resolves.toBeUndefined()
  })

  it('uses SMTP transport when SMTP credentials are set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_USER = 'user@example.com'
    process.env.SMTP_PASS = 'secret'

    const sendMailMock = vi.fn().mockResolvedValue({})
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock })

    vi.doMock('nodemailer', () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }))

    const { sendVerificationEmail } = await import('@/services/email')
    await sendVerificationEmail('smtp@example.com', '111222')

    expect(createTransportMock).toHaveBeenCalledOnce()
    expect(sendMailMock).toHaveBeenCalledOnce()
    const mailOpts = sendMailMock.mock.calls[0][0]
    expect(mailOpts.to).toBe('smtp@example.com')
    expect(mailOpts.html).toContain('111222')
  })
})
