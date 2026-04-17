// Milestones — daily streak, word packs, avatar changes, localisation.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, TIERS_6, TIERS_5, TIERS_4, merge, progression, single } from './_helpers'

const streakProgression = progression({
  keyPrefix: 'daily_streak',
  category: 'milestones',
  icon: '🔥',
  name: (n) => n === 5 ? 'Warming Up' : `${n}-Day Streak`,
  description: (n) => n === 5 ? 'Play at least one game every day for 5 days in a row' : `Play at least one game every day for ${n} days in a row`,
  event: 'daily_login',
  getCount: (s) => s.dailyStreakCount,
  tiers: TIERS_6([5, 14, 45, 120, 240, 365]),
})

const wordPackProgression = progression({
  keyPrefix: 'word_packs_created',
  category: 'milestones',
  icon: '📝',
  name: (n) => n === 5 ? 'Creator' : `${n} Word Packs Created`,
  description: (n) => n === 5 ? 'Create 5 custom word packs' : `Create ${n} custom word packs`,
  event: 'word_pack_created',
  getCount: (s) => s.wordPacksCreated,
  tiers: TIERS_4([5, 20, 60, 150]),
})

const milestoneOneOffs = merge(
  single(
    // Bronze participation stamp — tiny reward so it's not a free farm.
    { key: 'avatar_changed_first', name: 'Customizer', description: 'Change your profile picture for the first time', icon: '📸', category: 'milestones', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'avatar_changed',
    () => true,
  ),
  single(
    { key: 'perfect_week', name: 'Perfect Week', description: 'Hold a 7-day streak while having won at least 7 games', icon: '🌟', category: 'milestones', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 7 && ctx.stats.totalWins >= 7,
  ),
  single(
    { key: 'level_5', name: 'Level 5', description: 'Reach level 5', icon: '🎓', category: 'milestones', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 5,
  ),
  single(
    { key: 'level_10', name: 'Level 10', description: 'Reach level 10', icon: '🎓', category: 'milestones', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 10,
  ),
  single(
    { key: 'level_25', name: 'Level 25', description: 'Reach level 25', icon: '🎖️', category: 'milestones', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 25,
  ),
  single(
    { key: 'level_50', name: 'Level 50', description: 'Reach level 50', icon: '🏆', category: 'milestones', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 50,
  ),
  single(
    { key: 'level_100', name: 'Level 100', description: 'Reach level 100', icon: '👑', category: 'milestones', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 100,
  ),
  single(
    { key: 'level_250', name: 'Level 250', description: 'Reach level 250', icon: '🌟', category: 'milestones', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 250,
  ),
  single(
    { key: 'level_500', name: 'Level 500', description: 'Reach level 500', icon: '💫', category: 'milestones', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 500,
  ),
  single(
    { key: 'level_1000', name: 'Level 1000', description: 'Reach level 1000', icon: '🌠', category: 'milestones', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'level_up',
    (ctx) => ctx.type === 'level_up' && (ctx.newLevel ?? 0) >= 1000,
  ),
  single(
    { key: 'year_one', name: 'Year One', description: 'Log in every day for 365 days', icon: '📅', category: 'milestones', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 365,
  ),
  single(
    { key: 'word_pack_play', name: 'The Librarian', description: 'Play in 5 different word packs', icon: '📚', category: 'milestones', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.distinctWordPacks >= 5,
  ),
)

const combined = merge(streakProgression, wordPackProgression, milestoneOneOffs)

export const MILESTONES_DEFS: AchievementDef[] = combined.defs
export const MILESTONES_EVALS: Evaluator[] = combined.evals
