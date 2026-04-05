import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'

const log = createLogger('auth-page')

const LANGUAGES = [
  { code: 'en', label: 'English', country: 'gb' },
  { code: 'fr', label: 'Français', country: 'fr' },
  { code: 'ar', label: 'العربية', country: 'sa' },
  { code: 'es', label: 'Español', country: 'es' },
  { code: 'it', label: 'Italiano', country: 'it' },
  { code: 'pt', label: 'Português', country: 'br' },
  { code: 'zh', label: '中文', country: 'cn' },
  { code: 'de', label: 'Deutsch', country: 'de' },
]

type Mode = 'signin' | 'signup'

type UsernameSetup = {
  setupToken: string
  suggestedUsername: string
}

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
    </svg>
  )
}

// ─── AuthPage ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ identifier: '', email: '', password: '', username: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [usernameSetup, setUsernameSetup] = useState<UsernameSetup | null>(null)
  const [chosenUsername, setChosenUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameLoading, setUsernameLoading] = useState(false)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    // Also update DB locale if already logged in (edge case: language switcher on auth page)
    api.patch('/users/me', { locale: code }).catch(() => {/* non-critical — user may not be logged in yet */})
  }

  const handleOAuthResponse = (data: { token?: string; user?: any; needsUsername?: boolean; setupToken?: string; suggestedUsername?: string }) => {
    if (data.needsUsername && data.setupToken && data.suggestedUsername) {
      setUsernameSetup({ setupToken: data.setupToken, suggestedUsername: data.suggestedUsername })
      setChosenUsername(data.suggestedUsername)
      return
    }
    if (data.token && data.user) {
      setAuth(data.token, data.user)
      window.location.replace('/')
    }
  }

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usernameSetup) return
    setUsernameError(null)
    setUsernameLoading(true)
    try {
      const data = await api.post<{ token: string; user: any }>('/auth/setup-username', {
        setupToken: usernameSetup.setupToken,
        username: chosenUsername,
      })
      setAuth(data.token, data.user)
      window.location.replace('/')
    } catch (err: any) {
      setUsernameError(err.message ?? 'Failed to set username')
    } finally {
      setUsernameLoading(false)
    }
  }

  // ── Google ──
  const handleGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) { setError('Google sign-in is not available yet. Please use email & password.'); return }
    log.info('google oauth attempt')
    setError(null)
    setOauthLoading('google')

    const triggerGoogleFlow = () => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response: any) => {
          if (response.error || !response.access_token) {
            setError('Google sign-in was cancelled or failed')
            setOauthLoading(null)
            return
          }
          try {
            const data = await api.post<any>('/auth/google/verify', { accessToken: response.access_token })
            handleOAuthResponse(data)
          } catch (err: any) {
            setError(err.message ?? 'Google sign-in failed')
          } finally {
            setOauthLoading(null)
          }
        },
      })
      client.requestAccessToken()
    }

    // If the GSI script isn't loaded yet, poll for up to 5 seconds then trigger
    if (window.google) {
      triggerGoogleFlow()
    } else {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (window.google) {
          clearInterval(interval)
          triggerGoogleFlow()
        } else if (attempts >= 50) {
          clearInterval(interval)
          setError('Google sign-in could not load. Please refresh the page and try again.')
          setOauthLoading(null)
        }
      }, 100)
    }
  }

  // ── Apple ──
  const handleApple = () => {
    if (!window.AppleID) { setError('Apple Sign-In is not available in this browser'); return }
    log.info('apple oauth attempt')
    setOauthLoading('apple')
    window.AppleID.auth.signIn()
      .then(async (res: any) => {
        const identityToken = res.authorization?.id_token
        const name = res.user?.name
          ? `${res.user.name.firstName ?? ''} ${res.user.name.lastName ?? ''}`.trim()
          : undefined
        const data = await api.post<any>('/auth/apple/verify', { identityToken, name })
        handleOAuthResponse(data)
      })
      .catch(() => setError('Apple sign-in was cancelled or failed'))
      .finally(() => setOauthLoading(null))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    log.info('auth attempt', { mode, identifier: mode === 'signin' ? form.identifier : form.username })
    try {
      const data = await api.post<{ token: string; user: any }>(
        mode === 'signin' ? '/auth/signin' : '/auth/signup',
        mode === 'signup'
          ? { username: form.username, email: form.email, password: form.password, locale: i18n.language }
          : { identifier: form.identifier, password: form.password },
      )
      log.info('auth success', { userId: data.user?.id, mode })
      setAuth(data.token, data.user)
      window.location.replace('/')
    } catch (err: any) {
      log.warn('auth failed', { mode, error: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Username setup screen (OAuth new user) ──
  if (usernameSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-5 shadow-xl shadow-brand-600/30">
              <span className="text-3xl">🎭</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Choose your username</h1>
            <p className="text-neutral-500 text-sm mt-1.5">This is how other players will see you</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl">
            <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">@</span>
                <input
                  className="input-field pl-8"
                  placeholder="username"
                  value={chosenUsername}
                  onChange={(e) => { setChosenUsername(e.target.value); setUsernameError(null) }}
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <p className="text-neutral-600 text-xs">3-20 characters — letters, numbers, underscores only</p>

              {usernameError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 text-sm">
                  <span className="shrink-0">⚠</span>
                  <span>{usernameError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={usernameLoading || chosenUsername.length < 3}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white font-semibold transition-all duration-150 shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {usernameLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Setting up...
                  </span>
                ) : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Language selector */}
        <div className="flex justify-center gap-1.5 flex-wrap mb-6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLangChange(lang.code)}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                i18n.language === lang.code
                  ? 'bg-brand-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white',
              ].join(' ')}
            >
              <img src={`https://flagcdn.com/w20/${lang.country}.png`} alt="" className="w-4 h-3 object-cover rounded-sm" />
              <span>{lang.label}</span>
            </button>
          ))}
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-5 shadow-xl shadow-brand-600/30">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Imposter Game</h1>
          <p className="text-neutral-500 text-sm mt-1.5">{t('home.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl space-y-4">

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => { setError(null); handleGoogle() }}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 active:scale-[0.98] text-neutral-900 font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <GoogleIcon />}
              {t('auth.continueWithGoogle')}
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
            <span className="text-neutral-600 text-xs font-medium">{t('common.or')}</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-neutral-800/80 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setForm({ identifier: '', email: '', password: '', username: '' }) }}
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
            {mode === 'signin' ? (
              <input
                className="input-field"
                type="text"
                placeholder="Email or username"
                value={form.identifier}
                onChange={update('identifier')}
                required
                autoComplete="username"
                autoCapitalize="none"
              />
            ) : (
              <input
                className="input-field"
                type="email"
                placeholder={t('auth.email')}
                value={form.email}
                onChange={update('email')}
                required
                autoComplete="email"
              />
            )}
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
