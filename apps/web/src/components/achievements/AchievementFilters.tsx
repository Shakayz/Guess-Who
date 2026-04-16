import React from 'react'
import { useTranslation } from 'react-i18next'

export type CategoryFilter =
  | 'all'
  | 'gameplay'
  | 'red_handed'
  | 'detective'
  | 'social'
  | 'ranked'
  | 'milestones'
  | 'secret'
  | 'special_role'
  | 'economy'
  | 'meta'

export type StateFilter = 'all' | 'locked' | 'unclaimed' | 'claimed'

interface Props {
  category: CategoryFilter
  state: StateFilter
  onCategoryChange: (c: CategoryFilter) => void
  onStateChange: (s: StateFilter) => void
  counts: Record<string, number>
}

const CATEGORIES: { value: CategoryFilter; label: string; icon: string }[] = [
  { value: 'all',          label: 'All',         icon: '🌐' },
  { value: 'gameplay',     label: 'Gameplay',    icon: '🎮' },
  { value: 'red_handed',     label: 'Red-Handed',    icon: '🎭' },
  { value: 'detective',    label: 'Detective',   icon: '🕵️' },
  { value: 'special_role', label: 'Special',     icon: '⚡' },
  { value: 'social',       label: 'Social',      icon: '🤝' },
  { value: 'ranked',       label: 'Ranked',      icon: '⚔️' },
  { value: 'milestones',   label: 'Milestones',  icon: '🎯' },
  { value: 'economy',      label: 'Economy',     icon: '💰' },
  { value: 'meta',         label: 'Meta',        icon: '🏅' },
  { value: 'secret',       label: 'Secret',      icon: '🔐' },
]

const STATES: { value: StateFilter; label: string; icon: string }[] = [
  { value: 'all',       label: 'All',       icon: '◯' },
  { value: 'unclaimed', label: 'Unclaimed', icon: '🎁' },
  { value: 'claimed',   label: 'Claimed',   icon: '✓' },
  { value: 'locked',    label: 'Locked',    icon: '🔒' },
]

export function AchievementFilters({ category, state, onCategoryChange, onStateChange, counts }: Props) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 mb-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          {t('achievements.category')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => onCategoryChange(c.value)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                category === c.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white',
              ].join(' ')}
            >
              <span className="mr-1">{c.icon}</span>
              {c.label}
              {counts[c.value] !== undefined && (
                <span className="ml-1.5 opacity-60">({counts[c.value]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          {t('achievements.state')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STATES.map((s) => (
            <button
              key={s.value}
              onClick={() => onStateChange(s.value)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                state === s.value
                  ? 'bg-amber-500 text-neutral-900'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white',
              ].join(' ')}
            >
              <span className="mr-1">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
