import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { Avatar, Badge } from '@red-handed/ui'
import { RANK_CONFIG } from '@red-handed/shared'
import type { RankTier } from '@red-handed/shared'
import { LANGUAGES, findLanguage } from '../i18n/languages'

interface LeaderboardUser {
  id: string
  username: string
  avatarUrl: string | null
  rankTier: RankTier
  rankPoints: number
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

function SkeletonRow() {
  return (
    <div className="card flex items-center gap-3 animate-pulse">
      <div className="w-6 h-4 bg-neutral-800 rounded" />
      <div className="w-8 h-8 bg-neutral-800 rounded-full" />
      <div className="flex-1 h-4 bg-neutral-800 rounded" />
      <div className="w-20 h-5 bg-neutral-800 rounded-full" />
      <div className="w-12 h-4 bg-neutral-800 rounded" />
    </div>
  )
}

interface LanguagePickerProps {
  value: string
  onChange: (code: string) => void
  label: string
}

function LanguagePicker({ value, onChange, label }: LanguagePickerProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const selected = findLanguage(value)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'group flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl',
          'bg-neutral-900 border text-sm font-medium transition-all',
          open
            ? 'border-brand-600/60 ring-2 ring-brand-600/20 text-white'
            : 'border-neutral-800 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900/80',
        ].join(' ')}
      >
        <img
          src={`https://flagcdn.com/w40/${selected.country}.png`}
          alt=""
          className="w-6 h-4 object-cover rounded-[3px] shadow-sm"
        />
        <span className="hidden sm:inline">{selected.label}</span>
        <span
          className={[
            'text-[10px] text-neutral-500 transition-transform',
            open ? 'rotate-180 text-neutral-300' : '',
          ].join(' ')}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={[
            'absolute right-0 mt-2 w-56 z-50',
            'bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl',
            'overflow-hidden origin-top-right',
            'animate-in fade-in slide-in-from-top-1 duration-150',
          ].join(' ')}
        >
          <div className="max-h-80 overflow-y-auto py-1">
            {LANGUAGES.map((lang) => {
              const isSelected = lang.code === selected.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(lang.code)
                    setOpen(false)
                  }}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors',
                    isSelected
                      ? 'bg-brand-600/10 text-white'
                      : 'text-neutral-300 hover:bg-neutral-800 hover:text-white',
                  ].join(' ')}
                >
                  <img
                    src={`https://flagcdn.com/w40/${lang.country}.png`}
                    alt=""
                    className="w-6 h-4 object-cover rounded-[3px] shadow-sm flex-shrink-0"
                  />
                  <span className="flex-1 font-medium">{lang.label}</span>
                  {isSelected && (
                    <span className="text-brand-400 text-xs" aria-hidden="true">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeaderboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [locale, setLocale] = React.useState<string>(
    () => findLanguage(i18n.language).code,
  )
  const [search, setSearch] = React.useState('')
  const { data: users = [], isLoading } = useQuery<LeaderboardUser[]>({
    queryKey: ['leaderboard', locale],
    queryFn: () => api.get(`/users/leaderboard?locale=${locale}`),
    retry: false,
  })

  const filtered = search.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    : users

  const currentLang = findLanguage(locale)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto">

          {/* Header — title, subtitle, and language picker in a responsive row */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                {t('leaderboard.title')}
              </h1>
              <p className="text-neutral-500 text-sm md:text-base mt-1">
                {t('leaderboard.rankingsFor', { language: currentLang.label })}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="hidden md:inline text-xs uppercase tracking-wider text-neutral-600 font-semibold">
                {t('leaderboard.language')}
              </span>
              <LanguagePicker
                value={locale}
                onChange={setLocale}
                label={t('leaderboard.languagePickerLabel')}
              />
            </div>
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-brand-600 transition-colors"
              placeholder={t('leaderboard.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Top 3 podium (when data available and no search) */}
          {!isLoading && !search.trim() && users.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8 items-start">
              {[users[1], users[0], users[2]].map((u, podiumIdx) => {
                const realIdx = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2
                const rank = RANK_CONFIG[u.rankTier]
                const offsets = ['mt-6', '', 'mt-10']
                const isFirst = realIdx === 0
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => navigate(`/player/${u.id}`)}
                    className={[
                      'card w-full flex flex-col items-center justify-center gap-1.5',
                      'py-4 md:py-5 transition-colors hover:border-neutral-700',
                      isFirst ? 'ring-1 ring-amber-500/40' : '',
                      offsets[podiumIdx],
                    ].join(' ')}
                  >
                    <span className="text-2xl md:text-3xl leading-none">{MEDAL[realIdx]}</span>
                    <Avatar src={u.avatarUrl} username={u.username} size="md" />
                    <p className="block w-full text-center text-sm font-semibold text-white truncate px-2">
                      {u.username}
                    </p>
                    <Badge variant="rank" className="text-[10px]">{rank.icon} {rank.label}</Badge>
                    <p className="text-xs text-neutral-500 tabular-nums">{u.rankPoints.toLocaleString()} LP</p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Full list */}
          <div className="space-y-2">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
              ? (
                <div className="card text-center py-12">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-white font-semibold">{search.trim() ? t('leaderboard.noPlayerFound') : t('leaderboard.noPlayersYet')}</p>
                  <p className="text-neutral-500 text-sm mt-1">{search.trim() ? t('leaderboard.tryDifferentName') : t('leaderboard.playToAppear')}</p>
                </div>
              )
              : filtered.map((u, i) => {
                  const rank = RANK_CONFIG[u.rankTier]
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => navigate(`/player/${u.id}`)}
                      className={['card w-full text-left flex items-center gap-3 md:gap-4 md:px-5 md:py-4 transition-colors hover:border-neutral-700', i < 3 ? 'border-neutral-700' : ''].join(' ')}
                    >
                      <span className="text-sm w-6 text-right font-mono text-neutral-500">
                        {MEDAL[i] ?? i + 1}
                      </span>
                      <Avatar src={u.avatarUrl} username={u.username} size="sm" />
                      <span className="flex-1 font-semibold text-white text-sm md:text-base">{u.username}</span>
                      <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                      <span className="text-sm font-mono text-neutral-400 tabular-nums">{u.rankPoints.toLocaleString()} LP</span>
                    </button>
                  )
                })
            }
          </div>
        </div>
      </main>
    </div>
  )
}
