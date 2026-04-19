import { create } from 'zustand'
import { DEFAULT_LOADOUT } from '@red-handed/shared'
import { api } from '../lib/api'

/**
 * Mirrors apps/web/src/store/emotes.ts one-for-one. Primed on login so the
 * React bar on the game screen has the latest loadout even if the fetch
 * hasn't completed by the time the player drops into a match.
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
