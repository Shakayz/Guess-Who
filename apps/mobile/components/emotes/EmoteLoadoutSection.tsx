import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import {
  EMOTE_CATALOG,
  MAX_LOADOUT_SIZE,
  getEmoteById,
  type Emote,
  type EmoteRarity,
} from '@red-handed/shared'
import { api } from '../../lib/api'
import { useEmotesStore } from '../../store/emotes'
import { HapticManager } from '../../lib/haptics'
import { EmoteTile } from './EmoteTile'

/**
 * Mobile mirror of apps/web/src/components/emotes/EmoteLoadoutSection.tsx.
 * Two rows: equipped slots (10) and owned collection grouped by rarity.
 * Each change POSTs immediately so a backgrounded app still persists.
 */

const RARITY_ORDER: EmoteRarity[] = ['legendary', 'epic', 'rare', 'common', 'free']
const RARITY_LABEL: Record<EmoteRarity, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  common: 'Common',
  free: 'Free',
}

export function EmoteLoadoutSection({ onShop, fontScale = 1 }: { onShop: () => void; fontScale?: number }) {
  const store = useEmotesStore()
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    store.fetchMe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const me = store.me
  const loadout = me?.loadout ?? []
  const ownedSet = new Set(me?.ownedIds ?? [])

  const slots: (string | null)[] = [
    ...loadout,
    ...Array(Math.max(0, MAX_LOADOUT_SIZE - loadout.length)).fill(null),
  ].slice(0, MAX_LOADOUT_SIZE)

  const persist = async (next: string[]) => {
    store.setLoadout(next)
    try {
      const res = await api.put<{ ok: boolean; loadout: string[] }>('/emotes/loadout', { ids: next })
      store.setLoadout(res.loadout)
      setSaveError(null)
    } catch (err) {
      setSaveError((err as Error)?.message ?? 'Could not save loadout')
    }
  }

  const removeFromLoadout = (id: string) => {
    HapticManager.selection()
    const next = loadout.filter((x) => x !== id)
    persist(next)
  }

  const addToLoadout = (id: string) => {
    if (loadout.includes(id)) return
    if (loadout.length >= MAX_LOADOUT_SIZE) return
    HapticManager.selection()
    const next = [...loadout, id]
    persist(next)
  }

  const owned = React.useMemo(() => {
    const byRarity: Record<EmoteRarity, Emote[]> = {
      legendary: [], epic: [], rare: [], common: [], free: [],
    }
    for (const em of EMOTE_CATALOG) {
      if (ownedSet.has(em.id) || em.rarity === 'free') byRarity[em.rarity].push(em)
    }
    return byRarity
  }, [ownedSet])

  return (
    <View className="mx-4 mb-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4" style={{ gap: 14 }}>
      <View className="flex-row items-start justify-between">
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            className="text-neutral-500 font-semibold uppercase"
            style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
          >
            Emote Loadout
          </Text>
          <Text className="text-neutral-600 mt-1" style={{ fontSize: 11 * fontScale }}>
            Pick up to {MAX_LOADOUT_SIZE} reactions for your in-game React bar.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onShop}
          className="bg-violet-600 rounded-lg px-3 py-1.5"
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold" style={{ fontSize: 11 * fontScale }}>
            Buy more →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Equipped slots */}
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {slots.map((id, i) => {
          if (!id) {
            return (
              <View
                key={`empty-${i}`}
                className="rounded-xl border-2 border-dashed border-neutral-800 items-center justify-center"
                style={{ width: '18%', aspectRatio: 1 }}
              >
                <Text className="text-neutral-700" style={{ fontSize: 11 }}>
                  {i + 1}
                </Text>
              </View>
            )
          }
          const em = getEmoteById(id)
          if (!em) return null
          return (
            <TouchableOpacity
              key={id}
              onPress={() => removeFromLoadout(id)}
              className="rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
              style={{ width: '18%', aspectRatio: 1 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 26 }}>{em.emoji}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Collection */}
      <View style={{ gap: 10 }}>
        <Text
          className="text-neutral-500 font-semibold uppercase"
          style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
        >
          Your collection
        </Text>
        {RARITY_ORDER.map((rarity) => {
          const list = owned[rarity]
          if (list.length === 0) return null
          return (
            <View key={rarity} style={{ gap: 6 }}>
              <Text
                className="text-neutral-600 font-bold uppercase"
                style={{ fontSize: 9 * fontScale, letterSpacing: 1 }}
              >
                {RARITY_LABEL[rarity]}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {list.map((em) => {
                  const equipped = loadout.includes(em.id)
                  const full = !equipped && loadout.length >= MAX_LOADOUT_SIZE
                  return (
                    <View key={em.id} style={{ width: '31%' }}>
                      <EmoteTile
                        emoji={em.emoji}
                        name={em.name}
                        rarity={em.rarity}
                        price={em.price}
                        owned
                        equipped={equipped}
                        disabled={full}
                        onPress={() => (equipped ? removeFromLoadout(em.id) : addToLoadout(em.id))}
                        showPrice={false}
                      />
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}
      </View>

      {saveError && (
        <View className="rounded-xl bg-red-950/30 border border-red-900/50 px-3 py-2">
          <Text className="text-red-300" style={{ fontSize: 11 * fontScale }}>
            Couldn't save loadout: {saveError}
          </Text>
        </View>
      )}
    </View>
  )
}
