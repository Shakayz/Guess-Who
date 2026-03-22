import { create } from 'zustand'
import type { Room, Player, Round, ChatMessage } from '@imposter/shared'

interface GameState {
  room: Room | null
  currentRound: Round | null
  myRole: string | null
  myWord: string | null
  messages: ChatMessage[]
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string) => void
  addMessage: (msg: ChatMessage) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  room: null,
  currentRound: null,
  myRole: null,
  myWord: null,
  messages: [],
  setRoom: (room) => set({ room }),
  setRound: (round) => set({ currentRound: round }),
  setRoleAndWord: (myRole, myWord) => set({ myRole, myWord }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  reset: () => set({ room: null, currentRound: null, myRole: null, myWord: null, messages: [] }),
}))
