import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import {
  EMOTE_CATALOG,
  MAX_LOADOUT_SIZE,
  getEmoteById,
  type EmoteRarity,
} from '@red-handed/shared'
import { api } from '../../lib/api'
import { useEmotesStore } from '../../store/emotes'
import { EmoteTile } from './EmoteTile'

/**
 * Loadout picker for the Profile screen. Two rows:
 *   (1) The active loadout — up to 10 slots, ordered. Tapping a slot removes
 *       that emote. Empty slots are shown as dashed placeholders so the cap
 *       is always visible.
 *   (2) The collection — every emote the user owns (implicit free + paid).
 *       Tapping adds it to the loadout. Paid but un-owned emotes are NOT
 *       listed here; they live in the shop to keep this screen focused on
 *       what the user can actually equip.
 *
 * Saves are debounced-through-mutation: every change POSTs immediately so a
 * quit mid-session still persists. The server filters unknown/unowned ids on
 * read, so there's no need for the client to re-validate.
 */

const RARITY_ORDER: EmoteRarity[] = ['legendary', 'epic', 'rare', 'common', 'free']

export function EmoteLoadoutSection({ onShop }: { onShop: () => void }) {
  const { t } = useTranslation()
  const store = useEmotesStore()

  React.useEffect(() => { store.fetchMe() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation<{ ok: boolean; loadout: string[] }, Error, string[]>({
    mutationFn: (ids) => api.put('/emotes/loadout', { ids }),
    onSuccess: (res) => {
      // Server-returned ids are authoritative (it may have deduped or trimmed).
      store.setLoadout(res.loadout)
    },
  })

  const me = store.me
  const loadout = me?.loadout ?? []
  const ownedSet = new Set(me?.ownedIds ?? [])
  const slots: (string | null)[] = [
    ...loadout,
    ...Array(Math.max(0, MAX_LOADOUT_SIZE - loadout.length)).fill(null),
  ].slice(0, MAX_LOADOUT_SIZE)

  const removeFromLoadout = (id: string) => {
    const next = loadout.filter((x) => x !== id)
    store.setLoadout(next)
    save.mutate(next)
  }

  const addToLoadout = (id: string) => {
    if (loadout.includes(id)) return
    if (loadout.length >= MAX_LOADOUT_SIZE) return
    const next = [...loadout, id]
    store.setLoadout(next)
    save.mutate(next)
  }

  // Owned emotes grouped by rarity (desc) so the most exciting items surface first.
  const owned = React.useMemo(() => {
    const byRarity: Record<EmoteRarity, typeof EMOTE_CATALOG[number][]> = {
      legendary: [], epic: [], rare: [], common: [], free: [],
    }
    for (const em of EMOTE_CATALOG) {
      if (ownedSet.has(em.id) || em.rarity === 'free') byRarity[em.rarity].push(em)
    }
    return byRarity
  }, [ownedSet])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{t('emote.loadoutTitle', 'Emote Loadout')}</p>
          <p className="text-xs text-neutral-600 mt-0.5">{t('emote.loadoutDesc', 'Pick up to {{max}} reactions for your in-game React bar.', { max: MAX_LOADOUT_SIZE })}</p>
        </div>
        <button
          onClick={onShop}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors"
        >
          {t('emote.buyMore', 'Buy more →')}
        </button>
      </div>

      {/* Equipped slots */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
        {slots.map((id, i) => {
          if (!id) {
            return (
              <div
                key={`empty-${i}`}
                className="h-14 rounded-xl border-2 border-dashed border-neutral-800 flex items-center justify-center text-neutral-700 text-xs"
              >
                {i + 1}
              </div>
            )
          }
          const em = getEmoteById(id)
          if (!em) return null
          return (
            <button
              key={id}
              onClick={() => removeFromLoadout(id)}
              title={`${em.name} — ${t('emote.tapToUnequip', 'tap to unequip')}`}
              className="h-14 rounded-xl bg-neutral-800 border border-neutral-700 hover:border-red-500/60 hover:bg-red-950/30 flex items-center justify-center text-3xl transition-colors"
            >
              {em.emoji}
            </button>
          )
        })}
      </div>

      {/* Collection */}
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">{t('emote.yourCollection', 'Your collection')}</p>
      <div className="space-y-4">
        {RARITY_ORDER.map((rarity) => {
          const list = owned[rarity]
          if (list.length === 0) return null
          return (
            <div key={rarity}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-2">
                {rarity === 'free' ? t('emote.rarityFree', 'Free') : rarity}
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {list.map((em) => {
                  const equipped = loadout.includes(em.id)
                  const full = !equipped && loadout.length >= MAX_LOADOUT_SIZE
                  return (
                    <EmoteTile
                      key={em.id}
                      emoji={em.emoji}
                      name={em.name}
                      rarity={em.rarity}
                      price={em.price}
                      owned
                      equipped={equipped}
                      disabled={full}
                      onClick={() => equipped ? removeFromLoadout(em.id) : addToLoadout(em.id)}
                      showPrice={false}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {save.isError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs">
          {t('emote.saveError', "Couldn't save loadout: {{error}}", { error: save.error.message })}
        </div>
      )}
    </div>
  )
}
