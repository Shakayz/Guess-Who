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

export const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'de', 'it', 'pt', 'zh', 'ru', 'hi'] as const

export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 10,
  minPlayers: 3,
  redHandedCount: 2,
  speakingTimeSeconds: 30,
  votingTimeSeconds: 30,
  wordPackId: 'default',
  isPrivate: false,
  language: 'en',
  gameMode: 'normal',
  categories: [],
} as const

// Bounds for the per-player "speak out loud" turn timer used when vocal mode is on.
export const VOCAL_SPEAKING_TIME_DEFAULT = 10
export const VOCAL_SPEAKING_TIME_MIN     = 5
export const VOCAL_SPEAKING_TIME_MAX     = 60
export const VOCAL_SPEAKING_TIME_STEP    = 5

export const COIN_REWARDS = {
  WIN_VILLAGER: 50,
  WIN_RED_HANDED: 80,
  CORRECT_VOTE: 20,
  PERFECT_RED_HANDED: 100,
  DAILY_LOGIN: 10,
} as const

/**
 * One-time star-coin reward granted the first time a player finishes the
 * interactive walkthrough (POST /api/tutorial/complete). Single source of
 * truth for both the server (which grants the stars) and the web UI
 * (which renders the "earn +N ⭐" CTAs and banners).
 */
export const TUTORIAL_COMPLETION_REWARD = 40

/**
 * Star-coin balance handed out when a new account is created. Accounts begin
 * unverified and stay on this balance until the player confirms their email
 * (POST /api/auth/email/verify-code), at which point EMAIL_VERIFICATION_REWARD
 * is credited once. Kept in /shared so the schema default, the web signup
 * UI, and tests stay aligned.
 */
export const INITIAL_STAR_COINS = 20

/**
 * One-time star-coin reward granted the first time a player confirms their
 * email address via the 6-digit code flow. Paired with INITIAL_STAR_COINS —
 * a verified account ends up at INITIAL_STAR_COINS + EMAIL_VERIFICATION_REWARD
 * star coins (20 + 40 = 60 today).
 */
export const EMAIL_VERIFICATION_REWARD = 40

/** Minutes the 6-digit email verification code stays valid. */
export const EMAIL_VERIFICATION_CODE_TTL_MINUTES = 15

/**
 * Star-coin cost charged when a player renames themselves via PATCH /api/users/me.
 * The cost is only debited when the new username actually differs from the
 * current one (a no-op patch with the same value stays free so clients can
 * re-submit without penalty). Kept in /shared so the API, the web rename
 * prompt, and tests stay aligned on the price tag.
 */
export const USERNAME_CHANGE_COST = 500

/**
 * Referral rewards granted once per invitee on their first successful signup
 * that references an inviter's code. The inviter gets the larger share because
 * they are the one doing the acquisition work; the invitee gets a smaller
 * welcome bonus on top of INITIAL_STAR_COINS. Both are credited atomically
 * when the referral is confirmed so concurrent signups can't double-credit.
 */
export const REFERRAL_INVITER_REWARD = 50
export const REFERRAL_INVITEE_REWARD = 20

/**
 * One-time star-coin reward granted the first time a player uses the in-app
 * "Share on social media" button (ReferralCard). External shares can't be
 * verified (no social platform exposes a "did user X post URL Y" API), so
 * the claim is trust-on-click — but capped at once per account via the
 * `sharedAppAt` timestamp on User. The atomic updateMany guard prevents
 * concurrent double-credit. Kept in /shared so the API and the CTA copy on
 * the web UI stay aligned on the amount.
 */
export const SOCIAL_SHARE_REWARD = 50

/**
 * Star-coin packs listed in the Shop. `priceCents` is the authoritative price
 * used to stamp the Purchase row and drive analytics; the Stripe Price ID is
 * read from env vars (STRIPE_PRICE_ID_PACK_*) at checkout time so test/live
 * modes can carry different IDs without a rebuild. `bonus` is additive — a
 * purchase credits `amount + bonus` star coins.
 */
export type CoinPack = {
  id: string
  amount: number
  priceCents: number
  currency: string
  bonus: number
}

export const COIN_PACKS: readonly CoinPack[] = [
  { id: 'pack_500',  amount: 500,  priceCents: 199,  currency: 'eur', bonus: 0 },
  { id: 'pack_1500', amount: 1500, priceCents: 499,  currency: 'eur', bonus: 150 },
  { id: 'pack_5000', amount: 5000, priceCents: 1499, currency: 'eur', bonus: 750 },
] as const

/**
 * In-app product IDs declared in App Store Connect and Google Play Console.
 * Apple and Google require digital goods to be sold through their own IAP
 * systems, so the mobile app goes through StoreKit / Play Billing instead of
 * Stripe. The same pack `id` is reused as the key so the backend can map a
 * verified purchase back to a COIN_PACK without extra lookup tables.
 *
 * Naming convention — reverse-dns bundle id + pack id:
 *   com.redhanded.game.pack_500
 * Keep these strings in lockstep with the store listings; if you rename a
 * product in App Store Connect or Google Play, update this file too.
 */
