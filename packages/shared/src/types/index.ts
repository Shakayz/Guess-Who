// ─── User & Auth ────────────────────────────────────────────────────────────

export type Locale = 'en' | 'fr' | 'ar' | 'es' | 'de'

export interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  locale: Locale
  starCoins: number
  goldCoins: number
  rank: RankTier
  rankPoints: number
  honorPoints: number
  createdAt: string
  stats: UserStats
}

export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  timesImposter: number
  timesVillager: number
  correctVotes: number
  perfectImposterGames: number
}

// ─── Rank ───────────────────────────────────────────────────────────────────

export type RankTier =
  | 'wooden'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'diamond'
  | 'master'
  | 'grandmaster'

export interface RankInfo {
  tier: RankTier
  lp: number
  lpRequired: number
  label: string
  color: string
  icon: string
}

// ─── Game Room ───────────────────────────────────────────────────────────────

export type GameStatus = 'waiting' | 'in_progress' | 'voting' | 'reveal' | 'finished'

export interface Room {
  id: string
  code: string
  hostId: string
  status: GameStatus
  players: Player[]
  settings: RoomSettings
  currentRound: number
  maxRounds: number
  createdAt: string
}

export type GameMode = 'normal' | 'ranked'

export const WORD_CATEGORIES = [
  { key: 'food',      label: 'Food',       icon: '🍕' },
  { key: 'animals',   label: 'Animals',    icon: '🐾' },
  { key: 'music',     label: 'Music',      icon: '🎵' },
  { key: 'nature',    label: 'Nature',     icon: '🌿' },
  { key: 'drinks',    label: 'Drinks',     icon: '☕' },
  { key: 'places',    label: 'Places',     icon: '📍' },
  { key: 'transport', label: 'Transport',  icon: '🚀' },
  { key: 'jobs',      label: 'Jobs',       icon: '💼' },
  { key: 'sports',    label: 'Sports',     icon: '⚽' },
  { key: 'movies',    label: 'Movies',     icon: '🎬' },
  { key: 'tech',      label: 'Tech',       icon: '💻' },
  { key: 'history',   label: 'History',    icon: '📜' },
] as const

export type WordCategory = typeof WORD_CATEGORIES[number]['key']

export interface RoomSettings {
  maxPlayers: number
  minPlayers: number
  imposterCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  wordPackId: string
  isPrivate: boolean
  language: Locale
  gameMode: GameMode
  categories: WordCategory[]   // empty = all (used in ranked)
}

// ─── Player ──────────────────────────────────────────────────────────────────

export type PlayerRole = 'villager' | 'imposter' | 'detective' | 'double_agent'
export type PlayerStatus = 'alive' | 'eliminated' | 'spectating'

export interface Player {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  role?: PlayerRole
  status: PlayerStatus
  word?: string
  isHost: boolean
  isReady: boolean
  speakingOrder?: number
  honorGiven: boolean
}

// ─── Round ───────────────────────────────────────────────────────────────────

export interface Round {
  id: string
  roundNumber: number
  speakingOrder: string[]
  clues: Clue[]
  votes: Vote[]
  eliminatedPlayerId: string | null
  eliminatedRole: PlayerRole | null
  wordReveal: WordReveal | null
}

export interface Clue {
  playerId: string
  text: string
  timestamp: string
  flaggedForWord: boolean
  flagVotes: string[]
}

export interface Vote {
  voterId: string
  targetId: string
  timestamp: string
}

export interface WordReveal {
  villagerWord: string
  imposterWord: string
}

// ─── Word Packs ───────────────────────────────────────────────────────────────

export interface WordPack {
  id: string
  name: string
  description: string
  isPremium: boolean
  locale: Locale
  pairs: WordPair[]
  authorId: string | null
  downloads: number
}

export interface WordPair {
  id: string
  wordA: string
  wordB: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
}

// ─── Game Events (Socket.IO) ──────────────────────────────────────────────────

export interface ServerToClientEvents {
  'room:updated': (room: Room) => void
  'game:started': (data: { round: Round; yourWord: string; yourRole: PlayerRole }) => void
  'round:speaking-turn': (data: { playerId: string; timeSeconds: number }) => void
  'round:clue-submitted': (clue: Clue) => void
  'round:voting-started': (data: { timeSeconds: number }) => void
  'round:vote-cast': (data: { voterId: string; hasVoted: boolean }) => void
  'round:ended': (data: { round: Round; nextRound?: Round }) => void
  'game:finished': (data: { winner: 'villagers' | 'imposters'; finalRound: Round; rewards: RewardSummary }) => void
  'player:joined': (player: Player) => void
  'player:left': (playerId: string) => void
  'player:ready': (data: { playerId: string; isReady: boolean }) => void
  'chat:message': (message: ChatMessage) => void
  error: (data: { code: string; message: string }) => void
}

export interface ClientToServerEvents {
  'room:join': (data: { roomCode: string }) => void
  'room:leave': () => void
  'player:ready': (isReady: boolean) => void
  'game:start': () => void
  'clue:submit': (text: string) => void
  'clue:flag': (data: { cluePlayerId: string }) => void
  'vote:cast': (targetPlayerId: string) => void
  'chat:send': (text: string) => void
  'honor:give': (data: { targetPlayerId: string; honorType: HonorType }) => void
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: string
  type: 'chat' | 'system' | 'game'
}

// ─── Honor & Rewards ─────────────────────────────────────────────────────────

export type HonorType = 'teamplayer' | 'sharp_mind' | 'good_sport'

export interface RewardSummary {
  starCoinsEarned: number
  xpEarned: number
  lpChange: number
  achievements: Achievement[]
}

export interface Achievement {
  id: string
  key: string
  name: string
  description: string
  icon: string
  unlockedAt: string
}

// ─── Shop & Cosmetics ─────────────────────────────────────────────────────────

export type CosmeticType = 'avatar_outfit' | 'avatar_accessory' | 'card_background' | 'word_effect' | 'title' | 'badge'

export interface Cosmetic {
  id: string
  type: CosmeticType
  name: string
  description: string
  imageUrl: string
  price: number
  currency: 'star' | 'gold'
  isLimited: boolean
  seasonId: string | null
}
