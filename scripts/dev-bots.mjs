#!/usr/bin/env node
/**
 * dev-bots.mjs — spin up N fake players to test multiplayer modes in staging/dev.
 *
 * Why this exists
 * ---------------
 * The server has no bots, no dev bypass, and enforces:
 *   - MIN_PLAYERS = 3 for Unranked / Create Lobby   (packages/shared/src/constants/index.ts)
 *   - RANKED_PLAYERS = 10 for Ranked                (apps/api/src/socket/handlers/matchmaking.ts)
 *   - deduplication by userId (no multi-tab trick)  (apps/api/src/socket/handlers/room.ts)
 *   - locale match for non-host joiners             (apps/api/src/socket/handlers/room.ts:206-214)
 * So to test multiplayer alone, we need N distinct accounts connected simultaneously.
 *
 * What it does
 * ------------
 * 1. Signs up N bot accounts via POST /api/auth/signup (instant — emailVerified defaults to true).
 * 2. Opens N socket.io-client connections, authenticated with each bot's JWT.
 * 3. Dispatches bots according to the mode:
 *      - lobby     → bots emit room:join with a code YOU created from your browser.
 *      - unranked  → bots emit matchmaking:join { gameMode: 'normal' | 'special' }.
 *      - ranked    → bots emit matchmaking:join { gameMode: 'ranked' }.
 * 4. Auto-marks bots ready (room:join already does this for matchmade rooms).
 * 5. Optionally auto-votes randomly during games so the match can progress/finish.
 * 6. Cleanly disconnects on SIGINT so no `gameParticipation` row is left with endedAt=null.
 *
 * Usage
 * -----
 *   cd scripts && npm install   # first time only
 *
 *   # Test Create Lobby — create the room in your browser, paste the code:
 *   node dev-bots.mjs lobby --code=ABC12 --bots=2
 *
 *   # Test Unranked — start bots, then queue yourself from your browser:
 *   node dev-bots.mjs unranked --bots=2
 *
 *   # Test Ranked — 9 bots + you from the browser (ideally with a fresh LP=0 account):
 *   node dev-bots.mjs ranked --bots=9
 *
 * Options:
 *   --server=URL      base URL of the staging server  (default: $SERVER or https://staging.redhanded-game.com)
 *   --socket=URL      separate socket.io host if API and socket live on different domains
 *   --locale=CODE     locale for bot accounts. MUST match the room/host locale
 *                     (default: $LOCALE or 'en')
 *   --bots=N          number of bots to spawn (default: 2)
 *   --code=XXXXX      room code (lobby mode only)
 *   --sub-mode=MODE   'normal' | 'special' for unranked (default: normal)
 *   --auto-vote       bots cast random votes when voting phase starts
 *   --reuse           load existing bots from .bots.json instead of creating new ones
 *                     (avoids spamming signups if you run the script repeatedly)
 *   --keep-alive      stay connected after match end (useful for debug)
 *   --no-save         do not persist credentials to .bots.json
 *
 * Environment:
 *   SERVER            base URL (same as --server)
 *   LOCALE            bot locale   (same as --locale)
 *   BOT_PASSWORD      password used for all bots (default: 'botbotbot123')
 *
 * Security
 * --------
 * `.bots.json` contains valid 30-day JWTs. It is gitignored. Never commit it.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { io } from 'socket.io-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BOTS_FILE = resolve(__dirname, '.bots.json')

// ─── CLI parsing ──────────────────────────────────────────────────────────────

/** @typedef {'lobby' | 'unranked' | 'ranked'} Mode */

function parseArgs(argv) {
  const [mode, ...rest] = argv
  const opts = {
    mode: /** @type {Mode} */ (mode),
    server: process.env.SERVER || 'https://staging.redhanded-game.com',
    socketUrl: null,
    locale: process.env.LOCALE || 'en',
    bots: 2,
    code: null,
    subMode: 'normal',
    autoVote: false,
    reuse: false,
    keepAlive: false,
    save: true,
  }
  for (const arg of rest) {
    if (arg.startsWith('--server=')) opts.server = arg.slice(9)
    else if (arg.startsWith('--socket=')) opts.socketUrl = arg.slice(9)
    else if (arg.startsWith('--locale=')) opts.locale = arg.slice(9)
    else if (arg.startsWith('--bots=')) opts.bots = parseInt(arg.slice(7), 10)
    else if (arg.startsWith('--code=')) opts.code = arg.slice(7).toUpperCase()
    else if (arg.startsWith('--sub-mode=')) opts.subMode = arg.slice(11)
    else if (arg === '--auto-vote') opts.autoVote = true
    else if (arg === '--reuse') opts.reuse = true
    else if (arg === '--keep-alive') opts.keepAlive = true
    else if (arg === '--no-save') opts.save = false
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0) }
    else { console.error(`Unknown arg: ${arg}`); process.exit(1) }
  }
  return opts
}

