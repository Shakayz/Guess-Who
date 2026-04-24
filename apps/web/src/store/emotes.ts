import { create } from 'zustand'
import { DEFAULT_LOADOUT } from '@red-handed/shared'
import { api } from '../lib/api'

/**
 * Caches the player's owned emote ids + equipped loadout so the in-game
 * React bar doesn't blank out while /api/emotes/me is in flight. The store
 * is primed on login (via fetchMe) and re-seeded after every purchase /
 * loadout change so GamePage always reads fresh data without an extra fetch.
 */

type Me = {
  ownedIds: string[]
  loadout: string[]
  maxLoadout: number
}

type EmotesStore = {
  me: Me | null
  loading: boolean
  error: string | null
  fetchMe: () => Promise<void>
  // Apply a just-confirmed local mutation so the UI updates immediately
  // without waiting on a second round-trip.
  setLoadout: (ids: string[]) => void
  markOwned: (id: string) => void
  reset: () => void
}

const defaultMe: Me = {
  ownedIds: [...DEFAULT_LOADOUT],
  loadout: [...DEFAULT_LOADOUT],
  maxLoadout: 10,
}

export const useEmotesStore = create<EmotesStore>((set, get) => ({
  me: null,
  loading: false,
  error: null,

  async fetchMe() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await api.get<Me>('/emotes/me')
      set({ me: res, loading: false })
    } catch (err) {
      // Network errors shouldn't strand the UI — fall back to defaults so the
      // player can still send the free basics. The next refresh will retry.
      set({ me: defaultMe, loading: false, error: (err as Error).message })
    }
  },

  setLoadout(ids) {
    const me = get().me ?? defaultMe
    set({ me: { ...me, loadout: ids } })
  },

  markOwned(id) {
    const me = get().me ?? defaultMe
    if (me.ownedIds.includes(id)) return
    set({ me: { ...me, ownedIds: [...me.ownedIds, id] } })
  },

  reset() {
    set({ me: null, loading: false, error: null })
  },
}))
