# scripts/

Standalone dev/test scripts. **Not part of the pnpm workspace** — each script
manages its own dependencies via the local `package.json` in this folder.

## dev-bots.mjs — spin up fake players to test multiplayer modes

When you're working on `staging.aghazzaf.com` (or any other environment) and
have nobody to play with, `dev-bots.mjs` creates N fake accounts on the server
and connects them as real socket.io clients so you can reach the 3-player /
10-player minimums the game enforces.

### Why you need it

The server hard-codes:

| Mode | Min distinct players | Notes |
|---|---|---|
| Create Lobby | 3 | Host clicks Start when lobby is full |
| Unranked | 3 | Matchmaking force-starts after 35s with 3+ players |
| Ranked | **10** | LP-based sliding window, no force-start |

And these checks can't be bypassed:
- `room.ts` dedupes by `userId`, so multiple tabs with the same account count as a single player
- non-host joiners must share the host's `locale`
- no bots, no dev flag, no mock endpoint

### First-time setup

```bash
cd scripts
npm install        # installs socket.io-client locally into scripts/node_modules
```

Requires Node 20+ (uses global `fetch` and native ESM).

### Quick start

```bash
# Test Create Lobby — create the room from your browser first, copy the code:
node dev-bots.mjs lobby --code=ABC12 --bots=2

# Test Unranked — start 2 bots in queue, then click "Find game" in your browser:
node dev-bots.mjs unranked --bots=2

# Test Ranked — you need 10 players total, so 9 bots + you:
node dev-bots.mjs ranked --bots=9
```

### Pointing at a different server

```bash
# via env
SERVER=https://staging.aghazzaf.com LOCALE=fr node dev-bots.mjs lobby --code=ABC12 --bots=2

# via flag
node dev-bots.mjs unranked --server=https://staging.aghazzaf.com --locale=fr --bots=2

# if API and socket live on different domains (e.g. api.aghazzaf.com vs aghazzaf.com)
node dev-bots.mjs unranked --server=https://api.aghazzaf.com --socket=https://aghazzaf.com --bots=2
```

### All options

| Flag | Default | Description |
|---|---|---|
| `--server=URL` | `$SERVER` or `https://staging.aghazzaf.com` | Base URL, routes are hit at `${server}/api/...` |
| `--socket=URL` | same as `--server` | Override if socket.io is on a different host |
| `--locale=XX` | `$LOCALE` or `en` | **Must match the room/host locale** |
| `--bots=N` | `2` | Number of bot accounts to spawn |
| `--code=XXXXX` | — | Room code (required for `lobby` mode) |
| `--sub-mode=...` | `normal` | `normal` or `special` (unranked sub-mode) |
| `--auto-vote` | off | Bots cast a random vote when voting phase starts |
| `--reuse` | off | Load bots from `.bots.json` instead of creating new ones |
| `--no-save` | off | Don't write new bot credentials to `.bots.json` |
| `--keep-alive` | off | Stay connected after `game:finished` (useful for debug) |
| `-h`, `--help` | — | Print this help |

### Locale matching (important)

The server rejects joiners whose locale differs from the host's room language
(`room.ts:206-214`). When creating bots, pass `--locale=xx` matching **your own
account's locale**. Check it in your Profile page, then:

```bash
node dev-bots.mjs lobby --code=ABC12 --bots=2 --locale=fr
```

### Ranked matching — things to know

- New bot accounts have `LP = 0` (Wooden tier)
- The sliding LP window starts at ±50 and widens up to infinity over 60s
  (`apps/api/src/socket/handlers/matchmaking.ts:16-22`)
- If your main account is already Bronze+, the window may never include your
  bots. **Easiest fix**: create a fresh account for yourself (sign up manually
  in the browser) so you and the 9 bots all start from LP=0
- `hasPlayedRanked` is purely UI — there's no server-side gate, so bots can
  queue Ranked immediately

### Bot reuse

First run creates `scripts/.bots.json` (gitignored) with credentials. On
subsequent runs, pass `--reuse` to reuse them — this avoids polluting your
staging DB with hundreds of test accounts and avoids bumping into the 100
req/min rate limit.

```bash
node dev-bots.mjs unranked --bots=2 --reuse     # reuses existing bots
node dev-bots.mjs unranked --bots=5 --reuse     # reuses 2, creates 3 more
```

If a stored JWT has expired, the script auto-refreshes it via
`POST /api/auth/signin`.

### Cleanup

- Press **Ctrl+C** to disconnect all bots cleanly. The script leaves any
  matchmaking queue and emits `room:leave` before disconnecting
- If a bot crashes mid-game without proper cleanup, its `gameParticipation.endedAt`
  stays `null` and the `ALREADY_IN_GAME` guard (`room.ts:256-264`) will refuse
  to put it in another game on the next run. Inspect the `GameParticipation`
  table manually in that case
- The bot accounts themselves persist in the DB — that's fine for staging, but
  don't run this against production without thinking

### Troubleshooting

**`LANGUAGE_MISMATCH` error**
→ The bots' locale doesn't match your room. Use `--locale=<same as your account>`.

**`ALREADY_IN_GAME` error**
→ A previous run left dangling `gameParticipation` rows. Finish the stale game
  in your browser, or manually set `endedAt` on the rows via Prisma Studio.

**Ranked match never starts**
→ LP spread too wide. Use a fresh main account (LP=0) or wait 60s for the
  window to widen to infinity.

**Signup fails with 429**
→ You hit the global rate limit (100 req/min). Wait a minute, or use `--reuse`.

**`connect_error: Invalid token`**
→ Stored tokens are stale. Delete `scripts/.bots.json` and re-run without `--reuse`.

### Security

`scripts/.bots.json` contains valid 30-day JWTs. It is gitignored at the repo
root. **Never commit it.** If you accidentally do, invalidate the tokens by
rotating `JWT_SECRET` on the affected server.
