// Meta achievements — unlock based on how many other achievements you own.
// These listen on achievement_unlocked (fires recursively from the dispatcher
// after any other achievement unlocks) and achievement_claimed.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, merge, progression, single } from './_helpers'

// Collector tiers are deliberately spaced so a new player can't pop multiple
// tiers on their first session. First tier moved from 5 → 15 to avoid the
// cascade where unlocking 5 easy bronzes immediately handed out another
// bronze meta achievement.
const collectorProgression = progression({
  keyPrefix: 'collector',
  category: 'meta',
  icon: '🏅',
  name: (n) => `Collector ${n}`,
  description: (n) => `Unlock ${n} achievements`,
  event: 'achievement_unlocked',
  getCount: (s) => s.achievementsUnlockedCount,
  tiers: [
    { n: 15,  difficulty: 'bronze',   stars: 10,   xp: 10 },
    { n: 40,  difficulty: 'silver',   stars: 35,   xp: 25 },
    { n: 75,  difficulty: 'silver',   stars: 60,   xp: 40 },
    { n: 125, difficulty: 'gold',     stars: 120,  xp: 70 },
    { n: 175, difficulty: 'gold',     stars: 180,  xp: 95 },
    { n: 225, difficulty: 'platinum', stars: 350,  xp: 160 },
    { n: 275, difficulty: 'platinum', stars: 450,  xp: 200 },
    { n: 325, difficulty: 'diamond',  stars: 900,  xp: 320 },
    { n: 375, difficulty: 'diamond',  stars: 1200, xp: 400 },
    { n: 400, difficulty: 'mythic',   stars: 4000, xp: 750 },
  ],
})

// Claimant first tier moved from 1 → 5 so claiming one reward doesn't
// instantly give another achievement (and cascade meta unlocks).
const claimantProgression = progression({
  keyPrefix: 'claimant',
  category: 'meta',
  icon: '✋',
  name: (n) => n === 5 ? 'Collecting Dues' : `Claim ${n}`,
  description: (n) => n === 5 ? 'Claim 5 achievement rewards' : `Claim ${n} achievement rewards`,
  event: 'achievement_claimed',
  getCount: (s) => s.achievementsClaimedCount,
  tiers: [
    { n: 5,   difficulty: 'bronze',   stars: 10,   xp: 10 },
    { n: 25,  difficulty: 'silver',   stars: 40,   xp: 25 },
    { n: 75,  difficulty: 'gold',     stars: 150,  xp: 80 },
    { n: 200, difficulty: 'platinum', stars: 400,  xp: 170 },
    { n: 400, difficulty: 'mythic',   stars: 3500, xp: 650 },
  ],
})

const metaOneOffs = merge(
  single(
    { key: 'bronze_hoarder', name: 'Bronze Hoarder', description: 'Unlock 30 total achievements', icon: '🥉', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 30,
  ),
  single(
    { key: 'secret_keeper', name: 'Secret Keeper', description: 'Unlock 50 achievements (many likely secret)', icon: '🔐', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 50,
  ),
  single(
    { key: 'diamond_connoisseur', name: 'Diamond Connoisseur', description: 'Unlock 125 achievements', icon: '💎', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 125,
  ),
  single(
    { key: 'completionist', name: 'Completionist', description: 'Unlock 250+ achievements (roughly half the catalogue)', icon: '📊', category: 'meta', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 250,
  ),
  single(
    { key: 'reaper_of_stars', name: 'Reaper of Stars', description: 'Claim 125 achievement rewards', icon: '🌠', category: 'meta', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 125,
  ),
  single(
    { key: 'claim_binge', name: 'Claim Binge', description: 'Claim 40 achievement rewards', icon: '🎁', category: 'meta', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'achievement_claimed',
    (ctx) => ctx.stats.achievementsClaimedCount >= 40,
  ),
  single(
    { key: 'meta_collector', name: 'Meta Collector', description: 'Unlock 75 total achievements', icon: '🔁', category: 'meta', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 75,
  ),
  single(
    { key: 'mythic_dozen', name: 'Mythic Dozen', description: 'Unlock 325+ achievements', icon: '🌌', category: 'meta', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'achievement_unlocked',
    (ctx) => ctx.stats.achievementsUnlockedCount >= 325,
  ),
)

const combined = merge(collectorProgression, claimantProgression, metaOneOffs)

export const META_DEFS: AchievementDef[] = combined.defs
export const META_EVALS: Evaluator[] = combined.evals
