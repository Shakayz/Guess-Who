import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
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
  fontScale: number
}

const CATEGORIES: { value: CategoryFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '🌐' },
  { value: 'gameplay', label: 'Gameplay', icon: '🎮' },
  { value: 'red_handed', label: 'Imposter', icon: '🎭' },
  { value: 'detective', label: 'Detective', icon: '🕵️' },
  { value: 'special_role', label: 'Special', icon: '⚡' },
  { value: 'social', label: 'Social', icon: '🤝' },
  { value: 'ranked', label: 'Ranked', icon: '⚔️' },
  { value: 'milestones', label: 'Milestones', icon: '🎯' },
  { value: 'economy', label: 'Economy', icon: '💰' },
  { value: 'meta', label: 'Meta', icon: '🏅' },
  { value: 'secret', label: 'Secret', icon: '🔐' },
]

const STATES: { value: StateFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '◯' },
  { value: 'unclaimed', label: 'Unclaimed', icon: '🎁' },
  { value: 'claimed', label: 'Claimed', icon: '✓' },
  { value: 'locked', label: 'Locked', icon: '🔒' },
]

export function AchievementFilters({
  category,
  state,
  onCategoryChange,
  onStateChange,
  counts,
  fontScale,
}: Props) {
  const { t } = useTranslation()
  return (
    <View className="gap-3">
      <View>
        <Text
          className="font-semibold uppercase tracking-widest text-neutral-500 mb-2 px-1"
          style={{ fontSize: 10 * fontScale }}
        >
          {t('achievements.category', { defaultValue: 'Category' })}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12, gap: 6 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.value
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => onCategoryChange(c.value)}
                className={[
                  'flex-row items-center gap-1 px-3 py-1.5 rounded-full',
                  active ? 'bg-violet-600' : 'bg-neutral-800',
                ].join(' ')}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 11 * fontScale }}>{c.icon}</Text>
                <Text
                  className={['font-semibold', active ? 'text-white' : 'text-neutral-400'].join(' ')}
                  style={{ fontSize: 11 * fontScale }}
                >
                  {c.label}
                </Text>
                {counts[c.value] !== undefined && (
                  <Text
                    className={['font-semibold', active ? 'text-violet-200' : 'text-neutral-600'].join(' ')}
                    style={{ fontSize: 10 * fontScale }}
                  >
                    ({counts[c.value]})
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <View>
        <Text
          className="font-semibold uppercase tracking-widest text-neutral-500 mb-2 px-1"
          style={{ fontSize: 10 * fontScale }}
        >
          {t('achievements.state', { defaultValue: 'State' })}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {STATES.map((s) => {
            const active = state === s.value
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => onStateChange(s.value)}
                className={[
                  'flex-row items-center gap-1 px-3 py-1.5 rounded-full',
                  active ? 'bg-amber-500' : 'bg-neutral-800',
                ].join(' ')}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 11 * fontScale }}>{s.icon}</Text>
                <Text
                  className={['font-semibold', active ? 'text-neutral-900' : 'text-neutral-400'].join(' ')}
                  style={{ fontSize: 11 * fontScale }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </View>
  )
}
