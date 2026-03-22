import { create } from 'zustand'
import type { Room, Round, ChatMessage, RewardSummary } from '@imposter/shared'

interface GameResult {
  winner: 'villagers' | 'imposters'
  finalRound: Round
  rewards: RewardSummary
}

interface GameState {
  room: Room | null
  currentRound: Round | null
  myRole: string | null
  myWord: string | null
  messages: ChatMessage[]
  result: GameResult | null
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string) => void
  addMessage: (msg: ChatMessage) => void
  setResult: (result: GameResult) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  room: null,
  currentRound: null,
  myRole: null,
  myWord: null,
  messages: [],
  result: null,
  setRoom: (room) => set({ room }),
  setRound: (round) => set({ currentRound: round }),
  setRoleAndWord: (myRole, myWord) => set({ myRole, myWord }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setResult: (result) => set({ result }),
  reset: () => set({ room: null, currentRound: null, myRole: null, myWord: null, messages: [], result: null }),
}))
