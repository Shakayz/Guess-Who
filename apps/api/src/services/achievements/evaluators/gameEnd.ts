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
    name: (n) => n === 10 ? 'Warming Up' : `${n} Games Played`,
    description: (n) => n === 10 ? 'Play 10 games to prove this isn\'t a fluke' : `Play ${n} games`,
    event: 'game_end',
    getCount: (s) => s.totalGames,
    tiers: TIERS_6([10, 50, 200, 750, 3000, 15000]),
  }),
  progression({
    keyPrefix: 'wins',
    category: 'gameplay',
    icon: '🏆',
    name: (n) => n === 5 ? 'Getting Consistent' : `${n} Wins`,
    description: (n) => n === 5 ? 'Win 5 games' : `Win ${n} games total`,
    event: 'game_end',
    getCount: (s) => s.totalWins,
    tiers: TIERS_6([5, 25, 80, 250, 1000, 5000]),
  }),
  progression({
    keyPrefix: 'survived',
    category: 'gameplay',
    icon: '🛡️',
    name: (n) => n === 5 ? 'Survivor' : `Survived ${n} Games`,
    description: (n) =>
      n === 5
        ? 'Survive all rounds and win 5 games'
        : `Survive all rounds and win in ${n} different games`,
    event: 'game_end',
    getCount: (s) => s.survivedWins,
    tiers: TIERS_6([5, 25, 80, 250, 750, 3000]),
  }),
)

