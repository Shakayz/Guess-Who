// Central type surface for the achievement evaluator system. Keeping these
// isolated so evaluators can import from here without reaching back into the
// wider service graph.

import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'

export type IO = Server<ClientToServerEvents, ServerToClientEvents>

export type Difficulty = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'mythic'

export type Category =
  | 'gameplay'
  | 'red_handed'
  | 'detective'
  | 'social'
  | 'ranked'
  | 'milestones'
  | 'secret'
  | 'special_role'
  | 'economy'
  | 'meta'

export interface AchievementDef {
  key: string
  name: string
  description: string
  icon: string
  category: Category
  difficulty: Difficulty
  xpReward: number
  coinReward: number        // stored in DB as coinReward; exposed as "starsReward" in responses
  isSecret?: boolean
}

// Ordered bronze→mythic so the UI can sort cards deterministically.
export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  mythic: 5,
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventType =
  | 'game_end'
  | 'friend_added'
  | 'honor_given'
  | 'honor_received'
  | 'dm_sent'
  | 'gift_sent'
  | 'gift_received'
  | 'daily_login'
  | 'shop_purchase'
  | 'cosmetic_equipped'
  | 'word_pack_created'
  | 'avatar_changed'
  | 'level_up'
  | 'rank_changed'
  | 'achievement_unlocked'
  | 'achievement_claimed'

/** Per-user stats used by many evaluators. Built once per evaluateEvent call. */
export interface UserStats {
  // game counts
  totalGames: number
  totalWins: number
  totalRedHandedWins: number
  totalVillagerWins: number
  totalJesterWins: number
  survivedWins: number
  winsByRole: Record<string, number>
  gamesByRole: Record<string, number>
  // social
  friendCount: number
  honorGivenCount: number
  honorReceivedCount: number
  distinctHonorGivers: number
  dmSentCount: number
  giftSentCount: number
  giftReceivedCount: number
  // economy
  starCoinsCurrent: number
  shopPurchaseCount: number
  cosmeticOwnedCount: number
  // ranked
  rankedGames: number
  rankedWins: number
  rankTier: string
  rankPoints: number
  // meta
  achievementsUnlockedCount: number
  achievementsClaimedCount: number
  // misc
  dailyStreakCount: number
  wordPacksCreated: number
  languagesPlayed: number
  distinctWordPacks: number
}

interface BaseCtx {
  type: EventType
  userId: string
  now: Date
  stats: UserStats
}

export interface GameEndCtx extends BaseCtx {
  type: 'game_end'
  gameId: string | null
  role: string
  survived: boolean
  isWinner: boolean
  isRedHanded: boolean
  winner: 'villagers' | 'red_handed' | 'jester' | 'evil_twins' | 'draw'
  gameMode: 'normal' | 'special' | 'ranked'
  playerCount: number
  language: string
}

export interface SocialCtx extends BaseCtx {
  type: 'friend_added' | 'honor_given' | 'honor_received' | 'dm_sent' | 'gift_sent' | 'gift_received'
  otherUserId?: string
}

export interface DailyLoginCtx extends BaseCtx {
  type: 'daily_login'
  newStreakCount: number
}

export interface ShopCtx extends BaseCtx {
  type: 'shop_purchase' | 'cosmetic_equipped'
  cosmeticId?: string
  pricePaid?: number
}

export interface SimpleCtx extends BaseCtx {
  type:
    | 'word_pack_created'
    | 'avatar_changed'
    | 'level_up'
    | 'rank_changed'
    | 'achievement_unlocked'
    | 'achievement_claimed'
  newLevel?: number
  newTier?: string
}

export type EventContext = GameEndCtx | SocialCtx | DailyLoginCtx | ShopCtx | SimpleCtx

export interface Evaluator {
  key: string
  event: EventType
  check: (ctx: EventContext) => boolean | Promise<boolean>
}
