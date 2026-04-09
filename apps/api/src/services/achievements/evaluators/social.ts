// Social achievement evaluators — friends, honors, DMs, gifts. Each one
// listens on its own event type so adding a friend immediately unlocks the
// friend achievement rather than waiting for a game to end.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, TIERS_6, TIERS_5, TIERS_4, merge, progression, single } from './_helpers'

// ─── FRIENDS ────────────────────────────────────────────────────────────────

const friendProgression = progression({
  keyPrefix: 'friends',
  category: 'social',
  icon: '🤝',
  name: (n) => n === 1 ? 'First Friend' : `${n} Friends`,
  description: (n) => n === 1 ? 'Add your first friend' : `Make ${n} friends`,
  event: 'friend_added',
  getCount: (s) => s.friendCount,
  tiers: TIERS_6([1, 5, 20, 50, 150, 500]),
})

// ─── HONORS (given) ─────────────────────────────────────────────────────────

const honorGivenProgression = progression({
  keyPrefix: 'honor_given',
  category: 'social',
  icon: '💝',
  name: (n) => n === 1 ? 'First Kindness' : `${n} Honors Given`,
  description: (n) => n === 1 ? 'Give your first honor' : `Give ${n} honors to other players`,
  event: 'honor_given',
  getCount: (s) => s.honorGivenCount,
  tiers: TIERS_5([1, 10, 50, 200, 1000]),
})

// ─── HONORS (received) ──────────────────────────────────────────────────────

const honorReceivedProgression = progression({
  keyPrefix: 'honor_received',
  category: 'social',
  icon: '💖',
  name: (n) => n === 1 ? 'Appreciated' : `${n} Honors Received`,
  description: (n) => n === 1 ? 'Receive your first honor' : `Receive ${n} honors from other players`,
  event: 'honor_received',
  getCount: (s) => s.honorReceivedCount,
  tiers: TIERS_6([1, 10, 50, 200, 1000, 5000]),
})

// ─── DMs ────────────────────────────────────────────────────────────────────

const dmProgression = progression({
  keyPrefix: 'dms_sent',
  category: 'social',
  icon: '✉️',
  name: (n) => n === 1 ? 'Hello!' : `${n} Messages Sent`,
  description: (n) => n === 1 ? 'Send your first direct message' : `Send ${n} direct messages`,
  event: 'dm_sent',
  getCount: (s) => s.dmSentCount,
  tiers: TIERS_4([1, 25, 100, 500]),
})

// ─── GIFTS ──────────────────────────────────────────────────────────────────

const giftsGiven = progression({
  keyPrefix: 'gifts_sent',
  category: 'social',
  icon: '🎁',
  name: (n) => n === 1 ? 'Generous' : `${n} Gifts Sent`,
  description: (n) => n === 1 ? 'Send your first gift' : `Send ${n} gifts to other players`,
  event: 'gift_sent',
  getCount: (s) => s.giftSentCount,
  tiers: TIERS_4([1, 5, 25, 100]),
})

const giftsReceived = progression({
  keyPrefix: 'gifts_received',
  category: 'social',
  icon: '📦',
  name: (n) => n === 1 ? 'Secondhand' : `${n} Gifts Received`,
  description: (n) => n === 1 ? 'Receive your first gift' : `Receive ${n} gifts from other players`,
  event: 'gift_received',
  getCount: (s) => s.giftReceivedCount,
  tiers: TIERS_4([1, 5, 25, 100]),
})

// ─── One-offs ───────────────────────────────────────────────────────────────

const socialOneOffs = merge(
  single(
    { key: 'distinct_honors_10', name: 'Well Connected', description: 'Receive honors from 10 different players', icon: '🔗', category: 'social', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'honor_received',
    (ctx) => ctx.stats.distinctHonorGivers >= 10,
  ),
  single(
    { key: 'distinct_honors_50', name: 'Fan Favorite', description: 'Receive honors from 50 different players', icon: '🌟', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'honor_received',
    (ctx) => ctx.stats.distinctHonorGivers >= 50,
  ),
  single(
    { key: 'distinct_honors_200', name: 'Icon', description: 'Receive honors from 200 different players', icon: '🏛️', category: 'social', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'honor_received',
    (ctx) => ctx.stats.distinctHonorGivers >= 200,
  ),
  single(
    { key: 'distinct_honors_1000', name: 'Legend of Honor', description: 'Receive honors from 1000 different players', icon: '👑', category: 'social', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'honor_received',
    (ctx) => ctx.stats.distinctHonorGivers >= 1000,
  ),
  single(
    { key: 'gift_tipper', name: 'Big Tipper', description: 'Send 10 gifts', icon: '💸', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'gift_sent',
    (ctx) => ctx.stats.giftSentCount >= 10,
  ),
  single(
    { key: 'dm_ping_pong', name: 'Chatty', description: 'Send 50 direct messages', icon: '💬', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'dm_sent',
    (ctx) => ctx.stats.dmSentCount >= 50,
  ),
  single(
    { key: 'philanthropist', name: 'Philanthropist', description: 'Give 500 honors', icon: '👼', category: 'social', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'honor_given',
    (ctx) => ctx.stats.honorGivenCount >= 500,
  ),
)

// ─── EXPORTS ────────────────────────────────────────────────────────────────

const combined = merge(
  friendProgression,
  honorGivenProgression,
  honorReceivedProgression,
  dmProgression,
  giftsGiven,
  giftsReceived,
  socialOneOffs,
)

export const SOCIAL_DEFS: AchievementDef[] = combined.defs
export const SOCIAL_EVALS: Evaluator[] = combined.evals