const gameplayOneOffs = merge(
  // Participation "rookie" stamp — replaces the too-easy first_vote / first_clue.
  single(
    { key: 'rookie', name: 'Rookie', description: 'Complete 10 games', icon: '🎓', category: 'gameplay', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 10,
  ),
  single(
    { key: 'correct_voter', name: 'Good Eye', description: 'Win 10 games on the villagers\' side', icon: '👁️', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.stats.totalVillagerWins >= 10,
  ),
  single(
    { key: 'clean_sweep', name: 'Clean Sweep', description: 'Win a villagers game where no villager was eliminated (you must survive too)', icon: '🧹', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    // Approximation: require winning+surviving as villager side AND a minimum
    // body of wins, so it can't fire trivially on the first game.
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers' && ctx.stats.totalVillagerWins >= 20,
  ),
  single(
    { key: 'full_lobby', name: 'Full House', description: 'Play a game with 10+ players (once you\'ve played at least 25 games)', icon: '🏠', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.playerCount >= 10 && ctx.stats.totalGames >= 25,
  ),
  single(
    { key: 'tiny_lobby', name: 'Intimate', description: 'Win a game with exactly 4 players after 25+ games', icon: '👥', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.playerCount === 4 && ctx.isWinner && ctx.stats.totalGames >= 25,
  ),
  single(
    { key: 'special_mode_win', name: 'Specialist', description: 'Win 10 Special mode games', icon: '✨', category: 'gameplay', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars },
    'game_end',
    // Approximation: require enough wins that it can't fire on the very first
    // Special-mode game. We don't track specialWins directly.
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.gameMode === 'special' && ctx.stats.totalWins >= 10,
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
    { key: 'every_role_veteran', name: 'True Polyglot', description: 'Play 10+ games as every single role', icon: '🌈', category: 'gameplay', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars },
    'game_end',
    (ctx) => {
      const roles = Object.values(ctx.stats.gamesByRole)
      return roles.length >= 14 && roles.every((c) => c >= 10)
    },
  ),
  single(
    { key: 'villager_100', name: 'Salt of the Earth', description: 'Win 100 games as a plain villager', icon: '🌾', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['villager'] ?? 0) >= 100,
  ),
  single(
    { key: 'winning_ratio', name: 'Winning Mindset', description: 'Maintain a 75% win rate over 100+ games', icon: '📈', category: 'gameplay', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100 && ctx.stats.totalWins / ctx.stats.totalGames >= 0.75,
  ),
  single(
    { key: 'role_specialist', name: 'Specialist', description: 'Reach 80% win rate in a single role over 25+ games as that role', icon: '🎯', category: 'gameplay', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => {
      for (const role of Object.keys(ctx.stats.gamesByRole)) {
        const games = ctx.stats.gamesByRole[role] ?? 0
        const wins = ctx.stats.winsByRole[role] ?? 0
        if (games >= 25 && wins / games >= 0.8) return true
      }
      return false
    },
  ),
  single(
    { key: 'dedicated_100', name: 'Dedicated', description: 'Play 100 games', icon: '🎯', category: 'gameplay', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 100,
  ),
  single(
    { key: 'versatile_champion', name: 'Versatile Champion', description: 'Win 50 games having won with 5 or more different roles', icon: '🎖️', category: 'gameplay', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 50 && Object.keys(ctx.stats.winsByRole).length >= 5,
  ),
)

// ─── RED_HANDED ───────────────────────────────────────────────────────────────

const redHandedProgression = progression({
  keyPrefix: 'red_handed_wins',
  category: 'red_handed',
  icon: '🎭',
  name: (n) => n === 5 ? 'First Disguise' : `${n} Imposter Wins`,
  description: (n) => n === 5 ? 'Win 5 games as the imposter' : `Win ${n} games as the imposter`,
  event: 'game_end',
  getCount: (s) => s.totalRedHandedWins,
  tiers: TIERS_6([5, 25, 80, 300, 1200, 5000]),
})

const redHandedOneOffs = merge(
  single(
    { key: 'perfect_red_handed', name: 'Untouchable', description: 'Survive and win 5 imposter games (with flawless stealth)', icon: '👻', category: 'red_handed', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    // Approximation: require many survived wins AND red_handed wins so this
    // can't fire on the very first imposter win.
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.survived && ctx.stats.totalRedHandedWins >= 5 && ctx.stats.survivedWins >= 5,
  ),
  single(
    { key: 'fooled_detective', name: 'Fooled the Detective', description: 'Reach 10 imposter wins in games where a detective was in play', icon: '🕶️', category: 'red_handed', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.stats.totalRedHandedWins >= 10,
  ),
  single(
    { key: 'big_lobby_red_handed', name: 'Wolf in the Flock', description: 'Win 3 imposter games in 10+ player lobbies', icon: '🐺', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    // Approximation: at least 3 imposter wins total AND this one is in a big lobby.
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.playerCount >= 10 && ctx.stats.totalRedHandedWins >= 3,
  ),
  single(
    { key: 'red_handed_ratio', name: 'Born Liar', description: 'Reach 80% imposter win rate over 50+ imposter games', icon: '🃏', category: 'red_handed', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
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
      return redHandedGames >= 50 && ctx.stats.totalRedHandedWins / redHandedGames >= 0.8
    },
  ),
  single(
    { key: 'silent_assassin', name: 'Silent Assassin', description: 'Reach 75 imposter wins total', icon: '🗡️', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 75,
  ),
  single(
    { key: 'phantom', name: 'Phantom', description: 'Reach 300 imposter wins', icon: '👤', category: 'red_handed', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 300,
  ),
  single(
    { key: 'deceiver_elite', name: 'Ghost in the Flock', description: 'Win 25 imposter games while surviving each one', icon: '🌫️', category: 'red_handed', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    // Approximation: red-handed wins >= 25 AND survived wins >= 25 AND both have
    // grown together, so it can't trigger from unrelated survived-villager wins.
    (ctx) => ctx.stats.totalRedHandedWins >= 25 && ctx.stats.survivedWins >= ctx.stats.totalRedHandedWins,
  ),
  single(
    { key: 'the_oracle', name: 'The Oracle', description: 'Win 1500 imposter games (nearly impossible)', icon: '🔮', category: 'red_handed', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 1500,
  ),
)

// ─── DETECTIVE ──────────────────────────────────────────────────────────────

const detectiveProgression = progression({
  keyPrefix: 'detective_wins',
  category: 'detective',
  icon: '🕵️',
  name: (n) => n === 5 ? 'First Investigation' : `${n} Detective Wins`,
  description: (n) => n === 5 ? 'Win 5 games as detective' : `Win ${n} games as detective`,
  event: 'game_end',
  getCount: (s) => s.winsByRole['detective'] ?? 0,
  tiers: TIERS_6([5, 20, 60, 175, 500, 1500]),
})

const detectiveOneOffs = merge(
  single(
    { key: 'chief_inspector', name: 'Chief Inspector', description: 'Play 50 games as detective', icon: '🎖️', category: 'detective', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars },
    'game_end',
    (ctx) => (ctx.stats.gamesByRole['detective'] ?? 0) >= 50,
  ),
  single(
    { key: 'cold_case', name: 'Cold Case', description: 'Win 5 detective games in 10+ player lobbies', icon: '❄️', category: 'detective', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    // Approximation: trigger when you win a 10+ lobby detective game and have
    // at least 5 detective wins in total.
    (ctx) => isGameEnd(ctx) && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 10 && (ctx.stats.winsByRole['detective'] ?? 0) >= 5,
  ),
  single(
    { key: 'panopticon', name: 'Panopticon', description: 'Win 50 detective games while surviving each one', icon: '🦅', category: 'detective', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => {
      return (ctx.stats.winsByRole['detective'] ?? 0) >= 50 && ctx.stats.survivedWins >= 50
    },
  ),
  single(
    { key: 'legendary_detective', name: 'Legendary Detective', description: 'Win 100 games as detective', icon: '🏅', category: 'detective', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['detective'] ?? 0) >= 100,
  ),
  single(
    { key: 'judge_jury_executioner', name: 'Judge, Jury, Executioner', description: 'Win 10+ games each as Detective, Judge and Mayor', icon: '⚖️', category: 'detective', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars },
    'game_end',
    (ctx) =>
      (ctx.stats.winsByRole['detective'] ?? 0) >= 10 &&
      (ctx.stats.winsByRole['judge'] ?? 0) >= 10 &&
      (ctx.stats.winsByRole['mayor'] ?? 0) >= 10,
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
  // 5 progression tiers per role: first win / 20 games / 10 wins / 50 wins / 200 wins.
  // "first win" is legitimate (you actually had to be that role AND win), but
  // the later tiers are raised significantly so they don't unlock casually.
  const entries: Array<{ key: string; n: number; wins: boolean; difficulty: any; name: string; description: string }> = [
    { key: `role_${role}_first`, n: 2, wins: true, difficulty: 'bronze', name: `${display} Debut`, description: `Win 2 games as ${display}` },
    { key: `role_${role}_play20`, n: 30, wins: false, difficulty: 'silver', name: `${display} Regular`, description: `Play 30 games as ${display}` },
    { key: `role_${role}_win10`, n: 15, wins: true, difficulty: 'gold', name: `${display} Veteran`, description: `Win 15 games as ${display}` },
    { key: `role_${role}_win50`, n: 75, wins: true, difficulty: 'platinum', name: `${display} Expert`, description: `Win 75 games as ${display}` },
    { key: `role_${role}_win200`, n: 300, wins: true, difficulty: 'diamond', name: `${display} Master`, description: `Win 300 games as ${display}` },
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
    // Was an easy "gold" that fired on any surviving villager-side win — essentially
    // the default successful-game outcome. Now requires a real body of work.
    { key: 'perfect_game', name: 'Flawless', description: 'Win 25 games as a surviving villager-side player', icon: '✨', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.stats.survivedWins >= 25,
  ),
  single(
    { key: 'betrayed', name: 'Betrayed!', description: 'Be eliminated and lose 10 times (welcome to the club)', icon: '🗡️', category: 'secret', difficulty: 'bronze', xpReward: REWARD.bronze.xp, coinReward: REWARD.bronze.stars, isSecret: true },
    'game_end',
    // Approximation: at least 10 losses total — without an "eliminations" counter
    // we can't be exact, but this keeps it from firing on the very first death.
    (ctx) => isGameEnd(ctx) && !ctx.survived && !ctx.isWinner && (ctx.stats.totalGames - ctx.stats.totalWins) >= 10,
  ),
  single(
    { key: 'pyrrhic_victory', name: 'Pyrrhic Victory', description: 'Win 5 games despite being eliminated yourself', icon: '💀', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    // Approximation: at least 5 wins where you did NOT survive — we know
    // (totalWins - survivedWins) is the count of won-but-eliminated games.
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.survived && (ctx.stats.totalWins - ctx.stats.survivedWins) >= 5,
  ),
  single(
    { key: 'night_owl', name: 'Night Owl', description: 'Finish 25 games between 2 AM and 5 AM (UTC)', icon: '🦉', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    // Approximation: we can only detect the current hour, but gating on
    // totalGames >= 25 ensures this doesn't fire trivially on game #1.
    (ctx) => {
      const h = ctx.now.getUTCHours()
      return h >= 2 && h < 5 && ctx.stats.totalGames >= 25
    },
  ),
  single(
    { key: 'early_bird', name: 'Early Bird', description: 'Finish 25 games between 5 AM and 7 AM (UTC)', icon: '🐦', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => {
      const h = ctx.now.getUTCHours()
      return h >= 5 && h < 7 && ctx.stats.totalGames >= 25
    },
  ),
  single(
    { key: 'witching_hour', name: 'Witching Hour', description: 'Finish a game in the 00:00 UTC hour (after 25+ games)', icon: '🌙', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCHours() === 0 && ctx.stats.totalGames >= 25,
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
    { key: 'draw_day', name: 'Nobody Wins', description: 'Finish a game that ends in a draw (genuinely rare)', icon: '🤝', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.winner === 'draw',
  ),
  single(
    { key: 'jester_jackpot', name: 'Jester Jackpot', description: 'Win 10 games as Jester', icon: '🃏', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalJesterWins >= 10,
  ),
  single(
    { key: 'evil_twins_win', name: 'Twin Bond', description: 'Win a game as the Evil Twins', icon: '👯‍♀️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.winner === 'evil_twins' && ctx.isWinner,
  ),
  single(
    { key: 'double_trouble', name: 'Double Trouble', description: 'Win at least once as both a Twin Villager AND a Twin Imposter', icon: '🎭', category: 'secret', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['twin_villager'] ?? 0) >= 1 && (ctx.stats.winsByRole['twin_red_handed'] ?? 0) >= 1,
  ),
  single(
    { key: 'bilingual', name: 'Bilingual', description: 'Play games in 2 different languages', icon: '🗣️', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.languagesPlayed >= 2,
  ),
  single(
    { key: 'language_polyglot', name: 'Polyglot', description: 'Play games in 3 different languages', icon: '🌍', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.languagesPlayed >= 3,
  ),
  single(
    { key: 'solo_survivor', name: 'Last Stand', description: 'Win 5 villager games where you were the sole survivor (6+ player lobbies)', icon: '🔥', category: 'secret', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars, isSecret: true },
    'game_end',
    // Approximation: winning, surviving, and playing 6+ lobbies — gated on having
    // won at least 5 such games so a single rescue doesn't trigger this.
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers' && ctx.playerCount >= 6 && ctx.stats.survivedWins >= 5,
  ),
  single(
    { key: 'midas_touch', name: 'Midas Touch', description: 'Win a game while sitting on a 28-day streak (4 weeks straight)', icon: '💰', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.stats.dailyStreakCount >= 28,
  ),
  single(
    { key: 'unwinnable', name: 'Unwinnable Odds', description: 'Win 10 villager games in 6+ player lobbies as the sole survivor', icon: '🏹', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.isRedHanded && ctx.survived && ctx.winner === 'villagers' && ctx.playerCount >= 6 && ctx.stats.survivedWins >= 10,
  ),
  single(
    { key: 'comeback_king', name: 'Comeback King', description: 'Win 10 imposter games as a survivor', icon: '👊', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isRedHanded && ctx.isWinner && ctx.survived && ctx.stats.totalRedHandedWins >= 10,
  ),
  // `blood_moon` removed: fired on any odd-numbered day (50% of days) — trivial.
  single(
    { key: 'friday_the_13th', name: 'Friday the 13th', description: 'Play a game on Friday the 13th specifically', icon: '🔪', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    // Must actually be a Friday that also lands on the 13th — was previously
    // "any 13th of the month" which is 12× more frequent.
    (ctx) => ctx.now.getUTCDate() === 13 && ctx.now.getUTCDay() === 5,
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
    { key: 'valentine_solo', name: 'Anti-Romance', description: 'Play a game on February 14th', icon: '💔', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.now.getUTCMonth() === 1 && ctx.now.getUTCDate() === 14,
  ),
  single(
    { key: 'marathon_night', name: 'Marathon Night', description: 'Play 25 games total (in any spacing)', icon: '🏃', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 25,
  ),
  single(
    { key: 'perseverance', name: 'Perseverance', description: 'Play 10 games without winning a single one', icon: '😤', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalGames >= 10 && ctx.stats.totalWins === 0,
  ),
  single(
    { key: 'underdog', name: 'Underdog', description: 'Score your first win after at least 10 losses', icon: '🐕', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.stats.totalGames >= 11 && ctx.stats.totalWins === 1,
  ),
  single(
    { key: 'devils_advocate', name: "Devil's Advocate", description: 'Win 5 games total as a Jester or Revenant', icon: '😈', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ((ctx.stats.winsByRole['jester'] ?? 0) + (ctx.stats.winsByRole['revenant'] ?? 0)) >= 5,
  ),
  single(
    { key: 'sixth_sense', name: 'Sixth Sense', description: 'Win 10 detective games (good instincts)', icon: '🔮', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.role === 'detective' && ctx.isWinner && (ctx.stats.winsByRole['detective'] ?? 0) >= 10,
  ),
  single(
    { key: 'twin_tragedy', name: 'Twin Tragedy', description: 'Lose 10 twin games (you and your partner eliminated)', icon: '💔', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) =>
      isGameEnd(ctx) && (ctx.role === 'twin_villager' || ctx.role === 'twin_red_handed') && !ctx.isWinner &&
      (((ctx.stats.gamesByRole['twin_villager'] ?? 0) - (ctx.stats.winsByRole['twin_villager'] ?? 0)) +
       ((ctx.stats.gamesByRole['twin_red_handed'] ?? 0) - (ctx.stats.winsByRole['twin_red_handed'] ?? 0))) >= 10,
  ),
  single(
    { key: 'twin_pyrrhic', name: 'Twin Pyrrhic', description: 'Survive 5 lost twin games', icon: '👻', category: 'secret', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars, isSecret: true },
    'game_end',
    (ctx) =>
      isGameEnd(ctx) && (ctx.role === 'twin_villager' || ctx.role === 'twin_red_handed') && ctx.survived && !ctx.isWinner &&
      ((ctx.stats.gamesByRole['twin_villager'] ?? 0) + (ctx.stats.gamesByRole['twin_red_handed'] ?? 0)) >= 10,
  ),
  single(
    { key: 'houdini', name: 'Houdini', description: 'Win 50 imposter games while surviving every one', icon: '🎩', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalRedHandedWins >= 50 && ctx.stats.survivedWins >= 50,
  ),
  single(
    { key: 'kingmaker', name: 'Kingmaker', description: 'Win 5 games as Jester', icon: '👑', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalJesterWins >= 5,
  ),
  single(
    { key: 'the_long_con', name: 'The Long Con', description: 'Win 200 ranked games having also reached 200 imposter wins', icon: '🎲', category: 'secret', difficulty: 'mythic', xpReward: REWARD.mythic.xp, coinReward: REWARD.mythic.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.rankedWins >= 200 && ctx.stats.totalRedHandedWins >= 200,
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
    { key: 'lucky_seven', name: 'Lucky Seven', description: 'Win on the 7th day of a month after 25+ games played', icon: '🍀', category: 'secret', difficulty: 'silver', xpReward: REWARD.silver.xp, coinReward: REWARD.silver.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && ctx.now.getUTCDate() === 7 && ctx.stats.totalGames >= 25,
  ),
  single(
    { key: 'triskaidekaphobia', name: 'Triskaidekaphobia', description: 'Reach exactly 13 total wins (caught for a moment)', icon: '🎱', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    // NOTE: this is a narrow window — if the user wins two games in quick
    // succession past 13 the check never fires. That's fine for a rare secret.
    (ctx) => ctx.stats.totalWins === 13,
  ),
  single(
    { key: 'hundred_percent', name: 'Hundred Percent', description: 'Reach 100 total wins at 60%+ win rate', icon: '💯', category: 'secret', difficulty: 'diamond', xpReward: REWARD.diamond.xp, coinReward: REWARD.diamond.stars, isSecret: true },
    'game_end',
    (ctx) => ctx.stats.totalWins >= 100 && ctx.stats.totalWins / Math.max(ctx.stats.totalGames, 1) >= 0.6,
  ),
  single(
    { key: 'triple_role', name: 'Triple Threat', description: 'Win games as 5 different roles', icon: '🎯', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    // Was "3 different roles" — unlocked too early. Now a proper mid-game goal.
    (ctx) => Object.keys(ctx.stats.winsByRole).length >= 5,
  ),
  single(
    { key: 'no_survivors', name: 'No Survivors', description: 'Win 5 games where you did NOT survive', icon: '💀', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.isWinner && !ctx.survived && (ctx.stats.totalWins - ctx.stats.survivedWins) >= 5,
  ),
  single(
    { key: 'all_seeing', name: 'All-Seeing', description: 'Win 5 detective games in 10+ player lobbies', icon: '👁️', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => isGameEnd(ctx) && ctx.role === 'detective' && ctx.isWinner && ctx.playerCount >= 10 && (ctx.stats.winsByRole['detective'] ?? 0) >= 5,
  ),
  single(
    { key: 'infiltrator_backstab', name: 'Backstab', description: 'Win 15 games as Infiltrator', icon: '🗡️', category: 'secret', difficulty: 'platinum', xpReward: REWARD.platinum.xp, coinReward: REWARD.platinum.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['infiltrator'] ?? 0) >= 15,
  ),
  single(
    { key: 'kamikaze_kingmaker', name: 'Kamikaze Kingmaker', description: 'Win 10 games as Kamikaze', icon: '💥', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['kamikaze'] ?? 0) >= 10,
  ),
  single(
    { key: 'revenant_haunting', name: 'Haunting', description: 'Win 10 games as Revenant', icon: '👻', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['revenant'] ?? 0) >= 10,
  ),
  single(
    { key: 'judge_hung_jury', name: 'Hung Jury', description: 'Win 10 games as Judge', icon: '⚖️', category: 'secret', difficulty: 'gold', xpReward: REWARD.gold.xp, coinReward: REWARD.gold.stars, isSecret: true },
    'game_end',
    (ctx) => (ctx.stats.winsByRole['judge'] ?? 0) >= 10,
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
