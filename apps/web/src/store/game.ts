import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Room, Round, ChatMessage, RewardSummary, WordCategory } from '@red-handed/shared'
import { createLogger } from '../lib/logger'

const log = createLogger('game')

interface GameResult {
  winner: 'villagers' | 'red_handed' | 'jester' | 'evil_twins' | 'draw'
  finalRound: Round
  rewards: RewardSummary
}

interface TwinPartner {
  twinUserId: string
  twinUsername: string
  twinRole: string
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
  myCategory: WordCategory | null
  detectiveRevealUsed: boolean
  guardianProtectUsed: boolean
  guardianProtectedPlayer: { userId: string; username: string } | null
  /** Mayor: double-vote permanently consumed for this game */
  mayorDoubleVoteUsed: boolean
  /** Mayor: double-vote active for the current voting phase (resets at round end) */
  mayorDoubleActive: boolean
  /** Inverter: tally-flip permanently consumed for this game */
  inverterUsed: boolean
  /** Inverter: flip active for the current voting phase (resets at round end) */
  inverterActive: boolean
  /** Corruptor: userId of picked target (one-shot, for the whole game) */
  corruptorTargetUserId: string | null
  /** Twin partner info (set once at game:started via twin:partner event) */
  twinPartner: TwinPartner | null
  /** Revenant: post-mortem votes remaining (sent by server on elimination) */
  revenantVotesRemaining: number
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
  setRoleAndWord: (role: string, word: string, villagerWord?: string, category?: WordCategory) => void
  setDetectiveRevealUsed: () => void
  setGuardianProtectUsed: (target: { userId: string; username: string }) => void
  setGuardianProtectedPlayer: (p: { userId: string; username: string } | null) => void
  setMayorDoubleActive: () => void
  resetMayorDoubleActive: () => void
  setInverterActive: () => void
  resetInverterActive: () => void
  setCorruptorTarget: (userId: string) => void
  setTwinPartner: (partner: TwinPartner | null) => void
  setRevenantVotesRemaining: (n: number) => void
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
      myCategory: null,
      detectiveRevealUsed: false,
      guardianProtectUsed: false,
      guardianProtectedPlayer: null,
      mayorDoubleVoteUsed: false,
      mayorDoubleActive: false,
      inverterUsed: false,
      inverterActive: false,
      corruptorTargetUserId: null,
      twinPartner: null,
      revenantVotesRemaining: 0,
      revealedPlayer: null,
      messages: [],
      result: null,
      gameFinished: false,
      lastResetAt: 0,
      setRoom: (room) => {
        log.info('room set', { code: room.code, status: room.status })
        set({ room })
      },
      setRound: (round) => {
        log.info('round set', { roundNumber: round.roundNumber, id: round.id })
        set({ currentRound: round })
      },
      addCompletedRound: (round) => set((s) => ({
        completedRounds: [...s.completedRounds, round].slice(-20),
      })),
      setRoleAndWord: (myRole, myWord, villagerWord, category) => {
        log.info('role and word set', { role: myRole })
        set({ myRole, myWord, myVillagerWord: villagerWord ?? null, myCategory: category ?? null })
      },
      setDetectiveRevealUsed: () => set({ detectiveRevealUsed: true }),
      setGuardianProtectUsed: (target) => set({ guardianProtectUsed: true, guardianProtectedPlayer: target }),
      setGuardianProtectedPlayer: (guardianProtectedPlayer) => set({ guardianProtectedPlayer }),
      setMayorDoubleActive: () => set({ mayorDoubleVoteUsed: true, mayorDoubleActive: true }),
      resetMayorDoubleActive: () => set({ mayorDoubleActive: false }),
      setInverterActive: () => set({ inverterUsed: true, inverterActive: true }),
      resetInverterActive: () => set({ inverterActive: false }),
      setCorruptorTarget: (corruptorTargetUserId) => set({ corruptorTargetUserId }),
      setTwinPartner: (twinPartner) => set({ twinPartner }),
      setRevenantVotesRemaining: (revenantVotesRemaining) => set({ revenantVotesRemaining }),
      setRevealedPlayer: (revealedPlayer) => set({ revealedPlayer }),
      addMessage: (msg) => set((s) => {
        const msgs = s.messages.length >= 100
          ? [...s.messages.slice(-99), msg]
          : [...s.messages, msg]
        return { messages: msgs }
      }),
      setResult: (result) => {
        log.info('game result set', { winner: result.winner })
        set({ result, gameFinished: true })
      },
      setGameFinished: (gameFinished) => set({ gameFinished }),
      reset: () => {
        log.info('game state reset')
        set({ room: null, currentRound: null, completedRounds: [], myRole: null, myWord: null, myVillagerWord: null, myCategory: null, detectiveRevealUsed: false, guardianProtectUsed: false, guardianProtectedPlayer: null, mayorDoubleVoteUsed: false, mayorDoubleActive: false, inverterUsed: false, inverterActive: false, corruptorTargetUserId: null, twinPartner: null, revenantVotesRemaining: 0, revealedPlayer: null, messages: [], result: null, gameFinished: false, lastResetAt: Date.now() })
      },
    }),
    {
      name: 'red-handed',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist fields needed to survive a page refresh
      partialize: (state) => ({
        room: state.room,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
        myRole: state.myRole,
        myWord: state.myWord,
        myVillagerWord: state.myVillagerWord,
        myCategory: state.myCategory,
        detectiveRevealUsed: state.detectiveRevealUsed,
        guardianProtectUsed: state.guardianProtectUsed,
        mayorDoubleVoteUsed: state.mayorDoubleVoteUsed,
        mayorDoubleActive: state.mayorDoubleActive,
        inverterUsed: state.inverterUsed,
        inverterActive: state.inverterActive,
        corruptorTargetUserId: state.corruptorTargetUserId,
        twinPartner: state.twinPartner,
        revenantVotesRemaining: state.revenantVotesRemaining,
        result: state.result,
        gameFinished: state.gameFinished,
        lastResetAt: state.lastResetAt,
      }),
    },
  ),
)
