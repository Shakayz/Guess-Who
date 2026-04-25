import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Mirror the mobile app's (tabs)/_layout.tsx tab order so the web app on
// mobile feels like the native app: Play, Leaderboard, History, Friends,
// Profile, Shop. Settings is NOT a tab — it's reachable from the profile /
// header on mobile, matching the mobile-app navigation.
//
// `fallback` is passed to t() as the default when the locale doesn't define
// the key (only en/fr/etc. translations exist for the legacy nav.* keys —
// nav.shop is new and not yet translated, so we ship an English fallback to
// avoid showing the literal "nav.shop" key).
const TABS = [
  { path: '/',            icon: '🎮', labelKey: 'nav.play',        fallback: 'Play' },
  { path: '/leaderboard', icon: '🏆', labelKey: 'nav.leaderboard', fallback: 'Leaderboard' },
  { path: '/history',     icon: '📜', labelKey: 'nav.history',     fallback: 'History' },
  { path: '/friends',     icon: '👥', labelKey: 'nav.friends',     fallback: 'Friends' },
  { path: '/profile',     icon: '👤', labelKey: 'nav.profile',     fallback: 'Profile' },
  { path: '/shop',        icon: '🛒', labelKey: 'nav.shop',        fallback: 'Shop' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  // Hide on game/lobby/results/auth pages
  const hiddenPaths = ['/game/', '/lobby/', '/results/', '/auth']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-lg safe-bottom no-select"
    >
      <div className="flex items-stretch justify-around h-16 px-1">
        {TABS.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={t(tab.labelKey, tab.fallback)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 min-w-[48px] transition-colors',
                isActive
                  ? 'text-brand-400'
                  : 'text-neutral-500 active:text-neutral-200',
              ].join(' ')}
            >
              {/* Active indicator pill at the top of the tab — mirrors the
                  mobile tab bar's selected state. */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-brand-500"
                />
              )}
              <span
                className={[
                  'text-[22px] leading-none transition-transform duration-150',
                  isActive ? 'scale-110' : 'scale-100',
                ].join(' ')}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold leading-none tracking-tight">
                {t(tab.labelKey, tab.fallback)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
