import React, { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'

const LINKS = [
  { label: 'Play', path: '/' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Shop', path: '/shop' },
]

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

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

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    setLangOpen(false)
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60 backdrop-blur-sm sticky top-0 z-10 bg-neutral-950/80">
      <div className="flex items-center gap-5">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-base">🎭</div>
          <span className="font-bold text-white tracking-tight">Imposter</span>
        </button>
        <nav className="hidden sm:flex items-center gap-1">
          {LINKS.map((l) => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className={[
                'px-3 py-1.5 text-sm rounded-lg transition-all',
                location.pathname === l.path
                  ? 'text-white bg-neutral-800'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60',
              ].join(' ')}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        {/* Language switcher */}
        <div ref={langRef} className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
          >
            <span>{currentLang.flag}</span>
            <span className="hidden sm:inline text-xs font-medium">{currentLang.code.toUpperCase()}</span>
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
                    i18n.language === lang.code
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
                  ].join(' ')}
                >
                  <span>{lang.flag}</span>
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
          onClick={clearAuth}
          className="px-3 py-1.5 text-sm text-neutral-500 hover:text-red-400 rounded-lg transition-all"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
