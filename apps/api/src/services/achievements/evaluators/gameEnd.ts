// Evaluators that fire on the `game_end` event. Covers gameplay, redHanded,
// detective, and the in-game subset of secret achievements. Count-based
// achievements reuse the progression() factory; clever one-offs are listed
// individually with hand-written check logic.

import type { AchievementDef, Evaluator, EventContext, GameEndCtx } from '../types'
import { REWARD, TIERS_6, merge, progression, single } from './_helpers'

function isGameEnd(ctx: EventContext): ctx is GameEndCtx {
  return ctx.type === 'game_end'
}

// ─── GAMEPLAY ───────────────────────────────────────────────────────────────

const gameplayProgression = merge(
  progression({
    keyPrefix: 'games_played',
    category: 'gameplay',
    icon: '🎮',
    name: (n) => n === 1 ? 'Welcome!' : `${n} Games Played`,
    description: (n) => n === 1 ? 'Play your very first game' : `Play ${n} games`,
    event: 'game_end',
    getCount: (s) => s.totalGames,
    tiers: TIERS_6([1, 10, 50, 200, 1000, 5000]),
  }),
  progression({
    keyPrefix: 'wins',
    category: 'gameplay',
    icon: '🏆',
    name: (n) => n === 1 ? 'First Victory' : `${n} Wins`,
    description: (n) => n === 1 ? 'Win your very first game' : `Win ${n} games total`,
    event: 'game_end',
    getCount: (s) => s.totalWins,
    tiers: TIERS_6([1, 10, 50, 100, 500, 2500]),
  }),
  progression({
    keyPrefix: 'survived',
    category: 'gameplay',
    icon: '🛡️',
    name: (n) => n === 1 ? 'Survivor' : `Survived ${n} Games`,
    description: (n) =>
      n === 1
        ? 'Survive all rounds and win a game'
        : `Survive all rounds and win in ${n} different games`,
    event: 'game_end',
    getCount: (s) => s.survivedWins,
    tiers: TIERS_6([1, 5, 20, 75, 250, 1000]),
  }),
)

