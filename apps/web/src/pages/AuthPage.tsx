import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'

type Mode = 'signin' | 'signup'

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.315 0-9.827-3.337-11.567-8H6.27A19.945 19.945 0 0 0 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.3-142.9-88.6c-43.3-59.1-79.4-154.4-79.4-244.8 0-152.5 99.6-232.9 197.2-232.9 55.9 0 102.3 36.7 137.3 36.7 33.4 0 85.7-38.9 150.1-38.9 24.7 0 108.2 2.6 168.6 75.4zm-133.5-177.1c-.6-.6-32.1-23.7-32.1-70.5 0-52.5 37.3-98.1 74.7-120.7 1.3-.6 45.4-26.3 79.4-26.3l2.6 2.6c-1.9 59.7-28.9 112.9-63.5 148.4-33.4 33.9-72.8 58.2-61.1 66.5z"/>
    </svg>
  )
}

// ─── AuthPage ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ email: '', password: '', username: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleOAuthSuccess = (data: { token: string; user: any }) => {
    setAuth(data.token, data.user)
    navigate('/')
  }

  // ── Google ──
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const data = await api.post<{ token: string; user: any }>('/auth/google/verify', {
          accessToken: tokenResponse.access_token,
        })
        handleOAuthSuccess(data)
      } catch (err: any) {
        setError(err.message ?? 'Google sign-in failed')
      } finally {
        setOauthLoading(null)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed')
      setOauthLoading(null)
    },
    flow: 'implicit',
  })

  // ── Apple ──
  const handleApple = () => {
    if (!window.AppleID) {
      setError('Apple Sign-In is not available in this browser')
      return
    }
    setOauthLoading('apple')
    window.AppleID.auth.signIn()
      .then(async (res: any) => {
        const identityToken = res.authorization?.id_token
        const name = res.user?.name
          ? `${res.user.name.firstName ?? ''} ${res.user.name.lastName ?? ''}`.trim()
          : undefined
        const data = await api.post<{ token: string; user: any }>('/auth/apple/verify', {
          identityToken,
          name,
        })
        handleOAuthSuccess(data)
      })
      .catch(() => setError('Apple sign-in was cancelled or failed'))
      .finally(() => setOauthLoading(null))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: any }>(
        mode === 'signin' ? '/auth/signin' : '/auth/signup',
        form,
      )
      setAuth(data.token, data.user)
      navigate('/')
    } catch (err: any) {
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
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Imposter Game</h1>
          <p className="text-neutral-500 text-sm mt-1.5">Deceive. Detect. Dominate.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl space-y-4">

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => { setError(null); setOauthLoading('google'); googleLogin() }}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 active:scale-[0.98] text-neutral-900 font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <GoogleIcon />}
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => { setError(null); handleApple() }}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-900 active:scale-[0.98] text-white font-semibold text-sm border border-neutral-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'apple' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <AppleIcon />}
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-600 text-xs font-medium">or</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-neutral-800/80 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={[
                  'flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150',
                  mode === m
                    ? 'bg-neutral-950 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300',
                ].join(' ')}
              >
                {m === 'signin' ? t('auth.signIn') : t('auth.signUp')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">@</span>
                <input
                  className="input-field pl-8"
                  placeholder={t('auth.username')}
                  value={form.username}
                  onChange={update('username')}
                  minLength={3}
                  maxLength={20}
                  required
                  autoComplete="username"
                />
              </div>
            )}
            <input
              className="input-field"
              type="email"
              placeholder={t('auth.email')}
              value={form.email}
              onChange={update('email')}
              required
              autoComplete="email"
            />
            <input
              className="input-field"
              type="password"
              placeholder={t('auth.password')}
              value={form.password}
              onChange={update('password')}
              minLength={mode === 'signup' ? 8 : undefined}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 text-sm">
                <span className="shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
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
                mode === 'signin' ? t('auth.signIn') : t('auth.signUp')
              )}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-neutral-600 text-xs mt-6">
          {mode === 'signin' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-brand-500 hover:text-brand-400 transition-colors font-medium"
          >
            {mode === 'signin' ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </p>
      </div>
    </div>
  )
}
