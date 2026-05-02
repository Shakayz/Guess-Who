import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import { MusicManager } from '../lib/music'
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
  { code: 'ru', label: 'Русский', country: 'ru' },
  { code: 'hi', label: 'हिन्दी', country: 'in' },
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

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  )
}

// ─── AuthPage ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ identifier: '', email: '', password: '', username: '', referralCode: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | 'discord' | null>(null)
  const [usernameSetup, setUsernameSetup] = useState<UsernameSetup | null>(null)
  const [chosenUsername, setChosenUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(() => MusicManager.isEnabled())

  const toggleMusic = () => {
    const next = !MusicManager.isEnabled()
    MusicManager.setEnabled(next)
    if (next) MusicManager.play()
    setMusicEnabled(next)
  }

  // Pre-fill the referral code from `?invite=CODE` in the URL so share links
  // work without the new user having to type anything. Also switch to the
  // signup tab — an invitee landing here wants to create an account, not
  // sign into one they don't have yet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')?.trim().toUpperCase() ?? ''
    if (invite) {
      setForm((f) => ({ ...f, referralCode: invite }))
      setMode('signup')
    }
  }, [])

  // Discord OAuth callback. Discord redirects the user back to
  // <origin>/auth/discord/callback?code=...; AuthPage is mounted on that
  // route (see App.tsx) so we pick up the code, exchange it server-side,
  // and clean the URL so a refresh doesn't re-run the exchange.
  useEffect(() => {
    if (!window.location.pathname.startsWith('/auth/discord/callback')) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const oauthError = params.get('error')
    if (oauthError) {
      setError(t('auth.errors.discordOauthError', { reason: oauthError, defaultValue: `Discord sign-in failed: ${oauthError}` }))
      window.history.replaceState({}, '', '/auth')
      return
    }
    if (!code) return
    const redirectUri = `${window.location.origin}/auth/discord/callback`
    setOauthLoading('discord')
    api.post<any>('/auth/discord/verify', { code, redirectUri, locale: i18n.language })
      .then((data) => {
        window.history.replaceState({}, '', '/auth')
        handleOAuthResponse(data)
      })
      .catch((err: any) => {
        log.error('discord verify failed', { message: err?.message })
        setError(err?.message ?? t('auth.errors.discordVerifyFailed', 'Discord sign-in failed'))
        window.history.replaceState({}, '', '/auth')
      })
      .finally(() => setOauthLoading(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const setupBody: Record<string, unknown> = {
        setupToken: usernameSetup.setupToken,
        username: chosenUsername,
      }
      const trimmedCode = form.referralCode.trim().toUpperCase()
      if (trimmedCode) setupBody.referralCode = trimmedCode

      const data = await api.post<{ token: string; user: any }>('/auth/setup-username', setupBody)
      setAuth(data.token, data.user)
      window.location.replace('/')
    } catch (err: any) {
      setUsernameError(err.message ?? t('auth.errors.failedToSetUsername', 'Failed to set username'))
    } finally {
      setUsernameLoading(false)
    }
  }

  // ── Google ──
  const handleGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) { setError(t('auth.errors.googleUnavailable', 'Google sign-in is not available yet. Please use email & password.')); return }
    log.info('google oauth attempt')
    setError(null)
    setOauthLoading('google')

    const triggerGoogleFlow = () => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response: any) => {
          if (response.error || !response.access_token) {
            setError(t('auth.errors.googleCancelledOrFailed', 'Google sign-in was cancelled or failed'))
            setOauthLoading(null)
            return
          }
          try {
            const data = await api.post<any>('/auth/google/verify', { accessToken: response.access_token, locale: i18n.language })
            handleOAuthResponse(data)
          } catch (err: any) {
            setError(err.message ?? t('auth.errors.googleSignInFailed', 'Google sign-in failed'))
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
          setError(t('auth.errors.googleCouldNotLoad', 'Google sign-in could not load. Please refresh the page and try again.'))
          setOauthLoading(null)
        }
      }, 100)
    }
  }

  // ── Apple ──
  const handleApple = () => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID
    if (!clientId) {
      setError(t('auth.errors.appleUnavailable', 'Apple sign-in is not available yet. Please use email & password.'))
      return
    }
    log.info('apple oauth attempt')
    setError(null)
    setOauthLoading('apple')

    const triggerAppleFlow = () => {
      try {
        // Configure at runtime so the redirect URI tracks the current origin
        // (prod vs staging vs preview) instead of being hardcoded in the HTML.
        window.AppleID!.auth.init({
          clientId,
          scope: 'name email',
          redirectURI: `${window.location.origin}/api/auth/apple/callback`,
          usePopup: true,
        })
      } catch (err) {
        log.error('apple init failed', { err: err instanceof Error ? err.message : String(err) })
      }

      window.AppleID!.auth.signIn()
        .then(async (res) => {
          const identityToken = res.authorization?.id_token
          const name = res.user?.name
            ? `${res.user.name.firstName ?? ''} ${res.user.name.lastName ?? ''}`.trim()
            : undefined
          const data = await api.post<any>('/auth/apple/verify', { identityToken, name, locale: i18n.language })
          handleOAuthResponse(data)
        })
        .catch((err: AppleIDSignInError | Error | undefined) => {
          const appleErr = !(err instanceof Error) ? (err as AppleIDSignInError | undefined) : undefined
          const reason = appleErr?.error
          const details = appleErr?.details
          const message = err instanceof Error ? err.message : undefined
          log.error('apple sign-in failed', { reason, details, message })
          if (reason === 'popup_closed_by_user') {
            setError(t('auth.errors.appleCancelled', 'Apple sign-in was cancelled.'))
          } else if (reason) {
            setError(t('auth.errors.appleFailedWithReason', { reason: `${reason}${details ? ` (${details})` : ''}`, defaultValue: `Apple sign-in failed: ${reason}${details ? ` (${details})` : ''}` }))
          } else if (message) {
            setError(t('auth.errors.appleFailedWithReason', { reason: message, defaultValue: `Apple sign-in failed: ${message}` }))
          } else {
            setError(t('auth.errors.appleFailedConsole', 'Apple sign-in failed. Check the browser console for details.'))
          }
        })
        .finally(() => setOauthLoading(null))
    }

    // Apple's SDK script is async — if the user clicks before it loads, poll briefly.
    if (window.AppleID) {
      triggerAppleFlow()
    } else {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (window.AppleID) {
          clearInterval(interval)
          triggerAppleFlow()
        } else if (attempts >= 50) {
          clearInterval(interval)
          setError(t('auth.errors.appleCouldNotLoad', 'Apple Sign-In could not load. Please refresh the page and try again.'))
          setOauthLoading(null)
        }
      }, 100)
    }
  }

  // ── Discord ──
  // Plain authorization-code redirect — no JS SDK. We bounce the user to
  // Discord's consent page; Discord sends them back to
  // <origin>/auth/discord/callback?code=..., where the useEffect above
  // picks up the code and POSTs it to /auth/discord/verify.
  const handleDiscord = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
    if (!clientId) {
      setError(t('auth.errors.discordUnavailable', 'Discord sign-in is not available yet. Please use email & password.'))
      return
    }
    log.info('discord oauth attempt')
    setError(null)
    setOauthLoading('discord')
    const redirectUri = `${window.location.origin}/auth/discord/callback`
    const url = new URL('https://discord.com/oauth2/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'identify email')
    url.searchParams.set('prompt', 'consent')
    window.location.assign(url.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    log.info('auth attempt', { mode, identifier: mode === 'signin' ? form.identifier : form.username })
    try {
      const signupBody: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        password: form.password,
        locale: i18n.language,
      }
      const trimmedCode = form.referralCode.trim().toUpperCase()
      if (trimmedCode) signupBody.referralCode = trimmedCode

      const data = await api.post<{ token: string; user: any }>(
        mode === 'signin' ? '/auth/signin' : '/auth/signup',
        mode === 'signup'
          ? signupBody
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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t('auth.chooseUsername', 'Choose your username')}</h1>
            <p className="text-neutral-500 text-sm mt-1.5">{t('auth.chooseUsernameDesc', 'This is how other players will see you')}</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-6 shadow-2xl">
            <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">@</span>
                <input
                  className="input-field pl-8"
                  placeholder={t('auth.usernamePlaceholder', 'username')}
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
              <p className="text-neutral-600 text-xs">{t('auth.usernameHint', '3-20 characters — letters, numbers, underscores only')}</p>

              {/* Optional referral code — pre-filled from ?invite=CODE. The
                  OAuth signup itself already happened, so we pass the code
                  here to the setup-username step where both sides get
                  credited. */}
              <div className="space-y-1">
                <input
                  className="input-field uppercase tracking-[0.2em]"
                  type="text"
                  placeholder={t('auth.referralCodePlaceholder', {
                    defaultValue: 'Invite code (optional)',
                  })}
                  aria-label={t('auth.inviteCodeAriaLabel', 'Invite code')}
                  value={form.referralCode}
                  onChange={(e) => setForm((f) => ({ ...f, referralCode: e.target.value.toUpperCase().slice(0, 12) }))}
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </div>

              {usernameError && (
                <div role="alert" aria-live="assertive" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 text-sm">
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
                    {t('auth.settingUp', 'Setting up...')}
                  </span>
                ) : t('auth.continue', 'Continue')}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <button
        type="button"
        onClick={toggleMusic}
        aria-label={musicEnabled ? t('auth.muteMusic', 'Mute music') : t('auth.unmuteMusic', 'Unmute music')}
        title={musicEnabled ? t('auth.muteMusic', 'Mute music') : t('auth.unmuteMusic', 'Unmute music')}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/50 text-neutral-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
      >
        {musicEnabled ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>
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
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src="/masks.png"
            alt=""
            aria-hidden="true"
            className="w-28 h-28 md:w-32 md:h-32 object-contain select-none pointer-events-none mb-3"
          />
          <div className="w-56 md:w-64 aspect-[863/348] overflow-hidden">
            <img
              src="/wordmark.png"
              alt="Red Handed !"
              className="w-full h-full object-cover select-none pointer-events-none"
              style={{ objectPosition: 'center 51.8%' }}
            />
          </div>
          <p className="text-neutral-500 text-sm mt-2">{t('home.subtitle')}</p>
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
              {t('auth.continueWithGoogle', 'Continue with Google')}
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
              {t('auth.continueWithApple', 'Continue with Apple')}
            </button>

            <button
              type="button"
              onClick={() => { setError(null); handleDiscord() }}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'discord' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <DiscordIcon />}
              {t('auth.continueWithDiscord', 'Continue with Discord')}
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
                onClick={() => {
                  setMode(m)
                  setError(null)
                  // Keep the referral code across tab switches so invitees
                  // who hit /signup from a share link don't lose it if they
                  // accidentally click the sign-in tab.
                  setForm((f) => ({
                    identifier: '',
                    email: '',
                    password: '',
                    username: '',
                    referralCode: f.referralCode,
                  }))
                }}
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
                  aria-label={t('auth.username')}
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
                placeholder={t('auth.emailOrUsername', 'Email or username')}
                aria-label={t('auth.emailOrUsername', 'Email or username')}
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
                aria-label={t('auth.email')}
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
              aria-label={t('auth.password')}
              value={form.password}
              onChange={update('password')}
              minLength={mode === 'signup' ? 8 : undefined}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            {mode === 'signup' && (
              <div className="space-y-1">
                <input
                  className="input-field uppercase tracking-[0.2em]"
                  type="text"
                  placeholder={t('auth.referralCodePlaceholder', {
                    defaultValue: 'Invite code (optional)',
                  })}
                  aria-label={t('auth.inviteCodeAriaLabel', 'Invite code')}
                  value={form.referralCode}
                  onChange={(e) => setForm((f) => ({ ...f, referralCode: e.target.value.toUpperCase().slice(0, 12) }))}
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right -mt-1">
                <Link
                  to="/forgot-password"
                  className="text-brand-500 hover:text-brand-400 transition-colors text-xs font-medium"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            )}

            {error && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 text-sm">
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
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
            }}
            className="text-brand-500 hover:text-brand-400 transition-colors font-medium"
          >
            {mode === 'signin' ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </p>

        {/* Offline mode shortcut */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/offline')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/50 text-neutral-300 hover:text-white text-sm font-semibold transition-all active:scale-[0.97]"
          >
            <span>📱</span>
            {t('offline.playOffline')}
            <span className="text-neutral-500 text-[10px]">— {t('offline.playOfflineDesc')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
