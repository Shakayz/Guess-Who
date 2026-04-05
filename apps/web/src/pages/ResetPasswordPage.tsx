import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'

const log = createLogger('reset-password')

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    log.info('reset-password attempt')
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      log.info('reset-password success')
      setTimeout(() => navigate('/auth'), 3000)
    } catch (err: any) {
      log.warn('reset-password failed', { error: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-5 shadow-xl shadow-brand-600/30">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t('auth.resetPassword')}</h1>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl">
          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/50 mb-4">
                <span className="text-xl">✓</span>
              </div>
              <p className="text-emerald-400 text-sm font-medium">{t('auth.passwordReset')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                className="input-field"
                type="password"
                placeholder={t('auth.newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                autoFocus
              />
              <input
                className="input-field"
                type="password"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 text-sm">
                  <span className="shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="mt-1 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white font-semibold transition-all duration-150 shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {t('common.loading')}
                  </span>
                ) : (
                  t('auth.resetPassword')
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back to login */}
        <p className="text-center text-neutral-600 text-xs mt-6">
          <Link
            to="/auth"
            className="text-brand-500 hover:text-brand-400 transition-colors font-medium"
          >
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
