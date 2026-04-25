import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { LANGUAGES, findLanguage } from '../i18n/languages'
import { PremiumBadge } from './PremiumBadge'

/**
 * Slim, native-feeling top header for mobile viewports (`md:hidden`). Pairs
 * with `BottomNav` to give the web app on phones the same chrome shape as the
 * React Native app: a compact identity row up top (logo + streak + coin chip +
 * avatar menu) and a tab bar at the bottom.
 *
 * The full desktop `NavBar` keeps the language picker, premium upsell, and
 * sign-out in the top bar; on mobile those secondary actions move into a
 * tap-to-open menu so the header itself stays one row tall.
 */
export function MobileHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n, t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  // Hide on the same routes that hide BottomNav so we get a fully immersive
  // game / lobby / results / auth experience.
  const hiddenPaths = ['/game/', '/lobby/', '/results/', '/auth', '/forgot-password', '/reset-password']
  const isHidden = hiddenPaths.some((p) => location.pathname.startsWith(p))

  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Coin balance + premium + streak — same wiring as NavBar so the chip stays
  // in sync with rewards / shop purchases / daily streak.
  const [starCoins, setStarCoins] = useState(0)
  const [isPremium, setIsPremium] = useState(false)
  const [streak, setStreak] = useState<{ count: number; lastPlayedAt: string | null }>({
    count: 0,
    lastPlayedAt: null,
  })

  useEffect(() => {
    if (!token) {
      setStarCoins(0)
      setIsPremium(false)
      setStreak({ count: 0, lastPlayedAt: null })
      return
    }
    let cancelled = false
    const fetchBalance = () => {
      api
        .get<{ starCoins?: number; dailyStreakCount?: number; lastPlayedAt?: string | null; isPremium?: boolean }>('/auth/me')
        .then((me) => {
          if (cancelled) return
          setStarCoins(me.starCoins ?? 0)
          setIsPremium(!!me.isPremium)
          setStreak({
            count: me.dailyStreakCount ?? 0,
            lastPlayedAt: me.lastPlayedAt ?? null,
          })
        })
        .catch(() => {})
    }
    fetchBalance()
    let sock: any = null
    try { sock = getSocket() } catch { sock = null }
    if (sock && typeof sock.on === 'function') sock.on('game:finished', fetchBalance)
    const onWallet = (e: Event) => {
      const next = (e as CustomEvent<{ starCoins?: number }>).detail?.starCoins
      if (typeof next === 'number') setStarCoins(next)
      else fetchBalance()
    }
    window.addEventListener('wallet:balance', onWallet)
    return () => {
      cancelled = true
      if (sock && typeof sock.off === 'function') sock.off('game:finished', fetchBalance)
      window.removeEventListener('wallet:balance', onWallet)
    }
  }, [token, location.pathname])

  // Close the avatar menu on outside click, just like the desktop language picker.
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  if (isHidden) return null

  const streakAlive = (() => {
    if (!streak.lastPlayedAt || streak.count <= 0) return false
    const last = new Date(streak.lastPlayedAt)
    if (isNaN(last.getTime())) return false
    const dayMs = 86_400_000
    const lastDay = Math.floor(last.getTime() / dayMs)
    const todayDay = Math.floor(Date.now() / dayMs)
    return todayDay - lastDay <= 1
  })()

  const baseLang = i18n.language?.split('-')[0] ?? 'en'
  const currentLang = findLanguage(i18n.language)
  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    setLangOpen(false)
    api.patch('/users/me', { locale: code }).catch(() => {})
  }

  return (
    <header className="md:hidden sticky top-0 z-40 bg-neutral-950/90 backdrop-blur border-b border-neutral-800/60 safe-top no-select">
      <div className="flex items-center justify-between gap-2 px-3 h-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center pressable shrink-0"
          aria-label="Red Handed home"
        >
          <img src="/masks.png" alt="Red Handed" className="h-8 w-auto" draggable={false} />
        </button>

        <div className="flex items-center gap-1.5">
          {token && (
            <span
              aria-label={t('nav.streak', { count: streak.count })}
              className={[
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border',
                streakAlive
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  : 'bg-neutral-800/60 text-neutral-500 border-neutral-700',
              ].join(' ')}
            >
              <span className={streakAlive ? '' : 'grayscale opacity-60'}>🔥</span>
              <span>{streak.count}</span>
            </span>
          )}

          {token && (
            <button
              onClick={() => navigate('/shop?tab=coins')}
              aria-label={t('shop.shop')}
              className={[
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold pressable',
                'bg-amber-500/10 text-amber-400 border border-amber-500/30',
              ].join(' ')}
            >
              <span>⭐</span>
              <span>{starCoins.toLocaleString()}</span>
            </button>
          )}

          {token && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="flex items-center justify-center h-9 w-9 rounded-full bg-neutral-800 text-neutral-300 pressable border border-neutral-700"
              >
                {/* Username initial as a lightweight avatar — keeps the header
                    a single row even with long usernames. */}
                <span className="text-sm font-bold uppercase">
                  {user?.username?.[0] ?? '?'}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-neutral-800 bg-neutral-900/95 backdrop-blur shadow-2xl overflow-hidden animate-slide-down">
                  <div className="px-3 py-2.5 border-b border-neutral-800 flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-700/60 text-white text-sm font-bold uppercase">
                      {user?.username?.[0] ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                        <span className="truncate">{user?.username}</span>
                        {isPremium && <PremiumBadge size="xs" />}
                      </div>
                      <div className="text-[10px] text-neutral-500">{t('nav.profile', 'Profile')}</div>
                    </div>
                  </div>

                  <MenuRow
                    icon="👤"
                    label={t('nav.profile', 'Profile')}
                    onClick={() => { setMenuOpen(false); navigate('/profile') }}
                  />
                  <MenuRow
                    icon="⚙️"
                    label={t('nav.settings', 'Settings')}
                    onClick={() => { setMenuOpen(false); navigate('/settings') }}
                  />
                  {!isPremium && (
                    <MenuRow
                      icon="👑"
                      label={t('nav.goPremium', 'Go Premium')}
                      accent
                      onClick={() => { setMenuOpen(false); navigate('/shop?tab=premium') }}
                    />
                  )}

                  <button
                    onClick={() => setLangOpen((o) => !o)}
                    aria-expanded={langOpen}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 active:bg-neutral-800 transition-colors"
                  >
                    <img
                      src={`https://flagcdn.com/w20/${currentLang.country}.png`}
                      alt=""
                      className="w-5 h-3.5 object-cover rounded-sm"
                    />
                    <span className="flex-1 text-left">{currentLang.label}</span>
                    <span className={['text-[10px] text-neutral-500 transition-transform', langOpen ? 'rotate-180' : ''].join(' ')}>▾</span>
                  </button>
                  {langOpen && (
                    <div className="max-h-56 overflow-y-auto border-t border-neutral-800">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => { handleLangChange(lang.code); setMenuOpen(false) }}
                          className={[
                            'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                            baseLang === lang.code
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-400 hover:bg-neutral-800 hover:text-white active:bg-neutral-800',
                          ].join(' ')}
                        >
                          <img src={`https://flagcdn.com/w20/${lang.country}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                          <span className="flex-1">{lang.label}</span>
                          {i18n.language === lang.code && <span className="text-brand-400 text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-neutral-800">
                    <button
                      onClick={() => { setMenuOpen(false); clearAuth(); window.location.replace('/auth') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-neutral-800 active:bg-neutral-800 transition-colors"
                    >
                      <span>🚪</span>
                      <span>{t('nav.signOut')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuRow({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: string
  label: string
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
        accent
          ? 'text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/10'
          : 'text-neutral-300 hover:bg-neutral-800 active:bg-neutral-800',
      ].join(' ')}
    >
      <span>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}
