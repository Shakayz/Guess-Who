import { create } from 'zustand'
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
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  addCompletedRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string, villagerWord?: string) => void
  setDetectiveRevealUsed: () => void
  setRevealedPlayer: (p: RevealedPlayer | null) => void
  addMessage: (msg: ChatMessage) => void
  setResult: (result: GameResult) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
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
  setResult: (result) => set({ result }),
  reset: () => set({ room: null, currentRound: null, completedRounds: [], myRole: null, myWord: null, myVillagerWord: null, detectiveRevealUsed: false, revealedPlayer: null, messages: [], result: null }),
}))
