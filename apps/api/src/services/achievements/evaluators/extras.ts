// Extra achievements. Organized by theme: calendar moments, hourly play,
// redHanded/detective combos, role/time-based clever ones. Most fire on
// game_end. This file is for ONE-OFFS that aren't part of a tier progression
// — progression-style counters live next to the other category files.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, merge, single } from './_helpers'

// ─── Calendar — played on a specific weekday (7 bronze secrets) ─────────────
// Gated on totalGames >= 15 so a single new-user game doesn't instantly unlock
// a weekday achievement.

const WEEKDAYS: Array<{ idx: number; name: string; icon: string }> = [
  { idx: 0, name: 'Sunday', icon: '☀️' },
  { idx: 1, name: 'Monday', icon: '💼' },
  { idx: 2, name: 'Tuesday', icon: '🌮' },
  { idx: 3, name: 'Wednesday', icon: '🐪' },
  { idx: 4, name: 'Thursday', icon: '🍻' },
  { idx: 5, name: 'Friday', icon: '🎉' },
  { idx: 6, name: 'Saturday', icon: '🏖️' },
]

const weekdayAchievements: AchievementDef[] = []
const weekdayEvals: Evaluator[] = []
for (const day of WEEKDAYS) {
  const key = `weekday_${day.name.toLowerCase()}`
  weekdayAchievements.push({
    key,
    name: `${day.name} Player`,
    description: `Play a game on a ${day.name} after 30+ games total`,
    icon: day.icon,
    category: 'secret',
    difficulty: 'bronze',
    xpReward: REWARD.bronze.xp,
    coinReward: REWARD.bronze.stars,
    isSecret: true,
  })
  weekdayEvals.push({
    key,
    event: 'game_end',
    check: (ctx) => ctx.now.getUTCDay() === day.idx && ctx.stats.totalGames >= 30,
  })
}

// ─── Calendar — played in a specific month (12 bronze secrets) ──────────────
// Gated on totalGames >= 20.

const MONTHS = [
  { idx: 0,  name: 'January',   icon: '❄️' },
  { idx: 1,  name: 'February',  icon: '💝' },
  { idx: 2,  name: 'March',     icon: '🌱' },
  { idx: 3,  name: 'April',     icon: '🌧️' },
  { idx: 4,  name: 'May',       icon: '🌸' },
  { idx: 5,  name: 'June',      icon: '☀️' },
  { idx: 6,  name: 'July',      icon: '🎆' },
  { idx: 7,  name: 'August',    icon: '🏖️' },
  { idx: 8,  name: 'September', icon: '🍂' },
  { idx: 9,  name: 'October',   icon: '🎃' },
  { idx: 10, name: 'November',  icon: '🦃' },
  { idx: 11, name: 'December',  icon: '🎄' },
]

const monthAchievements: AchievementDef[] = []
const monthEvals: Evaluator[] = []
for (const m of MONTHS) {
  const key = `month_${m.name.toLowerCase()}`
  monthAchievements.push({
    key,
    name: `${m.name} Player`,
    description: `Play a game in ${m.name} after 50+ games total`,
    icon: m.icon,
    category: 'secret',
    difficulty: 'bronze',
    xpReward: REWARD.bronze.xp,
    coinReward: REWARD.bronze.stars,
    isSecret: true,
  })
  monthEvals.push({
    key,
    event: 'game_end',
    check: (ctx) => ctx.now.getUTCMonth() === m.idx && ctx.stats.totalGames >= 50,
  })
}

// ─── Hourly — played during each UTC hour (24 bronze secrets) ───────────────
// Gated on totalGames >= 30 so a new user can't pop ~24 bronzes from random
// hours over a handful of sessions.

