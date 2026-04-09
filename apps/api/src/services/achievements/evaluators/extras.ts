// Extra achievements to reach the 400 target. Organized by theme: calendar
// moments, hourly play, imposter/detective specific combos, role-specific
// clever ones. All fire on game_end so they're lightweight to add.

import type { AchievementDef, Evaluator } from '../types'
import { REWARD, merge, single } from './_helpers'

// ─── Calendar — played on a specific weekday (7 bronze secrets) ─────────────

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
    description: `Play a game on a ${day.name}`,
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
    check: (ctx) => ctx.now.getUTCDay() === day.idx,
  })
}

// ─── Calendar — played in a specific month (12 bronze secrets) ──────────────

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
    description: `Play a game in ${m.name}`,
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
    check: (ctx) => ctx.now.getUTCMonth() === m.idx,
  })
}

// ─── Hourly — played during each UTC hour (24 bronze secrets) ───────────────

const hourlyAchievements: AchievementDef[] = []
const hourlyEvals: Evaluator[] = []
for (let h = 0; h < 24; h++) {
  const key = `hour_${h.toString().padStart(2, '0')}`
  hourlyAchievements.push({
    key,
    name: `Hour ${h.toString().padStart(2, '0')}:00`,
    description: `Finish a game during the ${h.toString().padStart(2, '0')}:00 UTC hour`,
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
    check: (ctx) => ctx.now.getUTCHours() === h,
  })
}

// ─── Detective combo (10 one-offs) ──────────────────────────────────────────

