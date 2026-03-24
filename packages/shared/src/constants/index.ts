export const RANK_TIERS = ['wooden', 'bronze', 'silver', 'gold', 'diamond', 'master', 'grandmaster'] as const

export const RANK_CONFIG = {
  wooden:      { label: 'Wooden',      color: '#8B6914', icon: '🪵', lpRequired: 100 },
  bronze:      { label: 'Bronze',      color: '#CD7F32', icon: '🥉', lpRequired: 200 },
  silver:      { label: 'Silver',      color: '#C0C0C0', icon: '🥈', lpRequired: 300 },
  gold:        { label: 'Gold',        color: '#FFD700', icon: '🥇', lpRequired: 400 },
  diamond:     { label: 'Diamond',     color: '#B9F2FF', icon: '💎', lpRequired: 500 },
  master:      { label: 'Master',      color: '#9B59B6', icon: '👑', lpRequired: 600 },
  grandmaster: { label: 'Grandmaster', color: '#E74C3C', icon: '🌌', lpRequired: Infinity },
} as const

export const HONOR_TYPES = ['teamplayer', 'sharp_mind', 'good_sport'] as const

export const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'de'] as const

export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 10,
  minPlayers: 4,
  imposterCount: 2,
  speakingTimeSeconds: 30,
  votingTimeSeconds: 30,
  wordPackId: 'default',
  isPrivate: false,
  language: 'en',
  gameMode: 'normal',
  categories: [],
} as const

export const COIN_REWARDS = {
  WIN_VILLAGER: 50,
  WIN_IMPOSTER: 80,
  CORRECT_VOTE: 20,
  PERFECT_IMPOSTER: 100,
  DAILY_LOGIN: 10,
} as const

export const GOLD_COIN_PACKS = [
  { id: 'pack_100',  amount: 100,  price: 0.99,  bonus: 0 },
  { id: 'pack_550',  amount: 550,  price: 4.99,  bonus: 50 },
  { id: 'pack_1200', amount: 1200, price: 9.99,  bonus: 200 },
] as const

export const LP_DECAY = {
  /** Days of inactivity before decay begins */
  INACTIVITY_DAYS: 7,
  /** LP lost per decay tick (daily job) */
  DECAY_AMOUNT: 5,
  /** Minimum LP at which no further decay is applied */
  MINIMUM_LP: 0,
  /** Tiers exempt from decay (Wooden never decays) */
  EXEMPT_TIERS: ['wooden'] as string[],
} as const
