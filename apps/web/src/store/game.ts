import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Room, Round, ChatMessage, RewardSummary } from '@imposter/shared'

interface GameResult {
  winner: 'villagers' | 'imposters' | 'draw'
  finalRound: Round
  rewards: RewardSummary
}

interface RevealedPlayer {
  userId: string
  username: string
  role: string
}

interface GameState {
  room: Room | null
  currentRound: Round | null
  completedRounds: Round[]
  myRole: string | null
  myWord: string | null
  myVillagerWord: string | null
  detectiveRevealUsed: boolean
  revealedPlayer: RevealedPlayer | null
  messages: ChatMessage[]
  result: GameResult | null
  /** Tracks whether the game result has been acknowledged (player left results page) */
  gameFinished: boolean
  /** Timestamp of last reset — prevents ActiveGameRestorer from immediately re-populating */
  lastResetAt: number
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  addCompletedRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string, villagerWord?: string) => void
  setDetectiveRevealUsed: () => void
  setRevealedPlayer: (p: RevealedPlayer | null) => void
  addMessage: (msg: ChatMessage) => void
  setResult: (result: GameResult) => void
  setGameFinished: (finished: boolean) => void
  reset: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      room: null,
      currentRound: null,
      completedRounds: [],
      myRole: null,
      myWord: null,
      myVillagerWord: null,
      detectiveRevealUsed: false,
      revealedPlayer: null,
      messages: [],
      result: null,
      gameFinished: false,
      lastResetAt: 0,
      setRoom: (room) => set({ room }),
      setRound: (round) => set({ currentRound: round }),
      addCompletedRound: (round) => set((s) => ({
        completedRounds: [...s.completedRounds, round].slice(-20),
      })),
      setRoleAndWord: (myRole, myWord, villagerWord) => set({ myRole, myWord, myVillagerWord: villagerWord ?? null }),
      setDetectiveRevealUsed: () => set({ detectiveRevealUsed: true }),
      setRevealedPlayer: (revealedPlayer) => set({ revealedPlayer }),
      addMessage: (msg) => set((s) => {
        const msgs = s.messages.length >= 100
          ? [...s.messages.slice(-99), msg]
          : [...s.messages, msg]
        return { messages: msgs }
      }),
      setResult: (result) => set({ result, gameFinished: true }),
      setGameFinished: (gameFinished) => set({ gameFinished }),
      reset: () => set({ room: null, currentRound: null, completedRounds: [], myRole: null, myWord: null, myVillagerWord: null, detectiveRevealUsed: false, revealedPlayer: null, messages: [], result: null, gameFinished: false, lastResetAt: Date.now() }),
    }),
    {
      name: 'imposter-game',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist fields needed to survive a page refresh
      partialize: (state) => ({
        room: state.room,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
        myRole: state.myRole,
        myWord: state.myWord,
        myVillagerWord: state.myVillagerWord,
        detectiveRevealUsed: state.detectiveRevealUsed,
        result: state.result,
        gameFinished: state.gameFinished,
        lastResetAt: state.lastResetAt,
      }),
    },
  ),
)
