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
}

interface MatchmakingStore {
  isSearching: boolean
  // `topMode` is what the user picked on the home screen (normal / ranked); used
  // for the banner label and for emitting `matchmaking:leave` with the right key.
  topMode: MatchmakingTopMode | null
  // `gameMode` is what we actually sent to the server (normal / special / ranked).
  gameMode: MatchmakingGameMode | null
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
  status: initialStatus,
  requiredStars: null,
  errorMessage: null,
  startSearch: ({ topMode, gameMode }) =>
    set({
      isSearching: true,
      topMode,
      gameMode,
      status: initialStatus,
      requiredStars: null,
      errorMessage: null,
    }),
  setStatus: (status) => set({ status }),
  stopSearch: () =>
    set({ isSearching: false, topMode: null, gameMode: null, status: initialStatus }),
  setRequiredStars: (n) => set({ requiredStars: n }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
}))