export const IAP_PRODUCT_IDS = {
  // Consumable star-coin packs — one-time purchases that credit coins.
  coins: {
    pack_500:  'com.redhanded.game.pack_500',
    pack_1500: 'com.redhanded.game.pack_1500',
    pack_5000: 'com.redhanded.game.pack_5000',
  },
  // Auto-renewing subscriptions — Premium (no ads, unlimited games).
  subscriptions: {
    premium_monthly: 'com.redhanded.game.premium.monthly',
    premium_yearly:  'com.redhanded.game.premium.yearly',
  },
  // Non-consumable season pass unlock — grants Premium tier rewards for the
  // current season only.
  nonConsumables: {
    season_pass: 'com.redhanded.game.season_pass',
  },
} as const

export type IapProductId =
  | (typeof IAP_PRODUCT_IDS.coins)[keyof typeof IAP_PRODUCT_IDS.coins]
  | (typeof IAP_PRODUCT_IDS.subscriptions)[keyof typeof IAP_PRODUCT_IDS.subscriptions]
  | (typeof IAP_PRODUCT_IDS.nonConsumables)[keyof typeof IAP_PRODUCT_IDS.nonConsumables]

/** Resolve a COIN_PACK from a mobile IAP product id (returns undefined for non-coin SKUs). */
export function coinPackFromIapProductId(productId: string): CoinPack | undefined {
  const entries = Object.entries(IAP_PRODUCT_IDS.coins) as [keyof typeof IAP_PRODUCT_IDS.coins, string][]
  const match = entries.find(([, id]) => id === productId)
  if (!match) return undefined
  return COIN_PACKS.find((p) => p.id === match[0])
}

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

export const MATCHMAKING_CONFIG = {
  IDEAL_PLAYERS: 10,
  MIN_PLAYERS: 3,
  RANKED_PLAYERS: 10,
  MAX_WAIT_SECONDS: 45,
  TICK_INTERVAL_MS: 1000,
  THRESHOLDS: [
    { after:  0, minPlayers: 10 },
    { after: 15, minPlayers:  8 },
    { after: 25, minPlayers:  5 },
    { after: 35, minPlayers:  3 },
  ],
} as const

export const LP_REWARDS = {
  // ── Villager team ────────────────────────────────────────────────────────────
  VILLAGER_WIN:            18,
  VILLAGER_LOSS:          -15,
  // ── RedHanded team ────────────────────────────────────────────────────────────
  RED_HANDED_WIN:            25,  // rôle plus dur → récompense plus haute
  RED_HANDED_LOSS:           -8,  // pénalité réduite pour compenser la difficulté
  // ── Survival win (redHanded survivent tous les rounds) ───────────────────────
  SURVIVAL_RED_HANDED_WIN:   20,
  SURVIVAL_VILLAGER_LOSS: -12,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Levelling system — lifetime XP awarded after every game (ranked or not)
// ─────────────────────────────────────────────────────────────────────────────

/** Hard cap on player level. */
export const LEVEL_CAP = 1000

/**
 * XP rewards added to the player's lifetime XP at the end of each game.
 * Forfeited players get nothing.
 */
export const XP_REWARDS = {
  WIN:               100,
  LOSS:               40,
  DRAW:               60,
  SURVIVAL_BONUS:     20,  // bonus added if the player survived to the end
  FORFEIT:             0,
} as const

/**
 * XP required to advance FROM `level` TO `level + 1`.
 * Linear curve: each level needs 50 more XP than the previous one.
 *   level 1 → 2  : 100 XP
 *   level 2 → 3  : 150 XP
 *   level 10 → 11: 550 XP
 *   level 100 → 101: 5050 XP
 *   level 999 → 1000: 50000 XP
 * Total to reach level 1000 ≈ 25M XP (≈ hundreds of thousands of games).
 */
export function xpForLevel(level: number): number {
  if (level < 1) return 100
  if (level >= LEVEL_CAP) return Infinity
  return 100 + (level - 1) * 50
}

/** Total cumulative XP needed to reach `level` (from level 1 = 0 XP). */
export function totalXpToReach(level: number): number {
  if (level <= 1) return 0
  if (level > LEVEL_CAP) level = LEVEL_CAP
  // Sum of arithmetic series: n * (a1 + an) / 2 where a_i = xpForLevel(i)
  const n = level - 1
  const a1 = xpForLevel(1)
  const an = xpForLevel(level - 1)
  return Math.floor((n * (a1 + an)) / 2)
}

/** Compute the level corresponding to a given lifetime XP amount. */
export function levelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1
  let level = 1
  let cumulative = 0
  while (level < LEVEL_CAP) {
    const needed = xpForLevel(level)
    if (cumulative + needed > totalXp) return level
    cumulative += needed
    level++
  }
  return LEVEL_CAP
}

/**
 * XP progression within the current level.
 *   level   — the player's current level (1..LEVEL_CAP)
 *   current — XP accumulated since the start of this level
 *   needed  — XP required to reach the next level
 *   total   — original lifetime XP value (echoed back for convenience)
 */
export function xpProgressInLevel(totalXp: number): {
  level: number
  current: number
  needed: number
  total: number
} {
  const level = levelFromXp(totalXp)
  const cumulativeForLevel = totalXpToReach(level)
  const current = totalXp - cumulativeForLevel
  const needed = xpForLevel(level)
  return { level, current, needed, total: totalXp }
}

/**
 * Level milestones that unlock achievements. Keep in sync with seed.ts.
 */
export const LEVEL_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000] as const
