import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ email: '', password: '', username: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

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
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-neutral-800/80 p-1 mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
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
