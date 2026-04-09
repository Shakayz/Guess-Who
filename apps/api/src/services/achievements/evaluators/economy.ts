// Economy achievements — shop purchases, cosmetic collection, star hoarding.
// Listens on shop_purchase, cosmetic_equipped, and game_end (for star balance).

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, TIERS_6, TIERS_5, merge, progression, single } from './_helpers'

const shopProgression = progression({
  keyPrefix: 'cosmetics_owned',
  category: 'economy',
  icon: '🛍️',
  name: (n) => n === 1 ? 'First Purchase' : `${n} Cosmetics Owned`,
  description: (n) => n === 1 ? 'Buy your first cosmetic from the shop' : `Own ${n} cosmetics`,
  event: 'shop_purchase',
  getCount: (s) => s.cosmeticOwnedCount,
  tiers: TIERS_6([1, 5, 15, 40, 100, 300]),
})

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
    { key: 'wardrobe_25', name: 'Wardrobe', description: 'Own 25 different cosmetics', icon: '👗', category: 'economy', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 25,
  ),
  single(
    { key: 'shopaholic', name: 'Shopaholic', description: 'Make 50 shop purchases', icon: '🛒', category: 'economy', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'shop_purchase',
    (ctx) => ctx.stats.shopPurchaseCount >= 50,
  ),
  single(
    { key: 'cosmetic_equipped_first', name: 'Dressed Up', description: 'Equip a cosmetic', icon: '🎀', category: 'economy', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'cosmetic_equipped',
    () => true,
  ),
  single(
    { key: 'gilded', name: 'Gilded', description: 'Hold 1,000,000 stars at once (the ultimate hoarder)', icon: '💰', category: 'economy', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 1_000_000,
  ),
)

const combined = merge(shopProgression, starBalanceProgression, economyOneOffs)

export const ECONOMY_DEFS: AchievementDef[] = combined.defs
export const ECONOMY_EVALS: Evaluator[] = combined.evals