const hourlyAchievements: AchievementDef[] = []
const hourlyEvals: Evaluator[] = []
for (let h = 0; h < 24; h++) {
  const key = `hour_${h.toString().padStart(2, '0')}`
  hourlyAchievements.push({
    key,
    name: `Hour ${h.toString().padStart(2, '0')}:00`,
    description: `Finish a game in the ${h.toString().padStart(2, '0')}:00 UTC hour after 75+ games`,
    icon: '⏰',
    category: 'secret',
    difficulty: 'bronze',
    xpReward: REWARD.bronze.xp,
    coinReward: REWARD.bronze.stars,
    isSecret: true,
  })
  hourlyEvals.push({
    key,
    event: 'game_end',
    check: (ctx) => ctx.now.getUTCHours() === h && ctx.stats.totalGames >= 75,
  })
}

// ─── Detective one-offs ─────────────────────────────────────────────────────
// These are in addition to the detective_wins progression in gameEnd.ts.

const detectiveExtras = merge(
  single(
    { key: 'detective_swift', name: 'Swift Justice', description: 'Win as detective surviving all rounds in a 6+ player game', icon: '⚡', category: 'detective', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && ctx.survived && ctx.playerCount >= 6,
  ),
  single(
    { key: 'detective_martyr', name: 'Martyr', description: 'Win as detective despite being eliminated', icon: '🕯️', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && !ctx.survived,
  ),
  single(
    { key: 'detective_big_lobby', name: 'Big-Stakes Detective', description: 'Win as detective with 8+ players', icon: '🎲', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 8,
  ),
  single(
    { key: 'detective_10_games', name: 'Seasoned Investigator', description: 'Play 10 games as detective', icon: '🔦', category: 'detective', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 10,
  ),
  single(
    { key: 'detective_50_games', name: 'Lifer', description: 'Play 50 games as detective', icon: '👔', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 50,
  ),
  single(
    { key: 'detective_100_games', name: 'Old Hat', description: 'Play 100 games as detective', icon: '🎩', category: 'detective', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 100,
  ),
  single(
    { key: 'detective_flawless', name: 'Flawless Investigator', description: 'Reach 25 detective wins', icon: '🌟', category: 'detective', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['detective'] ?? 0) >= 25,
  ),
)

// ─── RedHanded one-offs ─────────────────────────────────────────────────────

const redHandedExtras = merge(
  single(
    { key: 'red_handed_small_lobby', name: 'Tight Spot', description: 'Win as imposter in a 4-5 player game', icon: '🎯', category: 'red_handed', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isRedHanded && ctx.isWinner && ctx.playerCount <= 5,
  ),
  single(
    { key: 'blended_in', name: 'Blended In', description: 'Survive as redHanded in a 6+ player game', icon: '🫥', category: 'red_handed', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isRedHanded && ctx.survived && ctx.playerCount >= 6,
  ),
  single(
    { key: 'red_handed_all_modes', name: 'Omni Imposter', description: 'Win 30+ imposter games with 5+ of them ranked', icon: '🎨', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 30 && ctx.stats.rankedWins >= 5,
  ),
  single(
    { key: 'shadow_master', name: 'Shadow Master', description: 'Reach 75 redHanded wins', icon: '🌑', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 75,
  ),
)

// ─── Gameplay one-offs ──────────────────────────────────────────────────────
// Removed: `ten_streak`/`twenty_streak` (names said "streak", logic was total
// wins), `centurion`/`veteran_100` (duplicated games_played progression
// tiers), `weekly_player`/`monthly_player`/`yearly_player` (duplicated
// daily_streak progression tiers).

const gameplayExtras = merge(
  single(
    { key: 'hard_to_kill', name: 'Hard to Kill', description: 'Survive 10 won games', icon: '🛡️', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.survivedWins >= 10,
  ),
  single(
    { key: 'indestructible', name: 'Indestructible', description: 'Survive 100 won games', icon: '🏰', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.survivedWins >= 100,
  ),
  single(
    { key: 'immortal', name: 'Immortal', description: 'Survive 500 won games', icon: '♾️', category: 'gameplay', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.survivedWins >= 500,
  ),
  single(
    { key: 'obsessed', name: 'Obsessed', description: 'Play 500 games', icon: '💎', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 500,
  ),
  single(
    { key: 'mythical_games', name: 'Mythical', description: 'Play 10,000 games', icon: '🐉', category: 'gameplay', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 10000,
  ),
  single(
    { key: 'legend', name: 'Legend', description: 'Reach 1000 total wins', icon: '🌟', category: 'gameplay', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 1000,
  ),
  single(
    { key: 'mythical_wins', name: 'Mythical Victor', description: 'Reach 5000 total wins', icon: '👑', category: 'gameplay', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 5000,
  ),
  single(
    { key: 'comeback_artist', name: 'Comeback Artist', description: 'Win a game after losing at least 3 more games than you have won', icon: '🎨', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.stats.totalGames - ctx.stats.totalWins * 2 >= 3,
  ),
  single(
    { key: 'triathlete', name: 'Triathlete', description: 'Reach 20+ total wins with at least 1 ranked win', icon: '🏅', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.rankedWins >= 1 && ctx.stats.totalWins >= 20,
  ),
  single(
    { key: 'special_mode_master', name: 'Special Mode Master', description: 'Win a Special mode game', icon: '✨', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.gameMode === 'special',
  ),
)

// ─── Secret one-offs ────────────────────────────────────────────────────────
// Removed: unanimous_vote / last_second_vote (misleading — both were just
// "any villager/6+ player win"), weekend_warrior (duplicate of the Saturday
// + Sunday calendar bronzes), first_dm (duplicate of dms_sent progression's
// first tier).

const secretExtras = merge(
  single(
    { key: 'one_hp', name: 'One HP', description: 'Win as a surviving villager in a 6+ player game', icon: '❤️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.survived && !ctx.isRedHanded && ctx.playerCount >= 6,
  ),
  single(
    { key: 'solo_queue', name: 'Solo Queue', description: 'Play 50 games without adding any friends', icon: '🚶', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 50 && ctx.stats.friendCount === 0,
  ),
  single(
    { key: 'hermit', name: 'Hermit', description: 'Play 100 games without sending any DMs', icon: '🗿', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100 && ctx.stats.dmSentCount === 0,
  ),
  single(
    { key: 'social_god', name: 'Social God', description: 'Have 100 friends', icon: '🌐', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'friend_added',
    (ctx) => ctx.stats.friendCount >= 100,
  ),
  single(
    { key: 'balanced_diet', name: 'Balanced Diet', description: 'Win at least 10 redHanded and 10 villager games', icon: '⚖️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 10 && ctx.stats.totalVillagerWins >= 10,
  ),
  single(
    { key: 'all_special_roles_play', name: 'Every Role', description: 'Play every special role at least once', icon: '🎭', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => Object.keys(ctx.stats.gamesByRole).length >= 14,
  ),
  single(
    { key: 'never_redHanded', name: 'Always Good', description: 'Play 30 games without ever being redHanded', icon: '😇', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 30 && (ctx.stats.gamesByRole['red_handed'] ?? 0) === 0,
  ),
  single(
    { key: 'never_villager', name: 'Never a Farmer', description: 'Play 30 games without ever being a plain villager', icon: '🌪️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 30 && (ctx.stats.gamesByRole['villager'] ?? 0) === 0,
  ),
  single(
    { key: 'wooden_escape', name: 'Wooden Escape', description: 'Win a ranked game while at Wooden tier', icon: '🪵', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.gameMode === 'ranked' && ctx.isWinner && ctx.stats.rankTier === 'wooden',
  ),
  single(
    { key: 'mythic_red_handed_ratio', name: 'Mythic Deceiver', description: 'Win 500 redHanded games with 70%+ redHanded win rate', icon: '🌌', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const redHandedGames =
        (ctx.stats.gamesByRole['red_handed'] ?? 0) +
        (ctx.stats.gamesByRole['double_agent'] ?? 0) +
        (ctx.stats.gamesByRole['infiltrator'] ?? 0) +
        (ctx.stats.gamesByRole['kamikaze'] ?? 0) +
        (ctx.stats.gamesByRole['corruptor'] ?? 0) +
        (ctx.stats.gamesByRole['inverter'] ?? 0)
      return ctx.stats.totalRedHandedWins >= 500 && redHandedGames > 0 &&
        ctx.stats.totalRedHandedWins / redHandedGames >= 0.7
    },
  ),
  // `night_owl` is defined in gameEnd.ts (silver, 2-5 AM UTC, 25 games); a
  // second gold variant here collided on the same key and was silently dropped
  // by registry deduplication, so it has been removed.
)

// ─── Social one-offs ────────────────────────────────────────────────────────
// Removed: honor_type_collector (100 received dup of honor_received_100),
// team_player (25 dup of honor_received_25), good_sport (100 given dup of
// honor_given_100), beloved_bronze (5 dup of honor_received_5), matchmaker
// (10 friends — not a tier but too close to friends_15), influencer (75
// friends, too close to friends_100), gifter_bronze (3 gifts dup of
// gifts_sent_3).

const socialExtras = merge(
  single(
    { key: 'sharp_mind', name: 'Sharp Mind', description: 'Receive 50 honors', icon: '🧠', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 50,
  ),
  single(
    { key: 'honor_giver_balanced', name: 'Give and Take', description: 'Give and receive 50+ honors each', icon: '🔄', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'honor_received',
    (ctx) => ctx.stats.honorGivenCount >= 50 && ctx.stats.honorReceivedCount >= 50,
  ),
)

// ─── Economy one-offs ───────────────────────────────────────────────────────
// Cosmetics were removed from the game design, so the shop / cosmetic-owned
// achievements are gone too. Star-balance milestones are what's left.

const economyExtras = merge(
  single(
    { key: 'coin_collector_500', name: 'Coin Collector', description: 'Hold 500 stars at once', icon: '⭐', category: 'economy', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 500,
  ),
  single(
    { key: 'rich', name: 'Rich', description: 'Hold 5000 stars at once', icon: '💰', category: 'economy', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 5000,
  ),
  single(
    { key: 'mogul', name: 'Mogul', description: 'Hold 50,000 stars at once', icon: '🤑', category: 'economy', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 50000,
  ),
  single(
    { key: 'whale', name: 'Whale', description: 'Hold 250,000 stars at once', icon: '🐋', category: 'economy', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 250000,
  ),
)

// ─── Milestones one-offs ────────────────────────────────────────────────────
// Removed: half_year (dup of daily_streak_180 tier), word_pack_wizard (dup
// of word_packs_created_10 tier). Fixed all_categories — it previously said
// "Play 15 different word packs" but checked wordPacksCreated >= 3; now
// checks distinctWordPacks (games played across different packs).

const milestonesExtras = merge(
  single(
    { key: 'all_categories', name: 'Well Rounded', description: 'Play games across 15 different word packs', icon: '📚', category: 'milestones', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.distinctWordPacks >= 15,
  ),
  single(
    { key: 'eternal_streak', name: 'Eternal Streak', description: 'Reach a 1000-day login streak', icon: '♾️', category: 'milestones', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 1000,
  ),
)

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export const EXTRAS_DEFS: AchievementDef[] = [
  ...weekdayAchievements,
  ...monthAchievements,
  ...hourlyAchievements,
  ...detectiveExtras.defs,
  ...redHandedExtras.defs,
  ...gameplayExtras.defs,
  ...secretExtras.defs,
  ...socialExtras.defs,
  ...economyExtras.defs,
  ...milestonesExtras.defs,
]

export const EXTRAS_EVALS: Evaluator[] = [
  ...weekdayEvals,
  ...monthEvals,
  ...hourlyEvals,
  ...detectiveExtras.evals,
  ...redHandedExtras.evals,
  ...gameplayExtras.evals,
  ...secretExtras.evals,
  ...socialExtras.evals,
  ...economyExtras.evals,
  ...milestonesExtras.evals,
]
