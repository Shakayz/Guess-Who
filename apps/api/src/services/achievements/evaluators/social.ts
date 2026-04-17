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
  name: (n) => n === 3 ? 'Making Friends' : `${n} Friends`,
  description: (n) => n === 3 ? 'Add 3 friends' : `Make ${n} friends`,
  event: 'friend_added',
  getCount: (s) => s.friendCount,
  tiers: TIERS_6([3, 15, 40, 100, 300, 750]),
})

// ─── HONORS (given) ─────────────────────────────────────────────────────────

const honorGivenProgression = progression({
  keyPrefix: 'honor_given',
  category: 'social',
  icon: '💝',
  name: (n) => n === 5 ? 'Kind Soul' : `${n} Honors Given`,
  description: (n) => n === 5 ? 'Give 5 honors' : `Give ${n} honors to other players`,
  event: 'honor_given',
  getCount: (s) => s.honorGivenCount,
  tiers: TIERS_5([5, 25, 100, 400, 2000]),
})

// ─── HONORS (received) ──────────────────────────────────────────────────────

const honorReceivedProgression = progression({
  keyPrefix: 'honor_received',
  category: 'social',
  icon: '💖',
  name: (n) => n === 5 ? 'Appreciated' : `${n} Honors Received`,
  description: (n) => n === 5 ? 'Receive 5 honors' : `Receive ${n} honors from other players`,
  event: 'honor_received',
  getCount: (s) => s.honorReceivedCount,
  tiers: TIERS_6([5, 25, 100, 400, 2000, 10000]),
})

// ─── DMs ────────────────────────────────────────────────────────────────────

const dmProgression = progression({
  keyPrefix: 'dms_sent',
  category: 'social',
  icon: '✉️',
  name: (n) => n === 10 ? 'Saying Hello' : `${n} Messages Sent`,
  description: (n) => n === 10 ? 'Send 10 direct messages' : `Send ${n} direct messages`,
  event: 'dm_sent',
  getCount: (s) => s.dmSentCount,
  tiers: TIERS_4([10, 50, 200, 1000]),
})

// ─── GIFTS ──────────────────────────────────────────────────────────────────

const giftsGiven = progression({
  keyPrefix: 'gifts_sent',
  category: 'social',
  icon: '🎁',
  name: (n) => n === 3 ? 'Generous' : `${n} Gifts Sent`,
  description: (n) => n === 3 ? 'Send 3 gifts' : `Send ${n} gifts to other players`,
  event: 'gift_sent',
  getCount: (s) => s.giftSentCount,
  tiers: TIERS_4([3, 15, 60, 250]),
})

const giftsReceived = progression({
  keyPrefix: 'gifts_received',
  category: 'social',
  icon: '📦',
  name: (n) => n === 3 ? 'Appreciated' : `${n} Gifts Received`,
  description: (n) => n === 3 ? 'Receive 3 gifts' : `Receive ${n} gifts from other players`,
  event: 'gift_received',
  getCount: (s) => s.giftReceivedCount,
  tiers: TIERS_4([3, 15, 60, 250]),
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
    { key: 'gift_tipper', name: 'Big Tipper', description: 'Send 25 gifts', icon: '💸', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'gift_sent',
    (ctx) => ctx.stats.giftSentCount >= 25,
  ),
  single(
    { key: 'dm_ping_pong', name: 'Chatty', description: 'Send 150 direct messages', icon: '💬', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'dm_sent',
    (ctx) => ctx.stats.dmSentCount >= 150,
  ),
  single(
    { key: 'philanthropist', name: 'Philanthropist', description: 'Give 750 honors', icon: '👼', category: 'social', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'honor_given',
    (ctx) => ctx.stats.honorGivenCount >= 750,
  ),
  single(
    { key: 'social_strategist', name: 'Social Strategist', description: '25+ friends, 100+ honors given, 50+ gifts sent', icon: '🎯', category: 'social', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'friend_added',
    (ctx) => ctx.stats.friendCount >= 25 && ctx.stats.honorGivenCount >= 100 && ctx.stats.giftSentCount >= 50,
  ),
  single(
    { key: 'heartbreaker', name: 'Heartbreaker', description: 'Receive 50 honors without ever giving any (silent star)', icon: '🥀', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 50 && ctx.stats.honorGivenCount === 0,
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
