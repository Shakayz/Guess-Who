import { create } from 'zustand'
import type { Room, Round, ChatMessage, RewardSummary } from '@red-handed/shared'
import { createLogger } from '../lib/logger'

const log = createLogger('game')

interface GameResult {
  winner: 'villagers' | 'red_handed'
  finalRound: Round
  rewards: RewardSummary
}

interface TwinPartner {
  twinUserId: string
  twinUsername: string
  twinRole: string
}

interface GameState {
  room: Room | null
  currentRound: Round | null
  completedRounds: Round[]
  myRole: string | null
  myWord: string | null
  myVillagerWord: string | null
  detectiveRevealUsed: boolean
  revealedPlayer: { userId: string; username: string; role: string } | null
  twinPartner: TwinPartner | null
  messages: ChatMessage[]
  result: GameResult | null
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  addCompletedRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string, villagerWord?: string) => void
  setDetectiveRevealUsed: () => void
  setRevealedPlayer: (player: { userId: string; username: string; role: string } | null) => void
  setTwinPartner: (partner: TwinPartner | null) => void
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
  twinPartner: null,
  messages: [],
  result: null,
  setRoom: (room) => {
    log.info('room set', { code: room.code, status: room.status })
    set({ room })
  },
  setRound: (round) => {
    log.info('round set', { roundNumber: round.roundNumber, id: round.id })
    set({ currentRound: round })
  },
  addCompletedRound: (round) =>
    set((s) => ({ completedRounds: [...s.completedRounds.slice(-19), round] })),
  setRoleAndWord: (myRole, myWord, myVillagerWord) => {
    log.info('role and word set', { role: myRole })
    set({ myRole, myWord, myVillagerWord: myVillagerWord ?? null })
  },
  setDetectiveRevealUsed: () => set({ detectiveRevealUsed: true }),
  setRevealedPlayer: (revealedPlayer) => set({ revealedPlayer }),
  setTwinPartner: (twinPartner) => {
    log.info('twin partner set', { twinPartner })
    set({ twinPartner })
  },
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages.slice(-99), msg] })),
  setResult: (result) => {
    log.info('game result set', { winner: result.winner })
    set({ result })
  },
  reset: () => {
    log.info('game state reset')
    set({
      room: null,
      currentRound: null,
      completedRounds: [],
      myRole: null,
      myWord: null,
      myVillagerWord: null,
      detectiveRevealUsed: false,
      revealedPlayer: null,
      twinPartner: null,
      messages: [],
      result: null,
    })
  },
}))
