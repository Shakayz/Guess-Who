// Economy achievements — star hoarding only.
// Cosmetics were removed from the game design, so the shop / cosmetic-owned
// progressions are gone too. The remaining achievements all fire on game_end
// and reward players for accumulating star coins.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, TIERS_6, merge, progression, single } from './_helpers'

const starBalanceProgression = progression({
  keyPrefix: 'star_balance',
  category: 'economy',
  icon: '⭐',
  name: (n) => `Hoard ${n} Stars`,
  description: (n) => `Hold ${n.toLocaleString()} stars in your balance at once`,
  event: 'game_end',
  getCount: (s) => s.starCoinsCurrent,
  tiers: TIERS_6([500, 2500, 10000, 25000, 100000, 500000]),
})

const economyOneOffs = merge(
  single(
    { key: 'gilded', name: 'Gilded', description: 'Hold 1,000,000 stars at once (the ultimate hoarder)', icon: '💰', category: 'economy', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 1_000_000,
  ),
)

const combined = merge(starBalanceProgression, economyOneOffs)

export const ECONOMY_DEFS: AchievementDef[] = combined.defs
export const ECONOMY_EVALS: Evaluator[] = combined.evals
