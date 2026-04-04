import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TABS = [
  { path: '/',            icon: '🎮', labelKey: 'nav.play' },
  { path: '/leaderboard', icon: '🏆', labelKey: 'nav.leaderboard' },
  { path: '/history',     icon: '📜', labelKey: 'nav.history' },
  { path: '/friends',     icon: '👥', labelKey: 'nav.friends' },
  { path: '/profile',     icon: '👤', labelKey: 'nav.profile' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  // Hide on game/lobby/results/auth pages
  const hiddenPaths = ['/game/', '/lobby/', '/results/', '/auth']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-lg safe-bottom">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={[
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all min-w-[56px]',
                isActive
                  ? 'text-brand-400'
                  : 'text-neutral-500 active:text-neutral-300',
              ].join(' ')}
            >
              <span className={['text-lg transition-transform', isActive ? 'scale-110' : ''].join(' ')}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold leading-none">{t(tab.labelKey)}</span>
              {isActive && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
