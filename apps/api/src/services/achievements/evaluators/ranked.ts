// Ranked achievements — split between game-end (ranked win counts) and
// rank_changed (tier promotion) events.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, TIERS_6, merge, progression, single } from './_helpers'

const rankedGamesProgression = progression({
  keyPrefix: 'ranked_games',
  category: 'ranked',
  icon: '⚔️',
  name: (n) => n === 10 ? 'Ranked Debut' : `${n} Ranked Games`,
  description: (n) => n === 10 ? 'Play 10 ranked games' : `Play ${n} ranked games`,
  event: 'game_end',
  getCount: (s) => s.rankedGames,
  tiers: TIERS_6([10, 50, 175, 600, 2500, 12000]),
})

const rankedWinsProgression = progression({
  keyPrefix: 'ranked_wins',
  category: 'ranked',
  icon: '🗡️',
  name: (n) => n === 5 ? 'Ranked Victor' : `${n} Ranked Wins`,
  description: (n) => n === 5 ? 'Win 5 ranked games' : `Win ${n} ranked games`,
  event: 'game_end',
  getCount: (s) => s.rankedWins,
  tiers: TIERS_6([5, 25, 80, 300, 1500, 6000]),
})

// Tier promotions are separate one-offs because they fire on rank_changed.
const RANK_TIERS: Array<{ tier: string; key: string; name: string; icon: string; difficulty: any }> = [
  { tier: 'wooden',      key: 'tier_wooden',      name: 'Wooden Tier',      icon: '🪵', difficulty: 'bronze' },
  { tier: 'bronze',      key: 'tier_bronze',      name: 'Bronze Tier',      icon: '🥉', difficulty: 'bronze' },
  { tier: 'silver',      key: 'tier_silver',      name: 'Silver Tier',      icon: '🥈', difficulty: 'silver' },
  { tier: 'gold',        key: 'tier_gold',        name: 'Gold Tier',        icon: '🥇', difficulty: 'gold' },
  { tier: 'platinum',    key: 'tier_platinum',    name: 'Platinum Tier',    icon: '🔷', difficulty: 'gold' },
  { tier: 'diamond',     key: 'tier_diamond',     name: 'Diamond Tier',     icon: '💎', difficulty: 'platinum' },
  { tier: 'master',      key: 'tier_master',      name: 'Master Tier',      icon: '👑', difficulty: 'platinum' },
  { tier: 'grandmaster', key: 'tier_grandmaster', name: 'Grandmaster Tier', icon: '🌌', difficulty: 'diamond' },
]

const RANK_ORDER: Record<string, number> = {
  wooden: 0, bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5, master: 6, grandmaster: 7,
}

const tierDefs: AchievementDef[] = []
const tierEvals: Evaluator[] = []
for (const t of RANK_TIERS) {
  const reward = REWARD[t.difficulty as keyof typeof REWARD]
  tierDefs.push({
    key: t.key,
    name: t.name,
    description: `Reach ${t.name.replace(' Tier', '')} rank in ranked play`,
    icon: t.icon,
    category: 'ranked',
    difficulty: t.difficulty,
    xpReward: reward.xp,
    coinReward: reward.stars,
  })
  tierEvals.push({
    key: t.key,
    event: 'rank_changed',
    check: (ctx) => (RANK_ORDER[ctx.stats.rankTier] ?? 0) >= (RANK_ORDER[t.tier] ?? 0),
  })
  // Also fire on game_end so players who earned the tier pre-feature still unlock.
  tierEvals.push({
    key: t.key,
    event: 'game_end',
    check: (ctx) => (RANK_ORDER[ctx.stats.rankTier] ?? 0) >= (RANK_ORDER[t.tier] ?? 0),
  })
}

const rankedOneOffs = merge(
  single(
    { key: 'ranked_ratio', name: 'Cut-throat', description: 'Reach 65% win rate in 100+ ranked games', icon: '🥊', category: 'ranked', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.rankedGames >= 100 && ctx.stats.rankedWins / ctx.stats.rankedGames >= 0.65,
  ),
  single(
    { key: 'ranked_immortal', name: 'Ranked Immortal', description: 'Win 3000 ranked games', icon: '♾️', category: 'ranked', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => ctx.stats.rankedWins >= 3000,
  ),
  single(
    { key: 'perfectionist', name: 'Perfectionist', description: 'Reach Grandmaster rank', icon: '🌠', category: 'ranked', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'rank_changed',
    (ctx) => ctx.stats.rankTier === 'grandmaster',
  ),
  single(
    { key: 'ranked_veteran', name: 'Ranked Veteran', description: 'Play 250 ranked games', icon: '🎖️', category: 'ranked', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.rankedGames >= 250,
  ),
)

const combined = merge(
  rankedGamesProgression,
  rankedWinsProgression,
  { defs: tierDefs, evals: tierEvals },
  rankedOneOffs,
)

export const RANKED_DEFS: AchievementDef[] = combined.defs
export const RANKED_EVALS: Evaluator[] = combined.evals
