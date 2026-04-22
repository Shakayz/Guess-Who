// ─── User & Auth ────────────────────────────────────────────────────────────

export type Locale = 'en' | 'fr' | 'ar' | 'es' | 'it' | 'pt' | 'zh' | 'de' | 'ru' | 'hi'

export interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  locale: Locale
  starCoins: number
  rank: RankTier
  rankPoints: number
  honorPoints: number
  createdAt: string
  stats: UserStats
}

export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  timesRedHanded: number
  timesVillager: number
  correctVotes: number
  perfectRedHandedGames: number
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

export interface RankUpdate {
  newLP:    number
  newTier:  RankTier
  promoted: boolean
  demoted:  boolean
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

export type GameMode = 'normal' | 'special' | 'ranked'

export const WORD_CATEGORIES = [
  { key: 'food',         label: 'Food',          icon: '🍕' },
  { key: 'animals',      label: 'Animals',        icon: '🐾' },
  { key: 'music',        label: 'Music',          icon: '🎵' },
  { key: 'places',       label: 'Places',         icon: '📍' },
  { key: 'jobs',         label: 'Jobs',           icon: '💼' },
  { key: 'sports',       label: 'Sports',         icon: '⚽' },
  { key: 'movies',       label: 'Movies',         icon: '🎬' },
  { key: 'tech',         label: 'Tech',           icon: '💻' },
  { key: 'history',      label: 'History',        icon: '📜' },
  { key: 'mangas',       label: 'Mangas',         icon: '🈶' },
  { key: 'celebrities',  label: 'Celebrities',    icon: '⭐' },
  { key: 'variety',      label: 'Variety',        icon: '🎲' },
] as const

export type WordCategory = typeof WORD_CATEGORIES[number]['key']

export interface RoomSettings {
  maxPlayers: number
  minPlayers: number
  redHandedCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  wordPackId: string
  isPrivate: boolean
  /** Discoverability toggle for Custom Lobbies. When true, the lobby is listed
   *  in the public browser (GET /rooms/public). Pricing is identical either
   *  way — this is purely a visibility flag. Ranked rooms always have this
   *  false. Optional in transit for backwards compatibility with old clients. */
  isPublic?: boolean
  language: Locale
  gameMode: GameMode
  categories: WordCategory[]   // empty = all categories
  /** When true, the clue phase becomes a turn-based "speak out loud" round —
   *  each alive player gets `vocalSpeakingTimeSeconds` to talk, text input is
   *  hidden, and no clue text is submitted. Only available in unranked modes
   *  (normal + special). Ranked always uses typed clues. */
  vocalMode?: boolean
  /** Seconds per player when `vocalMode` is on. Defaults to 10 for unranked. */
  vocalSpeakingTimeSeconds?: number
  /** Blind role mode (normal-mode only). When true, each player only learns
   *  their word at game start — not whether they're a villager or an imposter.
   *  Roles are still revealed on elimination (to everyone) and in the final
   *  results screen. Ignored outside of normal mode. */
  blindMode?: boolean
}

// ─── Player ──────────────────────────────────────────────────────────────────

export type PlayerRole =
  | 'villager'
  | 'red_handed'
  | 'detective'
  | 'double_agent'
  | 'guardian'
  | 'mayor'
  | 'infiltrator'
  | 'jester'
  | 'judge'
  | 'revenant'
  | 'kamikaze'
  | 'corruptor'
  | 'inverter'
  | 'twin_villager'
  | 'twin_red_handed'
export type PlayerStatus = 'alive' | 'eliminated' | 'spectating' | 'forfeited'

export interface Player {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  /**
   * Populated from User.premiumUntil at the moment the player joins a room,
   * so every lobby/voting UI can render the crown badge without a per-render
   * /users/:id round-trip. Stale within a single game is fine — entitlement
   * only matters here for the badge itself.
   */
  isPremium?: boolean
  role?: PlayerRole
  status: PlayerStatus
  word?: string
  isHost: boolean
  isReady: boolean
  speakingOrder?: number
  honorGiven: boolean
  // ── Special-mode role state ─────────────────────────────────────────────────
  /** Mayor: has the player already used their one-shot double-vote? */
  mayorDoubleVoteUsed?: boolean
  /** Mayor: is the double-vote active for the current voting phase? Reset each round. */
  mayorDoubleActive?: boolean
  /** Inverter: has the player already used their one-shot vote inversion? */
  inverterUsed?: boolean
  /** Inverter: is the inversion active for the current voting phase? Reset each round. */
  inverterActive?: boolean
  /** Corruptor: userId of the player whose votes are silently dropped. Set once per game. */
  corruptorTargetUserId?: string
  /** Target-side flag: votes from this player are silently ignored while set. */
  corrupted?: boolean
  /** Revenant: how many post-mortem vote rounds this player still has. 0 = fully dead. */
  revenantVotesRemaining?: number
  /** Twin pairing: userId of the other twin (known to both twins from game start). */
  twinPartnerUserId?: string
  /** Socket dropped mid-game and the player hasn't rejoined yet. Distinct from
   *  `status === 'eliminated'`, which can also happen via vote or said-word. */
  disconnected?: boolean
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
  eliminationReason?: 'vote' | 'said_word'
  wordReveal: WordReveal | null
  tiedPlayerIds?: string[]
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
  // null = skipped / abstained vote — counts toward "has voted" but not toward elimination
  targetId: string | null
  timestamp: string
}

export interface WordReveal {
  villagerWord: string
  redHandedWord: string
  /** Category key the pair was drawn from (e.g. 'food', 'movies'). Optional
   *  for backwards compatibility with older payloads. */
  category?: WordCategory
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
  category: string
}

// ─── Game Events (Socket.IO) ──────────────────────────────────────────────────

export interface ServerToClientEvents {
  'room:updated': (room: Room) => void
  'game:started': (data: { round: Round; yourWord: string; yourRole?: PlayerRole; yourVillagerWord?: string; yourCategory?: WordCategory; isReconnect?: boolean }) => void
  'detective:result': (data: { targetUserId: string; targetUsername: string; role: PlayerRole }) => void
  'round:speaking-turn': (data: { playerId: string | null; timeSeconds: number; speakingOrder: string[] }) => void
  'round:clue-submitted': (clue: Clue) => void
  'round:vocal-turn': (data: { speakerId: string; speakerIndex: number; totalSpeakers: number; perTurnSeconds: number; totalSeconds: number; speakingOrder: string[] }) => void
  'round:voting-started': (data: { timeSeconds: number; players: Player[] }) => void
  'round:vote-cast': (data: { voterId: string; hasVoted: boolean }) => void
  'round:ended': (data: { round: Round; nextRound?: Round }) => void
  'round:word-said': (data: { playerId: string; username: string; clueText: string; role: PlayerRole }) => void
  'game:finished': (data: { winner: 'villagers' | 'red_handed' | 'draw' | 'jester' | 'evil_twins'; finalRound: Round; rewards: RewardSummary; yourRole?: PlayerRole }) => void
  'game:start:failed': (data: { reason: 'INSUFFICIENT_STARS'; userId: string; required: number }) => void
  'mayor:double-ack': (data: { userId: string }) => void
  'inverter:activate-ack': (data: { userId: string }) => void
  'corruptor:target-ack': (data: { targetUserId: string; targetUsername: string }) => void
  'kamikaze:select-prompt': (data: { candidateUserIds: string[]; kamikazeUserId: string; kamikazeUsername: string; timeSeconds: number }) => void
  'kamikaze:target-chosen': (data: { kamikazeUserId: string; targetUserId: string | null; targetUsername: string | null }) => void
  /** Private twin-to-twin message — only delivered to the two Evil Twins. */
  'twin:message': (data: { id: string; userId: string; username: string; text: string; createdAt: string }) => void
  'judge:decide-prompt': (data: { candidateUserIds: string[]; candidateUsernames: string[]; timeSeconds: number }) => void
  'judge:decided': (data: { judgeUserId: string; targetUserId: string; targetUsername: string }) => void
  'twin:partner': (data: { twinUserId: string; twinUsername: string; twinRole: PlayerRole }) => void
  'round:tiebreaker-start': (data: { tiedPlayerIds: string[]; tiedUsernames: string[]; timeSeconds: number }) => void
  'round:tiebreaker-voting': (data: { tiedPlayerIds: string[]; timeSeconds: number }) => void
  'game:sync': (data: { phase: 'speaking' | 'voting'; currentSpeakerId: string | null; speakingOrder: string[]; clues: Clue[]; votes: Vote[]; timeRemainingSeconds: number; currentRound: Round | null; tiebreakerActive?: boolean; tiebreakerPlayerIds?: string[]; tiebreakerPhase?: 'clue' | 'vote' }) => void
  'game:player-forfeited': (data: { userId: string; username: string }) => void
  'player:connection-changed': (data: { userId: string; disconnected: boolean }) => void
  'rank:updated': (data: { oldTier: RankTier; newTier: RankTier; newLP: number; promoted: boolean }) => void
  'player:joined': (player: Player) => void
  'player:left': (playerId: string) => void
  'player:ready': (data: { playerId: string; isReady: boolean }) => void
  'room:kicked': (data: { byUsername?: string }) => void
  'chat:message': (message: ChatMessage) => void
  'achievement:unlocked': (data: { key: string; name: string; icon: string; difficulty: string; category: string; starsReward: number; xpReward: number }) => void
  // ── Voice (WebRTC) signaling — vocal mode mic streaming ────────────────────
  /** Sent to a freshly-joined client with the list of peers already in the voice channel. */
  'voice:peers': (data: { peerUserIds: string[] }) => void
  /** Broadcast when a peer joins the voice channel. */
  'voice:peer-joined': (data: { userId: string }) => void
  /** Broadcast when a peer leaves the voice channel. */
  'voice:peer-left': (data: { userId: string }) => void
  /** Forwarded SDP/ICE payload from another peer. `signal` is opaque to the server. */
  'voice:signal': (data: { fromUserId: string; signal: unknown }) => void
  error: (data: { code: string; message: string }) => void
}

export interface ClientToServerEvents {
  'room:join': (data: { roomCode: string }) => void
  'room:leave': () => void
  'room:kick-player': (data: { targetUserId: string }) => void
  'room:transfer-host': (data: { targetUserId: string }) => void
  'player:ready': (isReady: boolean) => void
  'game:start': () => void
  'game:forfeit': () => void
  'game:leave-eliminated': () => void
  'clue:submit': (text: string) => void
  'clue:flag': (data: { cluePlayerId: string }) => void
  'vocal:skip-turn': () => void
  'vote:cast': (targetPlayerId: string | null) => void
  'chat:send': (text: string) => void
  'honor:give': (data: { targetPlayerId: string; honorType: HonorType }) => void
  'detective:reveal': (data: { targetUserId: string }) => void
  'mayor:activate-double': () => void
  'inverter:activate': () => void
  'corruptor:pick-target': (data: { targetUserId: string }) => void
  'kamikaze:pick-target': (data: { targetUserId: string }) => void
  /** Kamikaze: actively choose to spare everyone (no second elimination). */
  'kamikaze:skip': () => void
  'judge:pick-elimination': (data: { targetUserId: string }) => void
  /** Evil Twin private DM — sends a message to the other twin only. */
  'twin:send': (data: { text: string }) => void
  // ── Voice (WebRTC) signaling — vocal mode mic streaming ────────────────────
  /** Join the voice channel for the current room. Server replies with `voice:peers`. */
  'voice:join': () => void
  /** Leave the voice channel; broadcasts `voice:peer-left` to other peers. */
  'voice:leave': () => void
  /** Forward an opaque SDP/ICE signal to another peer in the same room. */
  'voice:signal': (data: { toUserId: string; signal: unknown }) => void
}

// ─── Matchmaking ─────────────────────────────────────────────────────────────

export interface MatchmakingStatus {
  queueSize: number
  needed: number
  elapsed: number
  maxWait: number
  idealPlayers: number
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
  /** +20 star bonus for the first online game finished today (UTC). */
  dailyBonusEarned?: number
  /** +100 star bonus given every 7 consecutive days played. */
  streakBonusEarned?: number
  /**
   * Star coins credited for each level gained this game (sum of `level × 10`
   * for every level crossed). Zero if the player didn't level up.
   */
  levelUpCoinsEarned?: number
  /** Rolling consecutive-day counter used for the "Day N/7" chip. */
  newStreakCount?: number
  /**
   * Entry fee the player actually paid to play this game (in stars).
   * 10 for matchmade/public games, 10 for private-lobby hosts (charged at
   * lobby creation), 0 for private-lobby joiners and offline games. Surfaced
   * so the Results screen can show the full net breakdown.
   */
  gameCostPaid?: number
}

export interface Achievement {
  id: string
  key: string
  name: string
  description: string
  icon: string
  unlockedAt: string
}

