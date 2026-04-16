import React, { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'
import { DmChatPanel } from './DmChatPanel'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'

const NAV_PATHS = ['/', '/leaderboard', '/history', '/friends'] as const

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

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n, t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const activeDm = useSocialStore((s) => s.activeDm)
  const setActiveDm = useSocialStore((s) => s.setActiveDm)

  // Coin balance for the header chip. Plain useState+fetch instead of
  // react-query to keep the many NavBar tests (which don't wrap in a
  // QueryClientProvider) working. We refetch on:
  //   1. token change (login/logout)
  //   2. route change (cheap visibility cue)
  //   3. socket `game:finished` (rewards were just credited)
  const token = useAuthStore((s) => s.token)
  const [starCoins, setStarCoins] = useState(0)
  useEffect(() => {
    if (!token) {
      setStarCoins(0)
      return
    }
    let cancelled = false
    const fetchBalance = () => {
      api
        .get<{ starCoins?: number }>('/auth/me')
        .then((me) => {
          if (!cancelled) setStarCoins(me.starCoins ?? 0)
        })
        .catch(() => {
          // Non-critical — silently keep the last value on transient errors.
        })
    }
    fetchBalance()
    // Refresh the chip when the server credits rewards at game-end. We guard
    // the socket subscription because tests mock `lib/socket` minimally.
    let sock: any = null
    try {
      sock = getSocket()
    } catch {
      sock = null
    }
    if (sock && typeof sock.on === 'function') {
      sock.on('game:finished', fetchBalance)
    }
    return () => {
      cancelled = true
      if (sock && typeof sock.off === 'function') {
        sock.off('game:finished', fetchBalance)
      }
    }
  }, [token, location.pathname])
  React.useEffect(() => {
    if (!langOpen) return
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [langOpen])

  const baseLang = i18n.language?.split('-')[0] ?? 'en'
  const currentLang = LANGUAGES.find((l) => l.code === baseLang) ?? LANGUAGES[0]

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    setLangOpen(false)
    // Persist the new locale to the DB so matchmaking and room joining use it
    api.patch('/users/me', { locale: code }).catch(() => {/* non-critical */})
  }

  return (
    <>
    <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60 backdrop-blur-sm sticky top-0 z-40 bg-neutral-950/80">
      <div className="flex items-center gap-5">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-base">🎭</div>
          <span className="font-bold text-white tracking-tight">Imposter</span>
        </button>
        <nav role="navigation" aria-label="Main navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
          {NAV_PATHS.map((path) => {
            const labelKey = path === '/' ? 'nav.play' : path === '/leaderboard' ? 'nav.leaderboard' : path === '/history' ? 'nav.history' : 'nav.friends'
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                aria-label={t(labelKey)}
                aria-current={location.pathname === path ? 'page' : undefined}
                className={[
                  'px-3 py-1.5 text-sm rounded-lg transition-all',
                  location.pathname === path
                    ? 'text-white bg-neutral-800'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60',
                ].join(' ')}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        {/* Coin-balance chip → opens the shop. We only render when the user is
            logged in (unauth visitors never hit NavBar, but the useQuery is
            also gated on token). The chip is compact on small screens — icon
            + count, no label — so it doesn't crowd mobile header space. */}
        {token && (
          <button
            onClick={() => navigate('/shop?tab=coins')}
            aria-label={t('shop.shop')}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all mr-1',
              location.pathname === '/shop'
                ? 'bg-amber-500 text-neutral-900'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30',
            ].join(' ')}
          >
            <span className="text-sm">⭐</span>
            <span>{starCoins.toLocaleString()}</span>
            <span className="hidden sm:inline text-[10px] text-amber-400/70 ml-0.5">+</span>
          </button>
        )}

        {/* Language switcher */}
        <div ref={langRef} className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
          >
            <img src={`https://flagcdn.com/w20/${currentLang.country}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
            <span className="text-[10px] text-neutral-600">▾</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl overflow-hidden z-50">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangChange(lang.code)}
                className={[
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                    baseLang === lang.code
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
                  ].join(' ')}
                >
                  <img src={`https://flagcdn.com/w20/${lang.country}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                  <span>{lang.label}</span>
                  {i18n.language === lang.code && <span className="ml-auto text-brand-400 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-neutral-800 mx-0.5" />

        <button
          onClick={() => navigate('/profile')}
          className="px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-all font-medium"
        >
          {user?.username}
        </button>
        <div className="w-px h-4 bg-neutral-800 mx-0.5" />
        <button
          onClick={() => { clearAuth(); window.location.replace('/auth') }}
          className="px-3 py-1.5 text-sm text-neutral-500 hover:text-red-400 rounded-lg transition-all"
        >
          {t('nav.signOut')}
        </button>
      </div>
    </header>

    {/* DM Chat Panel */}
    {activeDm && (
      <DmChatPanel
        friend={{ id: activeDm.friendId, username: activeDm.friendUsername }}
        onClose={() => setActiveDm(null)}
      />
    )}
  </>
  )
}
