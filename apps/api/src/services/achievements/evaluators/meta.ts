// Meta achievements — unlock based on how many other achievements you own.
// These listen on achievement_unlocked (fires recursively from the dispatcher
// after any other achievement unlocks) and achievement_claimed.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, merge, progression, single } from './_helpers'

// Collector tiers are spaced so a new player can't pop multiple tiers in a
// single session. Thresholds raised and payouts capped at 1000 so the meta
// category can't be farmed past the 1000-coin-per-achievement ceiling.
const collectorProgression = progression({
  keyPrefix: 'collector',
  category: 'meta',
  icon: '🏅',
  name: (n) => `Collector ${n}`,
  description: (n) => `Unlock ${n} achievements`,
  event: 'achievement_unlocked',
  getCount: (s) => s.achievementsUnlockedCount,
  tiers: [
    { n: 25,  difficulty: 'bronze',   stars: 5,    xp: 10 },
    { n: 60,  difficulty: 'silver',   stars: 25,   xp: 25 },
    { n: 100, difficulty: 'silver',   stars: 45,   xp: 40 },
    { n: 150, difficulty: 'gold',     stars: 80,   xp: 70 },
    { n: 200, difficulty: 'gold',     stars: 125,  xp: 95 },
    { n: 250, difficulty: 'platinum', stars: 200,  xp: 160 },
    { n: 300, difficulty: 'platinum', stars: 300,  xp: 200 },
    { n: 350, difficulty: 'diamond',  stars: 500,  xp: 320 },
    { n: 400, difficulty: 'diamond',  stars: 750,  xp: 400 },
    { n: 450, difficulty: 'mythic',   stars: 1000, xp: 750 },
  ],
})

// Claimant first tier raised to 10 so claiming a few bronze rewards doesn't
// instantly cascade into another meta achievement. Final tier capped at 1000.
const claimantProgression = progression({
  keyPrefix: 'claimant',
  category: 'meta',
  icon: '✋',
  name: (n) => n === 10 ? 'Collecting Dues' : `Claim ${n}`,
  description: (n) => n === 10 ? 'Claim 10 achievement rewards' : `Claim ${n} achievement rewards`,
  event: 'achievement_claimed',
  getCount: (s) => s.achievementsClaimedCount,
  tiers: [
    { n: 10,  difficulty: 'bronze',   stars: 5,    xp: 10 },
    { n: 40,  difficulty: 'silver',   stars: 25,   xp: 25 },
    { n: 100, difficulty: 'gold',     stars: 90,   xp: 80 },
    { n: 250, difficulty: 'platinum', stars: 250,  xp: 170 },
    { n: 450, difficulty: 'mythic',   stars: 1000, xp: 650 },
  ],
})

const metaOneOffs = merge(
  single(
    { key: 'bronze_hoarder', name: 'Bronze Hoarder', description: 'Unlock 50 total achievements', icon: '🥉', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 50,
  ),
  single(
    { key: 'secret_keeper', name: 'Secret Keeper', description: 'Unlock 80 achievements (many likely secret)', icon: '🔐', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 80,
  ),
  single(
    { key: 'diamond_connoisseur', name: 'Diamond Connoisseur', description: 'Unlock 175 achievements', icon: '💎', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 175,
  ),
  single(
    { key: 'completionist', name: 'Completionist', description: 'Unlock 300+ achievements (roughly three-quarters of the catalogue)', icon: '📊', category: 'meta', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 300,
  ),
  single(
    { key: 'reaper_of_stars', name: 'Reaper of Stars', description: 'Claim 175 achievement rewards', icon: '🌠', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 175,
  ),
  single(
    { key: 'claim_binge', name: 'Claim Binge', description: 'Claim 60 achievement rewards', icon: '🎁', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 60,
  ),
  single(
    { key: 'meta_collector', name: 'Meta Collector', description: 'Unlock 120 total achievements', icon: '🔁', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 120,
  ),
  single(
    { key: 'mythic_dozen', name: 'Mythic Dozen', description: 'Unlock 375+ achievements', icon: '🌌', category: 'meta', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 375,
  ),
)

const combined = merge(collectorProgression, claimantProgression, metaOneOffs)

export const META_DEFS: AchievementDef[] = combined.defs
export const META_EVALS: Evaluator[] = combined.evals
