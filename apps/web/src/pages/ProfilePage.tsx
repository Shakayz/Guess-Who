import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@imposter/ui'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'

const MOCK_RANK: RankTier = 'wooden'
const MOCK_LP = 42

const STATS = [
  { label: 'Games Played', value: '0', icon: '🎮' },
  { label: 'Win Rate',     value: '—',  icon: '🏆' },
  { label: 'Star Coins',   value: '100', icon: '⭐' },
  { label: 'Gold Coins',   value: '0',  icon: '💰' },
]

const HONOR_TYPES = [
  { key: 'teamplayer', label: 'Team Player', icon: '🤝', count: 0 },
  { key: 'sharp_mind', label: 'Sharp Mind',  icon: '🧠', count: 0 },
  { key: 'good_sport', label: 'Good Sport',  icon: '🎖️', count: 0 },
]

export default function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const rank = RANK_CONFIG[MOCK_RANK]
  const lpPct = Math.min((MOCK_LP / rank.lpRequired) * 100, 100)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-xl mx-auto space-y-4 animate-slide-up">

          {/* Profile card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-4">
              {user && <Avatar username={user.username} size="xl" />}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-extrabold text-white">{user?.username}</h1>
                <p className="text-neutral-500 text-sm truncate">{user?.email ?? 'No email'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                  <span className="text-xs text-neutral-500">{MOCK_LP} / {rank.lpRequired} LP</span>
                </div>
              </div>
            </div>

            {/* Rank progress */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>{rank.label}</span>
                <span>{RANK_CONFIG['bronze'].label}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-700"
                  style={{ width: `${lpPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="card text-center hover:border-neutral-700 transition-colors">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Honors */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('honor.giveHonor')}</p>
            <div className="grid grid-cols-3 gap-3">
              {HONOR_TYPES.map((h) => (
                <div key={h.key} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                  <span className="text-2xl">{h.icon}</span>
                  <p className="text-xs font-semibold text-white">{h.label}</p>
                  <p className="text-lg font-bold text-neutral-300">{h.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent achievements placeholder */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Achievements</p>
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-4xl mb-2">🏅</span>
              <p className="text-white font-semibold text-sm">No achievements yet</p>
              <p className="text-neutral-500 text-xs mt-1">Play games to unlock achievements</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