function printHelp() {
  const help = readFileSync(__filename, 'utf8')
    .split('\n')
    .slice(1, 60) // top comment block
    .map((l) => l.replace(/^ \*\/?/, '').replace(/^\s*\*\s?/, ''))
    .join('\n')
  console.log(help)
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function signUpBot(server, locale, password) {
  const suffix = Math.random().toString(36).slice(2, 10)
  const body = {
    username: `bot_${suffix}`,
    email: `bot_${suffix}@dev.local`,
    password,
    locale,
  }
  const res = await fetch(`${server}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`signup failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return {
    userId: data.user.id,
    username: data.user.username,
    email: body.email,
    password,
    token: data.token,
    locale,
  }
}

async function signInBot(server, bot) {
  const res = await fetch(`${server}/api/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: bot.email, password: bot.password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`signin failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return { ...bot, token: data.token, userId: data.user?.id ?? bot.userId, username: data.user?.username ?? bot.username }
}

// ─── Bot persistence ─────────────────────────────────────────────────────────

function loadBots() {
  if (!existsSync(BOTS_FILE)) return []
  try {
    return JSON.parse(readFileSync(BOTS_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveBots(bots) {
  const payload = bots.map((b) => ({
    userId: b.userId,
    username: b.username,
    email: b.email,
    password: b.password,
    token: b.token,
    locale: b.locale,
  }))
  writeFileSync(BOTS_FILE, JSON.stringify(payload, null, 2))
}

// ─── Socket connection ───────────────────────────────────────────────────────

function connectBot(socketUrl, bot) {
  return new Promise((resolvePromise, reject) => {
    const sock = io(socketUrl, {
      auth: { token: bot.token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    })
    const timer = setTimeout(() => {
      sock.disconnect()
      reject(new Error(`[${bot.username}] connect timeout`))
    }, 12_000)
    sock.once('connect', () => {
      clearTimeout(timer)
      bot.socket = sock
      resolvePromise()
    })
    sock.once('connect_error', (err) => {
      clearTimeout(timer)
      reject(new Error(`[${bot.username}] connect_error: ${err.message}`))
    })
  })
}

// ─── Per-mode logic ──────────────────────────────────────────────────────────

/**
 * Wire up common listeners shared by all modes: log phase transitions, handle
 * errors, auto-vote (if enabled), and disconnect gracefully at game finish.
 */
function wireCommonListeners(bot, opts) {
  const tag = `[${bot.username}]`
  bot.state = { playersById: new Map(), roomId: null, role: null, alive: [] }

  bot.socket.on('error', (e) => console.error(tag, 'error:', e?.code, e?.message))

  bot.socket.on('room:updated', (room) => {
    bot.state.roomId = room.id
    bot.state.playersById = new Map(room.players.map((p) => [p.id, p]))
    console.log(tag, `room:updated  status=${room.status} players=${room.players.length}/${room.settings?.maxPlayers ?? '?'}`)
  })

  bot.socket.on('player:joined', (p) => {
    bot.state.playersById.set(p.id, p)
    console.log(tag, `player:joined ${p.username}`)
  })

  bot.socket.on('player:left', (pid) => {
    bot.state.playersById.delete(pid)
  })

  bot.socket.on('game:started', (data) => {
    bot.state.role = data?.yourRole ?? null
    console.log(tag, `game:started role=${data?.yourRole} word="${data?.yourWord}"`)
  })

  bot.socket.on('round:speaking-turn', (data) => {
    // If it's this bot's turn to speak, submit a filler clue so the game doesn't stall.
    const me = [...bot.state.playersById.values()].find((p) => p.userId === bot.userId)
    if (me && data?.playerId === me.id) {
      const clue = pickFillerClue()
      console.log(tag, `my turn to speak → "${clue}"`)
      bot.socket.emit('clue:submit', clue)
    }
  })

  bot.socket.on('round:voting-started', (data) => {
    if (!opts.autoVote) return
    const me = [...bot.state.playersById.values()].find((p) => p.userId === bot.userId)
    const candidates = (data?.players ?? []).filter((p) => p.id !== me?.id && p.status === 'alive')
    if (candidates.length === 0) return
    const target = candidates[Math.floor(Math.random() * candidates.length)]
    console.log(tag, `voting → ${target.username}`)
    bot.socket.emit('vote:cast', target.id)
  })

  bot.socket.on('game:finished', (data) => {
    console.log(tag, `game:finished winner=${data?.winner} coins=${data?.rewards?.starCoinsEarned} xp=${data?.rewards?.xpEarned} lp=${data?.rewards?.lpChange}`)
    if (!opts.keepAlive) {
      setTimeout(() => bot.socket.disconnect(), 500)
    }
  })
}

function pickFillerClue() {
  const clues = ['round', 'small', 'hard', 'warm', 'soft', 'quick', 'quiet', 'bright', 'heavy', 'bitter']
  return clues[Math.floor(Math.random() * clues.length)]
}

async function runLobbyMode(bots, opts) {
  if (!opts.code) throw new Error('--code is required for lobby mode')
  for (const bot of bots) {
    wireCommonListeners(bot, opts)
    bot.socket.emit('room:join', { roomCode: opts.code })
    console.log(`[${bot.username}] joining lobby ${opts.code}`)
  }
}

async function runMatchmakingMode(bots, opts, gameMode) {
  for (const bot of bots) {
    wireCommonListeners(bot, opts)

    bot.socket.on('matchmaking:status', (s) => {
      // Throttle the spam: only log when count changes
      if (bot.state.lastQueueSize !== s.queueSize) {
        bot.state.lastQueueSize = s.queueSize
        console.log(`[${bot.username}] queue=${s.queueSize}/${s.needed} elapsed=${s.elapsed}s`)
      }
    })

    bot.socket.on('matchmaking:found', ({ roomCode }) => {
      console.log(`[${bot.username}] match found → joining ${roomCode}`)
      bot.socket.emit('room:join', { roomCode })
    })

    bot.socket.on('matchmaking:error', (e) => {
      console.error(`[${bot.username}] matchmaking:error:`, e?.message)
    })

    bot.socket.emit('matchmaking:join', { gameMode, categories: [] })
    console.log(`[${bot.username}] joined matchmaking queue (${gameMode})`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.mode || !['lobby', 'unranked', 'ranked'].includes(opts.mode)) {
    console.error('Missing or invalid mode. Use: lobby | unranked | ranked')
    console.error('Run with --help for full usage.')
    process.exit(1)
  }
  if (!Number.isFinite(opts.bots) || opts.bots < 1) {
    console.error('--bots must be a positive integer')
    process.exit(1)
  }

  const socketUrl = opts.socketUrl || opts.server
  const password = process.env.BOT_PASSWORD || 'botbotbot123'

  console.log(`▶ mode=${opts.mode}  server=${opts.server}  socket=${socketUrl}  bots=${opts.bots}  locale=${opts.locale}`)

  // ── 1. Acquire bot accounts (reuse or signup) ──
  /** @type {Array<{userId:string,username:string,email:string,password:string,token:string,locale:string,socket?:any,state?:any}>} */
  let bots = []

  if (opts.reuse) {
    const loaded = loadBots().filter((b) => b.locale === opts.locale)
    bots = loaded.slice(0, opts.bots)
    console.log(`  loaded ${bots.length} bot(s) from .bots.json`)
    // Refresh tokens via signin in case they expired
    for (const bot of bots) {
      try {
        const refreshed = await signInBot(opts.server, bot)
        Object.assign(bot, refreshed)
      } catch (err) {
        console.warn(`  ⚠ signin failed for ${bot.username} (${err.message}) — will sign up a replacement`)
        bots = bots.filter((b) => b !== bot)
      }
    }
  }

  const missing = opts.bots - bots.length
  if (missing > 0) {
    console.log(`  signing up ${missing} new bot(s)...`)
    for (let i = 0; i < missing; i++) {
      try {
        const bot = await signUpBot(opts.server, opts.locale, password)
        bots.push(bot)
        console.log(`  ✓ ${bot.username} (${bot.userId})`)
        // Throttle: server has a 100 req/min global rate limit
        await new Promise((r) => setTimeout(r, 250))
      } catch (err) {
        console.error(`  ✗ signup ${i + 1}/${missing} failed:`, err.message)
        process.exit(1)
      }
    }

    if (opts.save) {
      // Merge with any existing bots in the file (different locale)
      const existing = loadBots().filter((b) => !bots.find((nb) => nb.userId === b.userId))
      saveBots([...existing, ...bots])
      console.log(`  saved credentials to ${BOTS_FILE}`)
    }
  }

  // ── 2. Connect all bots ──
  console.log('▶ connecting bots to socket.io...')
  for (const bot of bots) {
    try {
      await connectBot(socketUrl, bot)
      console.log(`  ✓ ${bot.username} connected (sid=${bot.socket.id})`)
    } catch (err) {
      console.error(`  ✗ ${bot.username} connect failed:`, err.message)
    }
  }

  const connected = bots.filter((b) => b.socket?.connected)
  if (connected.length === 0) {
    console.error('No bots connected — aborting.')
    process.exit(1)
  }

  // ── 3. Dispatch per mode ──
  console.log(`▶ running ${opts.mode} mode with ${connected.length} bot(s)`)
  if (opts.mode === 'lobby') {
    await runLobbyMode(connected, opts)
  } else if (opts.mode === 'unranked') {
    await runMatchmakingMode(connected, opts, opts.subMode) // 'normal' or 'special'
  } else if (opts.mode === 'ranked') {
    await runMatchmakingMode(connected, opts, 'ranked')
  }

  console.log('\n▶ bots are running. Press Ctrl+C to disconnect cleanly.\n')

  // ── 4. Graceful shutdown ──
  const shutdown = () => {
    console.log('\n▶ disconnecting bots...')
    for (const bot of bots) {
      if (bot.socket?.connected) {
        try {
          // Leave any matchmaking queue first
          bot.socket.emit('matchmaking:leave', { gameMode: opts.mode === 'ranked' ? 'ranked' : opts.subMode })
          bot.socket.emit('room:leave')
        } catch {}
        bot.socket.disconnect()
      }
    }
    setTimeout(() => process.exit(0), 500)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
