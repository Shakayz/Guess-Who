import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Room, Round, ChatMessage, RewardSummary, WordCategory } from '@red-handed/shared'
import { createLogger } from '../lib/logger'

const log = createLogger('game')

interface GameResult {
  winner: 'villagers' | 'red_handed' | 'draw' | 'jester' | 'evil_twins'
  finalRound: Round
  rewards: RewardSummary
}

interface TwinPartner {
  twinUserId: string
  twinUsername: string
  twinRole: string
}

export interface TwinChatMessage {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
}

interface KamikazePrompt {
  candidateUserIds: string[]
  kamikazeUserId: string
  kamikazeUsername: string
  timeSeconds: number
}

interface GameState {
  room: Room | null
  currentRound: Round | null
  completedRounds: Round[]
  myRole: string | null
  myWord: string | null
  myVillagerWord: string | null
  myCategory: WordCategory | null
  detectiveRevealUsed: boolean
  revealedPlayer: { userId: string; username: string; role: string } | null
  twinPartner: TwinPartner | null
  /** Evil Twins private DM log — stored only for the two twins. */
  twinMessages: TwinChatMessage[]
  /** Unread counter for the twin DM — cleared when the chat panel opens. */
  twinUnread: number
  /** Corruptor: locked-in target userId (one-shot per game) */
  corruptorTargetUserId: string | null
  /** Kamikaze post-death picker prompt, or null when not pending */
  kamikazePrompt: KamikazePrompt | null
  /** Mayor: double-vote permanently consumed for this game */
  mayorDoubleVoteUsed: boolean
  /** Mayor: double-vote active for the current voting phase */
  mayorDoubleActive: boolean
  /** Inverter: tally-flip permanently consumed for this game */
  inverterUsed: boolean
  /** Inverter: flip active for the current voting phase */
  inverterActive: boolean
  /** Guardian: protection permanently consumed for this game */
  guardianProtectUsed: boolean
  /** Guardian: last protected player for 5s banner */
  guardianProtectedPlayer: { userId: string; username: string } | null
  messages: ChatMessage[]
  result: GameResult | null
  setRoom: (room: Room) => void
  setRound: (round: Round) => void
  addCompletedRound: (round: Round) => void
  setRoleAndWord: (role: string, word: string, villagerWord?: string, category?: WordCategory) => void
  setDetectiveRevealUsed: () => void
  setRevealedPlayer: (player: { userId: string; username: string; role: string } | null) => void
  setTwinPartner: (partner: TwinPartner | null) => void
  addTwinMessage: (msg: TwinChatMessage, opts?: { incrementUnread?: boolean }) => void
  clearTwinUnread: () => void
  setCorruptorTarget: (userId: string) => void
  setKamikazePrompt: (prompt: KamikazePrompt | null) => void
  setMayorDoubleActive: () => void
  resetMayorDoubleActive: () => void
  setInverterActive: () => void
  resetInverterActive: () => void
  setGuardianProtectUsed: (target: { userId: string; username: string }) => void
  setGuardianProtectedPlayer: (player: { userId: string; username: string } | null) => void
  addMessage: (msg: ChatMessage) => void
  setResult: (result: GameResult) => void
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
  myCategory: null,
  detectiveRevealUsed: false,
  revealedPlayer: null,
  twinPartner: null,
  twinMessages: [],
  twinUnread: 0,
  corruptorTargetUserId: null,
  kamikazePrompt: null,
  mayorDoubleVoteUsed: false,
  mayorDoubleActive: false,
  inverterUsed: false,
  inverterActive: false,
  guardianProtectUsed: false,
  guardianProtectedPlayer: null,
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
  setRoleAndWord: (myRole, myWord, myVillagerWord, myCategory) => {
    log.info('role and word set', { role: myRole })
    set({ myRole, myWord, myVillagerWord: myVillagerWord ?? null, myCategory: myCategory ?? null })
  },
  setDetectiveRevealUsed: () => set({ detectiveRevealUsed: true }),
  setRevealedPlayer: (revealedPlayer) => set({ revealedPlayer }),
  setTwinPartner: (twinPartner) => {
    log.info('twin partner set', { twinPartner })
    set({ twinPartner })
  },
  addTwinMessage: (msg, opts) => set((s) => {
    const deduped = s.twinMessages.some((m) => m.id === msg.id)
      ? s.twinMessages
      : [...s.twinMessages.slice(-199), msg]
    return {
      twinMessages: deduped,
      twinUnread: opts?.incrementUnread ? s.twinUnread + 1 : s.twinUnread,
    }
  }),
  clearTwinUnread: () => set({ twinUnread: 0 }),
  setCorruptorTarget: (corruptorTargetUserId) => set({ corruptorTargetUserId }),
  setKamikazePrompt: (kamikazePrompt) => set({ kamikazePrompt }),
  setMayorDoubleActive: () => set({ mayorDoubleVoteUsed: true, mayorDoubleActive: true }),
  resetMayorDoubleActive: () => set({ mayorDoubleActive: false }),
  setInverterActive: () => set({ inverterUsed: true, inverterActive: true }),
  resetInverterActive: () => set({ inverterActive: false }),
  setGuardianProtectUsed: (target) => set({ guardianProtectUsed: true, guardianProtectedPlayer: target }),
  setGuardianProtectedPlayer: (guardianProtectedPlayer) => set({ guardianProtectedPlayer }),
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
      myCategory: null,
      detectiveRevealUsed: false,
      revealedPlayer: null,
      twinPartner: null,
      twinMessages: [],
      twinUnread: 0,
      corruptorTargetUserId: null,
      kamikazePrompt: null,
      mayorDoubleVoteUsed: false,
      mayorDoubleActive: false,
      inverterUsed: false,
      inverterActive: false,
      guardianProtectUsed: false,
      guardianProtectedPlayer: null,
      messages: [],
      result: null,
    })
  },
    }),
    {
      name: 'red-handed-game',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        room: state.room,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
        myRole: state.myRole,
        myWord: state.myWord,
        myVillagerWord: state.myVillagerWord,
        myCategory: state.myCategory,
        detectiveRevealUsed: state.detectiveRevealUsed,
        revealedPlayer: state.revealedPlayer,
        twinPartner: state.twinPartner,
        twinMessages: state.twinMessages,
        corruptorTargetUserId: state.corruptorTargetUserId,
        mayorDoubleVoteUsed: state.mayorDoubleVoteUsed,
        mayorDoubleActive: state.mayorDoubleActive,
        inverterUsed: state.inverterUsed,
        inverterActive: state.inverterActive,
        guardianProtectUsed: state.guardianProtectUsed,
        result: state.result,
      }),
    },
  ),
)
