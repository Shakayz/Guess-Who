import { create } from 'zustand'
import { MATCHMAKING_CONFIG } from '@red-handed/shared'
import type { MatchmakingStatus, WordCategory } from '@red-handed/shared'

export type MatchmakingGameMode = 'normal' | 'special' | 'ranked'
export type MatchmakingTopMode = 'normal' | 'ranked'

export interface StartSearchPayload {
  topMode: MatchmakingTopMode
  gameMode: MatchmakingGameMode
  categories: WordCategory[]
  vocalMode: boolean
  // Locale is captured at search start so the reconnect replay lands the
  // player in the same queue bucket even if they flip the language flag.
  locale: string
  vocalSpeakingTimeSeconds?: number
}

interface MatchmakingStore {
  isSearching: boolean
  topMode: MatchmakingTopMode | null
  gameMode: MatchmakingGameMode | null
  // Kept so MatchmakingManager can replay `matchmaking:join` when the socket
  // reconnects after a drop (app backgrounded, flaky wifi) — without it the
  // banner would keep spinning while the server had silently evicted us.
  joinPayload: StartSearchPayload | null
  status: MatchmakingStatus
  requiredStars: number | null
  errorMessage: string | null
  startSearch: (payload: StartSearchPayload) => void
  setStatus: (status: MatchmakingStatus) => void
  stopSearch: () => void
  setRequiredStars: (n: number | null) => void
  setErrorMessage: (msg: string | null) => void
}

const initialStatus: MatchmakingStatus = {
  queueSize: 1,
  needed: MATCHMAKING_CONFIG.IDEAL_PLAYERS,
  elapsed: 0,
  maxWait: MATCHMAKING_CONFIG.MAX_WAIT_SECONDS,
  idealPlayers: MATCHMAKING_CONFIG.IDEAL_PLAYERS,
}

export const useMatchmakingStore = create<MatchmakingStore>((set) => ({
  isSearching: false,
  topMode: null,
  gameMode: null,
  joinPayload: null,
  status: initialStatus,
  requiredStars: null,
  errorMessage: null,
  startSearch: (payload) =>
    set({
      isSearching: true,
      topMode: payload.topMode,
      gameMode: payload.gameMode,
      joinPayload: payload,
      status: initialStatus,
      requiredStars: null,
      errorMessage: null,
    }),
  setStatus: (status) => set({ status }),
  stopSearch: () =>
    set({
      isSearching: false,
      topMode: null,
      gameMode: null,
      joinPayload: null,
      status: initialStatus,
    }),
  setRequiredStars: (n) => set({ requiredStars: n }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
}))