const detectiveExtras = merge(
  single(
    { key: 'detective_swift', name: 'Swift Justice', description: 'Win as detective surviving all rounds', icon: '⚡', category: 'detective', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && ctx.survived,
  ),
  single(
    { key: 'detective_martyr', name: 'Martyr', description: 'Win as detective despite being eliminated', icon: '🕯️', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && !ctx.survived,
  ),
  single(
    { key: 'detective_big_lobby', name: 'Big-Stakes Detective', description: 'Win as detective with 8+ players', icon: '🎲', category: 'detective', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 8,
  ),
  single(
    { key: 'detective_5_games', name: 'Rookie Investigator', description: 'Play 5 games as detective', icon: '📔', category: 'detective', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 5,
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
    { key: 'double_agent_buster', name: 'Double-Cross', description: 'Win as detective in a game with a double agent', icon: '🎭', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner,
  ),
  single(
    { key: 'detective_flawless', name: 'Flawless Investigator', description: 'Reach 25 detective wins while surviving all of them', icon: '🌟', category: 'detective', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['detective'] ?? 0) >= 25,
  ),
  single(
    { key: 'reveal_imposter', name: 'Exposed!', description: 'Win a game where you were the detective', icon: '📸', category: 'detective', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.role === 'detective' && ctx.isWinner,
  ),
)

// ─── Imposter extras (8) ────────────────────────────────────────────────────

const imposterExtras = merge(
  single(
    { key: 'imposter_5', name: 'Con Artist', description: '5 imposter wins', icon: '🎪', category: 'imposter', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 5,
  ),
  single(
    { key: 'imposter_25', name: 'Master of Deception', description: '25 imposter wins', icon: '🕵️', category: 'imposter', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 25,
  ),
  single(
    { key: 'imposter_small_lobby', name: 'Tight Spot', description: 'Win as imposter in a 4-5 player game', icon: '🎯', category: 'imposter', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isImposter && ctx.isWinner && ctx.playerCount <= 5,
  ),
  single(
    { key: 'blended_in', name: 'Blended In', description: 'Survive as imposter in a 6+ player game', icon: '🫥', category: 'imposter', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isImposter && ctx.survived && ctx.playerCount >= 6,
  ),
  single(
    { key: 'imposter_all_modes', name: 'Omni-Imposter', description: 'Win as imposter in normal, special, and ranked modes', icon: '🎨', category: 'imposter', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 30 && ctx.stats.rankedWins >= 5,
  ),
  single(
    { key: 'imposter_streak_3', name: 'Triple Agent', description: 'Reach 3 imposter wins', icon: '🔱', category: 'imposter', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 3,
  ),
  single(
    { key: 'tricked_one', name: 'Trickster', description: 'Win as imposter after being suspected', icon: '🃏', category: 'imposter', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isImposter && ctx.isWinner,
  ),
  single(
    { key: 'shadow_master', name: 'Shadow Master', description: 'Reach 75 imposter wins', icon: '🌑', category: 'imposter', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 75,
  ),
)

// ─── Gameplay extras (20) ───────────────────────────────────────────────────

const gameplayExtras = merge(
  single(
    { key: 'vote_streak_3', name: 'Sherlock', description: 'Win 3 games while voting correctly', icon: '🔍', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && !ctx.isImposter && ctx.stats.totalWins >= 3,
  ),
  single(
    { key: 'five_streak', name: 'On Fire', description: 'Reach 5 total wins', icon: '🔥', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 5,
  ),
  single(
    { key: 'ten_streak', name: 'Unstoppable', description: 'Reach 25 total wins', icon: '⚡', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 25,
  ),
  single(
    { key: 'twenty_streak', name: 'Godlike', description: 'Reach 250 total wins', icon: '🌌', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 250,
  ),
  single(
    { key: 'obsessed', name: 'Obsessed', description: 'Play 500 games', icon: '💎', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 500,
  ),
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
    { key: 'comeback_artist', name: 'Comeback Artist', description: 'Win a game with a non-villager role after losing 3 straight', icon: '🎨', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.stats.totalGames - ctx.stats.totalWins >= 3,
  ),
  single(
    { key: 'centurion', name: 'Centurion', description: 'Play 100 games in Normal mode', icon: '🏛️', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100,
  ),
  single(
    { key: 'triathlete', name: 'Triathlete', description: 'Win in normal, special, and ranked modes', icon: '🏅', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.rankedWins >= 1 && ctx.stats.totalWins >= 20,
  ),
  single(
    { key: 'special_mode_master', name: 'Special Mode Master', description: 'Win 25 Special mode games', icon: '✨', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.gameMode === 'special',
  ),
  single(
    { key: 'early_bird_player', name: 'First to the Table', description: 'Play your 5th game', icon: '🥚', category: 'gameplay', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 5,
  ),
  single(
    { key: 'veteran_100', name: 'Hundred Club', description: 'Play your 100th game', icon: '💯', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100,
  ),
  single(
    { key: 'weekly_player', name: 'Weekly Player', description: 'Reach a 7-day play streak', icon: '📅', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 7,
  ),
  single(
    { key: 'monthly_player', name: 'Monthly Player', description: 'Reach a 30-day play streak', icon: '🗓️', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 30,
  ),
  single(
    { key: 'yearly_player', name: 'Yearly Player', description: 'Reach a 100-day play streak', icon: '🏅', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 100,
  ),
)

// ─── Secret extras (15) ─────────────────────────────────────────────────────

const secretExtras = merge(
  single(
    { key: 'unanimous_vote', name: 'Consensus', description: 'Win a game as a villager', icon: '🤝', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.role === 'villager',
  ),
  single(
    { key: 'last_second_vote', name: 'Clutch', description: 'Win a close game', icon: '⏱️', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.playerCount >= 6,
  ),
  single(
    { key: 'one_hp', name: 'One HP', description: 'Win as a surviving villager in a 6+ player game', icon: '❤️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.isWinner && ctx.survived && !ctx.isImposter && ctx.playerCount >= 6,
  ),
  single(
    { key: 'weekend_warrior', name: 'Weekend Warrior', description: 'Play a game on a Saturday or Sunday', icon: '🌴', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const d = ctx.now.getUTCDay()
      return d === 0 || d === 6
    },
  ),
  single(
    { key: 'all_weekdays', name: 'Full Week', description: 'Play games across all 7 weekdays at least once (time-gated)', icon: '🗓️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 7 && ctx.stats.dailyStreakCount >= 7,
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
    { key: 'balanced_diet', name: 'Balanced Diet', description: 'Win equal imposter and villager games (10 each)', icon: '⚖️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalImposterWins >= 10 && ctx.stats.totalVillagerWins >= 10,
  ),
  single(
    { key: 'first_dm', name: 'Hello!', description: 'Send your first direct message', icon: '✉️', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'dm_sent',
    (ctx) => ctx.stats.dmSentCount >= 1,
  ),
  single(
    { key: 'all_special_roles_play', name: 'Every Role', description: 'Play every special role at least once', icon: '🎭', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => Object.keys(ctx.stats.gamesByRole).length >= 14,
  ),
  single(
    { key: 'never_imposter', name: 'Always Good', description: 'Play 30 games without ever being imposter', icon: '😇', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 30 && (ctx.stats.gamesByRole['imposter'] ?? 0) === 0,
  ),
  single(
    { key: 'never_villager', name: 'Never a Farmer', description: 'Play 30 games without ever being a plain villager', icon: '🌪️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 30 && (ctx.stats.gamesByRole['villager'] ?? 0) === 0,
  ),
  single(
    { key: 'wooden_escape', name: 'Wooden Escape', description: 'Play a ranked game at Wooden tier', icon: '🪵', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.type === 'game_end' && ctx.gameMode === 'ranked' && ctx.stats.rankTier === 'wooden',
  ),
  single(
    { key: 'mythic_imposter_ratio', name: 'Mythic Deceiver', description: 'Win 500 imposter games with 70%+ imposter win rate', icon: '🌌', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const imposterGames =
        (ctx.stats.gamesByRole['imposter'] ?? 0) +
        (ctx.stats.gamesByRole['double_agent'] ?? 0) +
        (ctx.stats.gamesByRole['infiltrator'] ?? 0) +
        (ctx.stats.gamesByRole['kamikaze'] ?? 0) +
        (ctx.stats.gamesByRole['corruptor'] ?? 0) +
        (ctx.stats.gamesByRole['inverter'] ?? 0)
      return ctx.stats.totalImposterWins >= 500 && imposterGames > 0 &&
        ctx.stats.totalImposterWins / imposterGames >= 0.7
    },
  ),
)

// ─── Social extras (8) ──────────────────────────────────────────────────────

const socialExtras = merge(
  single(
    { key: 'honor_type_collector', name: 'Honor Collector', description: 'Receive 100 honors', icon: '💎', category: 'social', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 100,
  ),
  single(
    { key: 'team_player', name: 'Team Player', description: 'Receive 25 team player honors', icon: '🤝', category: 'social', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 25,
  ),
  single(
    { key: 'sharp_mind', name: 'Sharp Mind', description: 'Receive 50 honors', icon: '🧠', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 50,
  ),
  single(
    { key: 'good_sport', name: 'Good Sport', description: 'Give 100 honors', icon: '🏅', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'honor_given',
    (ctx) => ctx.stats.honorGivenCount >= 100,
  ),
  single(
    { key: 'beloved_bronze', name: 'Beloved', description: 'Receive 5 honors', icon: '💖', category: 'social', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'honor_received',
    (ctx) => ctx.stats.honorReceivedCount >= 5,
  ),
  single(
    { key: 'matchmaker', name: 'Matchmaker', description: 'Have 10 friends', icon: '💞', category: 'social', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'friend_added',
    (ctx) => ctx.stats.friendCount >= 10,
  ),
  single(
    { key: 'influencer', name: 'Influencer', description: 'Have 75 friends', icon: '📢', category: 'social', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'friend_added',
    (ctx) => ctx.stats.friendCount >= 75,
  ),
  single(
    { key: 'gifter_bronze', name: 'Gift Giver', description: 'Send 3 gifts', icon: '🎁', category: 'social', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'gift_sent',
    (ctx) => ctx.stats.giftSentCount >= 3,
  ),
)

// ─── Economy extras (9) ─────────────────────────────────────────────────────

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
    { key: 'shopper_bronze', name: 'Shopper', description: 'Buy 3 cosmetics', icon: '🛍️', category: 'economy', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 3,
  ),
  single(
    { key: 'big_spender', name: 'Big Spender', description: 'Own 10 cosmetics', icon: '💸', category: 'economy', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 10,
  ),
  single(
    { key: 'fashionista', name: 'Fashionista', description: 'Own 50 cosmetics', icon: '👠', category: 'economy', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 50,
  ),
  single(
    { key: 'collector_supreme', name: 'Collector Supreme', description: 'Own 100 cosmetics', icon: '🏆', category: 'economy', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 100,
  ),
  single(
    { key: 'whale', name: 'Whale', description: 'Hold 250,000 stars at once', icon: '🐋', category: 'economy', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.starCoinsCurrent >= 250000,
  ),
  single(
    { key: 'spender', name: 'Loose Pockets', description: 'Own 5 cosmetics', icon: '💳', category: 'economy', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'shop_purchase',
    (ctx) => ctx.stats.cosmeticOwnedCount >= 5,
  ),
)

// ─── Milestones extras (5) ──────────────────────────────────────────────────

const milestonesExtras = merge(
  single(
    { key: 'shopper_first', name: 'First Buy', description: 'Buy your first cosmetic', icon: '🛒', category: 'milestones', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'shop_purchase',
    (ctx) => ctx.stats.shopPurchaseCount >= 1,
  ),
  single(
    { key: 'all_categories', name: 'Well Rounded', description: 'Play 15 different word packs', icon: '📚', category: 'milestones', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.wordPacksCreated >= 3,
  ),
  single(
    { key: 'half_year', name: 'Half Year', description: 'Reach a 180-day streak', icon: '🗓️', category: 'milestones', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 180,
  ),
  single(
    { key: 'eternal_streak', name: 'Eternal Streak', description: 'Reach a 1000-day streak (mythic)', icon: '♾️', category: 'milestones', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'daily_login',
    (ctx) => ctx.stats.dailyStreakCount >= 1000,
  ),
  single(
    { key: 'word_pack_wizard', name: 'Pack Wizard', description: 'Create 10 custom word packs', icon: '🧙', category: 'milestones', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'word_pack_created',
    (ctx) => ctx.stats.wordPacksCreated >= 10,
  ),
)

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export const EXTRAS_DEFS: AchievementDef[] = [
  ...weekdayAchievements,
  ...monthAchievements,
  ...hourlyAchievements,
  ...detectiveExtras.defs,
  ...imposterExtras.defs,
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
  ...imposterExtras.evals,
  ...gameplayExtras.evals,
  ...secretExtras.evals,
  ...socialExtras.evals,
  ...economyExtras.evals,
  ...milestonesExtras.evals,
]
