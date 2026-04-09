import React from 'react'
import { useTranslation } from 'react-i18next'

export interface AchievementCardData {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  difficulty: string
  xpReward: number
  coinReward: number
  starsReward: number
  isSecret?: boolean
  unlocked: boolean
  unlockedAt: string | null
  claimed: boolean
  claimedAt: string | null
}

interface Props {
  achievement: AchievementCardData
  onClaim: (key: string) => void
  isClaiming: boolean
}

const DIFFICULTY_COLORS: Record<string, string> = {
  bronze:   'border-amber-700/60 bg-amber-950/30',
  silver:   'border-neutral-400/60 bg-neutral-800/40',
  gold:     'border-yellow-500/60 bg-yellow-950/30',
  platinum: 'border-cyan-400/60 bg-cyan-950/30',
  diamond:  'border-sky-300/60 bg-sky-950/40',
  mythic:   'border-transparent bg-gradient-to-br from-fuchsia-950/40 via-amber-950/40 to-cyan-950/40',
}

const DIFFICULTY_LABEL_COLORS: Record<string, string> = {
  bronze:   'text-amber-400',
  silver:   'text-neutral-300',
  gold:     'text-yellow-300',
  platinum: 'text-cyan-300',
  diamond:  'text-sky-200',
  mythic:   'text-fuchsia-300',
}

export function AchievementCard({ achievement: a, onClaim, isClaiming }: Props) {
  const { t } = useTranslation()
  const state: 'locked' | 'unclaimed' | 'claimed' =
    !a.unlocked ? 'locked' : a.claimed ? 'claimed' : 'unclaimed'

  const isMythic = a.difficulty === 'mythic'

  return (
    <div
      id={`achievement-card-${a.key}`}
      className={[
        'relative overflow-hidden rounded-2xl border p-4 transition-all',
        DIFFICULTY_COLORS[a.difficulty] ?? 'border-neutral-700 bg-neutral-900',
        state === 'locked' ? 'opacity-60 grayscale' : '',
        state === 'unclaimed' ? 'ring-2 ring-amber-400/70 shadow-[0_0_32px_-8px_rgba(251,191,36,0.6)] animate-pulse-slow' : '',
        state === 'claimed' ? 'opacity-90' : '',
      ].join(' ')}
      data-difficulty={a.difficulty}
      data-state={state}
    >
      {/* Mythic rainbow border overlay */}
      {isMythic && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl p-[2px]"
          style={{
            background: 'linear-gradient(120deg, #e879f9 0%, #fbbf24 33%, #22d3ee 66%, #e879f9 100%)',
            backgroundSize: '200% 200%',
            animation: 'rainbowShift 3s linear infinite',
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      {/* Claimed badge */}
      {state === 'claimed' && (
        <div className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          ✓ {t('achievements.claimed')}
        </div>
      )}

      {/* Shimmer stripe for unclaimed cards */}
      {state === 'unclaimed' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
            style={{ animationDuration: '2.4s', animationIterationCount: 'infinite' }}
          />
        </div>
      )}

      <div className="relative flex items-start gap-3">
        <div className={[
          'w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0',
          state === 'locked' ? 'bg-neutral-800/60' : 'bg-neutral-900/60 shadow-inner',
        ].join(' ')}>
          <span>{state === 'locked' && a.isSecret ? '🔒' : a.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{a.name}</p>
            <span className={['text-[10px] uppercase tracking-wider font-bold', DIFFICULTY_LABEL_COLORS[a.difficulty] ?? 'text-neutral-400'].join(' ')}>
              {a.difficulty}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-snug mt-0.5 line-clamp-2">{a.description}</p>
          <div className="mt-1.5 flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-0.5 text-amber-300">
              <span>⭐</span>
              <span className="font-semibold">{a.starsReward}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-brand-300">
              <span>✨</span>
              <span className="font-semibold">{a.xpReward} XP</span>
            </span>
          </div>
        </div>
      </div>

      {state === 'unclaimed' && (
        <button
          onClick={() => onClaim(a.key)}
          disabled={isClaiming}
          className="relative mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-neutral-900 font-bold text-sm shadow-lg hover:from-amber-400 hover:to-yellow-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isClaiming ? '…' : `${t('achievements.claim')} +${a.starsReward}⭐`}
        </button>
      )}
    </div>
  )
}
