import React from 'react'
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import type { EmoteRarity } from '@red-handed/shared'

/**
 * Mobile emote card — visual parity with apps/web/src/components/emotes/EmoteTile.tsx.
 * NativeWind handles Tailwind-like class props.
 */

const RARITY_STYLE: Record<
  EmoteRarity,
  { border: string; bg: string; badge: string; badgeText: string }
> = {
  free: {
    border: 'border-neutral-700',
    bg: 'bg-neutral-900',
    badge: 'bg-neutral-800',
    badgeText: 'text-neutral-400',
  },
  common: {
    border: 'border-sky-700/60',
    bg: 'bg-sky-950/40',
    badge: 'bg-sky-900/70',
    badgeText: 'text-sky-300',
  },
  rare: {
    border: 'border-indigo-600/60',
    bg: 'bg-indigo-950/50',
    badge: 'bg-indigo-900/70',
    badgeText: 'text-indigo-300',
  },
  epic: {
    border: 'border-fuchsia-600/70',
    bg: 'bg-fuchsia-950/50',
    badge: 'bg-fuchsia-900/70',
    badgeText: 'text-fuchsia-300',
  },
  legendary: {
    border: 'border-amber-500/80',
    bg: 'bg-amber-950/40',
    badge: 'bg-amber-900/70',
    badgeText: 'text-amber-200',
  },
}

type Props = {
  emoji: string
  name: string
  rarity: EmoteRarity
  price: number
  owned: boolean
  equipped?: boolean
  disabled?: boolean
  busy?: boolean
  onPress?: () => void
  showPrice?: boolean
}

export function EmoteTile({
  emoji, name, rarity, price, owned, equipped, disabled, busy, onPress, showPrice = true,
}: Props) {
  const r = RARITY_STYLE[rarity]
  const label = rarity === 'free' ? 'FREE' : rarity.toUpperCase()
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
      className={`relative rounded-xl border p-3 ${r.border} ${r.bg} ${disabled ? 'opacity-50' : ''}`}
      style={{ minHeight: 110 }}
    >
      {equipped && (
        // Compact ✓ glyph instead of the word "EQUIPPED" — on narrow tiles
        // (5-per-row at phone widths) the longer label collided with the
        // right-side rarity pill. Mirrors the web fix in
        // apps/web/src/components/emotes/EmoteTile.tsx.
        <View
          accessibilityLabel="Equipped"
          className="absolute top-1.5 left-1.5 items-center justify-center rounded-full bg-emerald-600 z-10"
          style={{ width: 16, height: 16 }}
        >
          <Text className="text-white font-bold" style={{ fontSize: 10, lineHeight: 12 }}>✓</Text>
        </View>
      )}
      <View className={`absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 z-10 ${r.badge}`}>
        <Text className={`text-[9px] font-bold ${r.badgeText}`}>{label}</Text>
      </View>

      <View className="items-center justify-center h-12 mt-2">
        <Text style={{ fontSize: 34 }}>{emoji}</Text>
      </View>
      <Text className="text-[11px] font-semibold text-white text-center mt-1" numberOfLines={1}>
        {name}
      </Text>
      {showPrice && (
        <Text className="text-[11px] text-center mt-0.5">
          {owned ? (
            <Text className="text-emerald-400 font-semibold">Owned</Text>
          ) : rarity === 'free' ? (
            <Text className="text-neutral-400">—</Text>
          ) : (
            <Text className="text-amber-300 font-semibold">⭐ {price.toLocaleString()}</Text>
          )}
        </Text>
      )}
      {busy && (
        <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-xl">
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  )
}
