// Meta achievements — unlock based on how many other achievements you own.
// These listen on achievement_unlocked (fires recursively from the dispatcher
// after any other achievement unlocks) and achievement_claimed.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, merge, progression, single } from './_helpers'

const collectorProgression = progression({
  keyPrefix: 'collector',
  category: 'meta',
  icon: '🏅',
  name: (n) => `Collector ${n}`,
  description: (n) => `Unlock ${n} achievements`,
  event: 'achievement_unlocked',
  getCount: (s) => s.achievementsUnlockedCount,
  tiers: [
    { n: 5,   difficulty: 'bronze',   stars: 20,   xp: 15 },
    { n: 25,  difficulty: 'bronze',   stars: 30,   xp: 25 },
    { n: 50,  difficulty: 'silver',   stars: 60,   xp: 40 },
    { n: 100, difficulty: 'silver',   stars: 80,   xp: 50 },
    { n: 150, difficulty: 'gold',     stars: 150,  xp: 80 },
    { n: 200, difficulty: 'gold',     stars: 200,  xp: 100 },
    { n: 250, difficulty: 'platinum', stars: 300,  xp: 140 },
    { n: 300, difficulty: 'platinum', stars: 400,  xp: 180 },
    { n: 350, difficulty: 'diamond',  stars: 700,  xp: 250 },
    { n: 400, difficulty: 'mythic',   stars: 3000, xp: 600 },
  ],
})

const claimantProgression = progression({
  keyPrefix: 'claimant',
  category: 'meta',
  icon: '✋',
  name: (n) => n === 1 ? 'First Claim' : `Claim ${n}`,
  description: (n) => n === 1 ? 'Claim your first achievement reward' : `Claim ${n} achievement rewards`,
  event: 'achievement_claimed',
  getCount: (s) => s.achievementsClaimedCount,
  tiers: [
    { n: 1,   difficulty: 'bronze',   stars: 15,  xp: 10 },
    { n: 10,  difficulty: 'silver',   stars: 50,  xp: 30 },
    { n: 50,  difficulty: 'gold',     stars: 150, xp: 60 },
    { n: 200, difficulty: 'platinum', stars: 350, xp: 150 },
    { n: 400, difficulty: 'mythic',   stars: 2500, xp: 500 },
  ],
})

const metaOneOffs = merge(
  single(
    { key: 'bronze_hoarder', name: 'Bronze Hoarder', description: 'Unlock 25 bronze achievements', icon: '🥉', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 25,
  ),
  single(
    { key: 'secret_keeper', name: 'Secret Keeper', description: 'Unlock 10 secret achievements', icon: '🔐', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 30,
  ),
  single(
    { key: 'diamond_connoisseur', name: 'Diamond Connoisseur', description: 'Unlock 10 diamond-tier achievements', icon: '💎', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 100,
  ),
  single(
    { key: 'completionist', name: 'Completionist', description: 'Unlock half of all achievements', icon: '📊', category: 'meta', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 200,
  ),
  single(
    { key: 'reaper_of_stars', name: 'Reaper of Stars', description: 'Claim 100 achievement rewards', icon: '🌠', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 100,
  ),
  single(
    { key: 'claim_binge', name: 'Claim Binge', description: 'Claim 25 achievement rewards', icon: '🎁', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 25,
  ),
  single(
    { key: 'meta_collector', name: 'Meta Collector', description: 'Unlock any 5 meta achievements', icon: '🔁', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 50,
  ),
  single(
    { key: 'mythic_dozen', name: 'Mythic Dozen', description: 'Unlock 3 mythic achievements', icon: '🌌', category: 'meta', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 300,
  ),
)

const combined = merge(collectorProgression, claimantProgression, metaOneOffs)

export const META_DEFS: AchievementDef[] = combined.defs
export const META_EVALS: Evaluator[] = combined.evals