const gameplayOneOffs = merge(
  single(
    { key: 'first_vote', name: 'Democracy!', description: 'Cast your first vote', icon: '🗳️', category: 'gameplay', difficulty: 'bronze', xpReward: 5, coinReward: 10 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.stats.totalGames >= 1,
  ),
  single(
    { key: 'first_clue', name: 'Speak Up', description: 'Submit your first clue', icon: '💬', category: 'gameplay', difficulty: 'bronze', xpReward: 5, coinReward: 10 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.stats.totalGames >= 1,
  ),
  single(
    { key: 'correct_voter', name: 'Good Eye', description: 'Win a game after voting correctly to eliminate a red-handed', icon: '👁️', category: 'gameplay', difficulty: 'bronze', xpReward: 10, coinReward: 15 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded,
  ),
  single(
    { key: 'clean_sweep', name: 'Clean Sweep', description: 'Win a game as the villagers without losing anyone', icon: '🧹', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers',
  ),
  single(
    { key: 'full_lobby', name: 'Full House', description: 'Play a game with 10 or more players', icon: '🏠', category: 'gameplay', difficulty: 'silver', xpReward: 25, coinReward: 40 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.playerCount >= 10,
  ),
  single(
    { key: 'tiny_lobby', name: 'Intimate', description: 'Play a game with exactly 4 players', icon: '👥', category: 'gameplay', difficulty: 'bronze', xpReward: 10, coinReward: 15 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.playerCount === 4,
  ),
  single(
    { key: 'special_mode_win', name: 'Specialist', description: 'Win a game in Special mode', icon: '✨', category: 'gameplay', difficulty: 'silver', xpReward: 30, coinReward: 45 },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.gameMode === 'special',
  ),
  single(
    { key: 'all_roles_10', name: 'Jack of All Trades', description: 'Play 10 different roles', icon: '🎭', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => Object.keys(ctx.stats.gamesByRole).length >= 10,
  ),
  single(
    { key: 'all_roles_14', name: 'Chimera', description: 'Play every role at least once', icon: '🦁', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => Object.keys(ctx.stats.gamesByRole).length >= 14,
  ),
  single(
    { key: 'villager_100', name: 'Salt of the Earth', description: 'Win 100 games as a plain villager', icon: '🌾', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['villager'] ?? 0) >= 100,
  ),
  single(
    { key: 'winning_ratio', name: 'Winning Mindset', description: 'Maintain a 75% win rate over 50+ games', icon: '📈', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 50 && ctx.stats.totalWins / ctx.stats.totalGames >= 0.75,
  ),
  single(
    { key: 'dedicated_100', name: 'Dedicated', description: 'Play 100 games', icon: '🎯', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100,
  ),
)

// ─── RED_HANDED ───────────────────────────────────────────────────────────────

const redHandedProgression = progression({
  keyPrefix: 'red_handed_wins',
  category: 'red_handed',
  icon: '🎭',
  name: (n) => n === 1 ? 'First Disguise' : `${n} Imposter Wins`,
  description: (n) => n === 1 ? 'Win a game as the imposter' : `Win ${n} games as the imposter`,
  event: 'game_end',
  getCount: (s) => s.totalRedHandedWins,
  tiers: TIERS_6([1, 5, 25, 100, 500, 2000]),
})

const redHandedOneOffs = merge(
  single(
    { key: 'perfect_red_handed', name: 'Untouchable', description: 'Win as imposter without being eliminated', icon: '👻', category: 'red_handed', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.survived,
  ),
  single(
    { key: 'fooled_detective', name: 'Fooled the Detective', description: 'Win as imposter in a game with a detective', icon: '🕶️', category: 'red_handed', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner,
  ),
  single(
    { key: 'big_lobby_red_handed', name: 'Wolf in the Flock', description: 'Win as imposter in a 10+ player game', icon: '🐺', category: 'red_handed', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.playerCount >= 10,
  ),
  single(
    { key: 'red_handed_ratio', name: 'Born Liar', description: 'Reach 80% red-handed win rate over 25+ red-handed games', icon: '🃏', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => {
      const redHandedGames =
        (ctx.stats.gamesByRole['red_handed'] ?? 0) +
        (ctx.stats.gamesByRole['double_agent'] ?? 0) +
        (ctx.stats.gamesByRole['infiltrator'] ?? 0) +
        (ctx.stats.gamesByRole['kamikaze'] ?? 0) +
        (ctx.stats.gamesByRole['corruptor'] ?? 0) +
        (ctx.stats.gamesByRole['inverter'] ?? 0) +
        (ctx.stats.gamesByRole['twin_red_handed'] ?? 0)
      return redHandedGames >= 25 && ctx.stats.totalRedHandedWins / redHandedGames >= 0.8
    },
  ),
  single(
    { key: 'silent_assassin', name: 'Silent Assassin', description: 'Reach 50 red-handed wins total', icon: '🗡️', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 50,
  ),
  single(
    { key: 'phantom', name: 'Phantom', description: 'Reach 200 red-handed wins', icon: '👤', category: 'red_handed', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 200,
  ),
  single(
    { key: 'the_oracle', name: 'The Oracle', description: 'Win 1000 red-handed games (nearly impossible)', icon: '🔮', category: 'red_handed', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 1000,
  ),
)

// ─── DETECTIVE ──────────────────────────────────────────────────────────────

const detectiveProgression = progression({
  keyPrefix: 'detective_wins',
  category: 'detective',
  icon: '🕵️',
  name: (n) => n === 1 ? 'First Investigation' : `${n} Detective Wins`,
  description: (n) => n === 1 ? 'Win your first game as detective' : `Win ${n} games as detective`,
  event: 'game_end',
  getCount: (s) => s.winsByRole['detective'] ?? 0,
  tiers: TIERS_6([1, 5, 15, 50, 150, 500]),
})

const detectiveOneOffs = merge(
  single(
    { key: 'chief_inspector', name: 'Chief Inspector', description: 'Play 25 games as detective', icon: '🎖️', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 25,
  ),
  single(
    { key: 'cold_case', name: 'Cold Case', description: 'Win as detective in a 10+ player game', icon: '❄️', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 10,
  ),
  single(
    { key: 'panopticon', name: 'Panopticon', description: 'Survive 25 games as detective', icon: '🦅', category: 'detective', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => {
      // We approximate "survived 25 detective games" by requiring at least
      // 25 detective wins that survived — survivedWins already counts
      // all survived wins, so this is a conservative gate.
      return (ctx.stats.winsByRole['detective'] ?? 0) >= 25 && ctx.stats.survivedWins >= 25
    },
  ),
  single(
    { key: 'legendary_detective', name: 'Legendary Detective', description: 'Win 50 games as detective', icon: '🏅', category: 'detective', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['detective'] ?? 0) >= 50,
  ),
)

// ─── SPECIAL_ROLE (14 × 5 = 70) ─────────────────────────────────────────────

const SPECIAL_ROLES: Array<{ role: string; icon: string; display: string }> = [
  { role: 'villager',       icon: '🌾',  display: 'Villager' },
  { role: 'detective',      icon: '🕵️',  display: 'Detective' },
  { role: 'guardian',       icon: '🛡️',  display: 'Guardian' },
  { role: 'mayor',          icon: '👔',  display: 'Mayor' },
  { role: 'judge',          icon: '⚖️',  display: 'Judge' },
  { role: 'revenant',       icon: '💀',  display: 'Revenant' },
  { role: 'twin_villager',  icon: '👯',  display: 'Twin Villager' },
  { role: 'red_handed',       icon: '🎭',  display: 'Imposter' },
  { role: 'double_agent',   icon: '🎰',  display: 'Double Agent' },
  { role: 'infiltrator',    icon: '🥷',  display: 'Infiltrator' },
  { role: 'kamikaze',       icon: '💣',  display: 'Kamikaze' },
  { role: 'corruptor',      icon: '🧪',  display: 'Corruptor' },
  { role: 'inverter',       icon: '🔄',  display: 'Inverter' },
  { role: 'jester',         icon: '🎪',  display: 'Jester' },
]

const specialRoleDefs: AchievementDef[] = []
const specialRoleEvals: Evaluator[] = []
for (const { role, icon, display } of SPECIAL_ROLES) {
  // 5 progression tiers per role: first win / 5 / 25 / 100 wins + play 10 games
  const entries: Array<{ key: string; n: number; wins: boolean; difficulty: any; name: string; description: string }> = [
    { key: `role_${role}_first`, n: 1, wins: true, difficulty: 'bronze', name: `${display} Debut`, description: `Win your first game as ${display}` },
    { key: `role_${role}_play10`, n: 10, wins: false, difficulty: 'silver', name: `${display} Regular`, description: `Play 10 games as ${display}` },
    { key: `role_${role}_win5`, n: 5, wins: true, difficulty: 'silver', name: `${display} Veteran`, description: `Win 5 games as ${display}` },
    { key: `role_${role}_win25`, n: 25, wins: true, difficulty: 'gold', name: `${display} Expert`, description: `Win 25 games as ${display}` },
    { key: `role_${role}_win100`, n: 100, wins: true, difficulty: 'platinum', name: `${display} Master`, description: `Win 100 games as ${display}` },
  ]
  for (const e of entries) {
    const reward = REWARD[e.difficulty as keyof typeof REWARD]
    specialRoleDefs.push({
      key: e.key,
      name: e.name,
      description: e.description,
      icon,
      category: 'special_role',
      difficulty: e.difficulty,
      xpReward: reward.xp,
      coinReward: reward.stars,
    })
    specialRoleEvals.push({
      key: e.key,
      event: 'game_end',
      check: (ctx) => {
        const stats = ctx.stats
        return e.wins
          ? (stats.winsByRole[role] ?? 0) >= e.n
          : (stats.gamesByRole[role] ?? 0) >= e.n
      },
    })
  }
}

// ─── SECRET (game-end subset) ───────────────────────────────────────────────

const secretGameEnd = merge(
  single(
    { key: 'perfect_game', name: 'Flawless', description: 'Win a game as a surviving villager-side player', icon: '✨', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived,
  ),
  single(
    { key: 'betrayed', name: 'Betrayed!', description: 'Lose a game where you were eliminated', icon: '🗡️', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && !ctx.survived && !ctx.isWinner,
  ),
  single(
    { key: 'pyrrhic_victory', name: 'Pyrrhic Victory', description: 'Win a game despite being eliminated yourself', icon: '💀', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.survived,
  ),
  single(
    { key: 'night_owl', name: 'Night Owl', description: 'Finish a game between 2 AM and 5 AM (UTC)', icon: '🦉', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const h = ctx.now.getUTCHours()
      return h >= 2 && h < 5
    },
  ),
  single(
    { key: 'early_bird', name: 'Early Bird', description: 'Finish a game between 5 AM and 7 AM (UTC)', icon: '🐦', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const h = ctx.now.getUTCHours()
      return h >= 5 && h < 7
    },
  ),
  single(
    { key: 'witching_hour', name: 'Witching Hour', description: 'Finish a game exactly at midnight (UTC hour 0)', icon: '🌙', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCHours() === 0,
  ),
  single(
    { key: 'full_moon', name: 'Full Moon', description: 'Finish 50 games between 10 PM and 2 AM (UTC)', icon: '🌕', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => {
      // Can only increment this on a qualifying hour, so we gate on the hour
      // and require 50 games total — an imperfect but safe approximation.
      const h = ctx.now.getUTCHours()
      const inWindow = h >= 22 || h < 2
      return inWindow && ctx.stats.totalGames >= 50
    },
  ),
  single(
    { key: 'draw_day', name: 'Nobody Wins', description: 'Finish a game that ends in a draw', icon: '🤝', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.winner === 'draw',
  ),
  single(
    { key: 'jester_jackpot', name: 'Jester Jackpot', description: 'Win 5 games as Jester', icon: '🃏', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalJesterWins >= 5,
  ),
  single(
    { key: 'evil_twins_win', name: 'Twin Bond', description: 'Win a game as the Evil Twins', icon: '👯‍♀️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.winner === 'evil_twins' && ctx.isWinner,
  ),
  single(
    { key: 'language_polyglot', name: 'Polyglot', description: 'Play games in 3 different languages', icon: '🌍', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.languagesPlayed >= 3,
  ),
  single(
    { key: 'solo_survivor', name: 'Last Stand', description: 'Win as the last surviving villager-side player', icon: '🔥', category: 'secret', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers',
  ),
  single(
    { key: 'midas_touch', name: 'Midas Touch', description: 'Earn 150+ stars in a single game (daily + streak stacked)', icon: '💰', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    // Approximation: mythic rarity, gate on rank + streak + winning
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.stats.dailyStreakCount > 0 && ctx.stats.dailyStreakCount % 7 === 0,
  ),
  single(
    { key: 'unwinnable', name: 'Unwinnable Odds', description: 'Win a villagers game where you were the last one alive', icon: '🏹', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers' && ctx.playerCount >= 6,
  ),
  single(
    { key: 'comeback_king', name: 'Comeback King', description: 'Win a game as imposter after being targeted', icon: '👊', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.survived,
  ),
  single(
    { key: 'blood_moon', name: 'Blood Moon', description: 'Finish a game on a day ending in an odd number', icon: '🩸', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCDate() % 2 === 1,
  ),
  single(
    { key: 'friday_the_13th', name: 'Friday the 13th', description: 'Play a game on the 13th of a month', icon: '🔪', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCDate() === 13,
  ),
  single(
    { key: 'april_fool', name: 'April Fool', description: 'Play a game on April 1st', icon: '🃏', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCMonth() === 3 && ctx.now.getUTCDate() === 1,
  ),
  single(
    { key: 'new_year', name: 'New Year Winner', description: 'Win a game on January 1st', icon: '🎆', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.now.getUTCMonth() === 0 && ctx.now.getUTCDate() === 1,
  ),
  single(
    { key: 'christmas_win', name: 'Christmas Spirit', description: 'Win a game on December 25th', icon: '🎄', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.now.getUTCMonth() === 11 && ctx.now.getUTCDate() === 25,
  ),
  single(
    { key: 'halloween_red_handed', name: 'Costume Party', description: 'Win as imposter on October 31st', icon: '🎃', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.now.getUTCMonth() === 9 && ctx.now.getUTCDate() === 31,
  ),
  single(
    { key: 'valentine_solo', name: 'Anti-Romance', description: 'Play solo on February 14th', icon: '💔', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCMonth() === 1 && ctx.now.getUTCDate() === 14,
  ),
  single(
    { key: 'marathon_night', name: 'Marathon Night', description: 'Play 10 games in a row without logging out', icon: '🏃', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 10,
  ),
  single(
    { key: 'perseverance', name: 'Perseverance', description: 'Play 5 games without winning a single one', icon: '😤', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 5 && ctx.stats.totalWins === 0,
  ),
  single(
    { key: 'underdog', name: 'Underdog', description: 'Win a game after losing your previous 5', icon: '🐕', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.stats.totalGames >= 6 && ctx.stats.totalWins === 1,
  ),
  single(
    { key: 'devils_advocate', name: "Devil's Advocate", description: 'Win a game as a non-red-handed role that is rarely trusted', icon: '😈', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && (ctx.role === 'jester' || ctx.role === 'revenant'),
  ),
  single(
    { key: 'sixth_sense', name: 'Sixth Sense', description: 'Win 3 games as detective in a row (tracked via total)', icon: '🔮', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.role === 'detective' && (ctx.stats.winsByRole['detective'] ?? 0) >= 3,
  ),
  single(
    { key: 'twin_tragedy', name: 'Twin Tragedy', description: 'Lose a twin game when your partner was eliminated', icon: '💔', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && (ctx.role === 'twin_villager' || ctx.role === 'twin_red_handed') && !ctx.isWinner,
  ),
  single(
    { key: 'twin_pyrrhic', name: 'Twin Pyrrhic', description: 'Survive as twin in a lost twin game', icon: '👻', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && (ctx.role === 'twin_villager' || ctx.role === 'twin_red_handed') && ctx.survived && !ctx.isWinner,
  ),
  single(
    { key: 'houdini', name: 'Houdini', description: 'Win 25 red-handed games while surviving every one', icon: '🎩', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 25 && ctx.stats.survivedWins >= 25,
  ),
  single(
    { key: 'kingmaker', name: 'Kingmaker', description: 'Win 3 games as Jester', icon: '👑', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalJesterWins >= 3,
  ),
  single(
    { key: 'the_long_con', name: 'The Long Con', description: 'Win 100 ranked red-handed games', icon: '🎲', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.rankedWins >= 100 && ctx.stats.totalRedHandedWins >= 100,
  ),
  single(
    { key: 'seven_roles', name: 'Jack-of-Seven', description: 'Win at least once as 7 different roles', icon: '🎰', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => Object.keys(ctx.stats.winsByRole).length >= 7,
  ),
  single(
    { key: 'fourteen_roles', name: 'Omni-role', description: 'Win at least once as every role', icon: '🌟', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => Object.keys(ctx.stats.winsByRole).length >= 14,
  ),
  single(
    { key: 'lucky_seven', name: 'Lucky Seven', description: 'Win on the 7th day of a month', icon: '🍀', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.now.getUTCDate() === 7,
  ),
  single(
    { key: 'triskaidekaphobia', name: 'Triskaidekaphobia', description: 'Win exactly 13 games total', icon: '🎱', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalWins === 13,
  ),
  single(
    { key: 'hundred_percent', name: 'Hundred Percent', description: 'Reach 100 total wins with a positive win rate', icon: '💯', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 100 && ctx.stats.totalWins * 2 > ctx.stats.totalGames,
  ),
  single(
    { key: 'triple_role', name: 'Triple Threat', description: 'Win games as 3 different special roles', icon: '🎯', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => Object.keys(ctx.stats.winsByRole).length >= 3,
  ),
  single(
    { key: 'no_survivors', name: 'No Survivors', description: 'Win a game where you did not survive', icon: '💀', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.survived,
  ),
  single(
    { key: 'all_seeing', name: 'All-Seeing', description: 'Play detective in a 10+ player game and win', icon: '👁️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 10,
  ),
  single(
    { key: 'infiltrator_backstab', name: 'Backstab', description: 'Win 10 games as Infiltrator', icon: '🗡️', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['infiltrator'] ?? 0) >= 10,
  ),
  single(
    { key: 'kamikaze_kingmaker', name: 'Kamikaze Kingmaker', description: 'Win 5 games as Kamikaze', icon: '💥', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['kamikaze'] ?? 0) >= 5,
  ),
  single(
    { key: 'revenant_haunting', name: 'Haunting', description: 'Win 5 games as Revenant', icon: '👻', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['revenant'] ?? 0) >= 5,
  ),
  single(
    { key: 'judge_hung_jury', name: 'Hung Jury', description: 'Win 5 games as Judge', icon: '⚖️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['judge'] ?? 0) >= 5,
  ),
)

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export const GAME_END_DEFS: AchievementDef[] = [
  ...gameplayProgression.defs,
  ...gameplayOneOffs.defs,
  ...redHandedProgression.defs,
  ...redHandedOneOffs.defs,
  ...detectiveProgression.defs,
  ...detectiveOneOffs.defs,
  ...specialRoleDefs,
  ...secretGameEnd.defs,
]

export const GAME_END_EVALS: Evaluator[] = [
  ...gameplayProgression.evals,
  ...gameplayOneOffs.evals,
  ...redHandedProgression.evals,
  ...redHandedOneOffs.evals,
  ...detectiveProgression.evals,
  ...detectiveOneOffs.evals,
  ...specialRoleEvals,
  ...secretGameEnd.evals,
]
