# Logging & Observability Guide

Complete reference for the structured logs emitted by the API, Web, and Mobile
apps — and every supported way to read them.

If something breaks in production, this is the first page to check.

---

## API (Fastify + pino)

Single root [pino](https://getpino.io) instance lives in
[`apps/api/src/config/logger.ts`](../apps/api/src/config/logger.ts) and is
used for **every log line in the API** (Fastify request logs, Socket.IO
events, Prisma/Redis connection events, background jobs, services).

Every line carries these base fields so logs grep and filter cleanly:

| Field     | Description                                                          |
|-----------|----------------------------------------------------------------------|
| `service` | Always `red-handed-api`                                                |
| `env`     | `development` / `test` / `production` (from `NODE_ENV`)              |
| `pid`     | Node process id — useful when running multiple workers               |
| `name`    | Module namespace, e.g. `socket:room`, `prisma`, `lp-decay`, `push`   |
| `level`   | `trace` / `debug` / `info` / `warn` / `error` / `fatal`              |
| `time`    | ISO-8601 timestamp                                                   |
| `msg`     | Human-readable message                                               |

Any call like `req.log.info({ userId }, 'signin successful')` adds the extra
fields (`userId`, etc.) alongside the base set.

### Log levels

Controlled by `LOG_LEVEL` (default is `info`, `silent` in tests):

```bash
LOG_LEVEL=debug  pnpm --filter @red-handed/api dev   # verbose
LOG_LEVEL=warn   pnpm --filter @red-handed/api dev   # only warnings & errors
LOG_LEVEL=silent pnpm --filter @red-handed/api dev   # everything off (used by tests)
```

### Where the logs go

| Destination | When                                                         | Format          |
|-------------|--------------------------------------------------------------|-----------------|
| **stdout**  | Always                                                       | Pretty in dev, JSON otherwise |
| **file**    | Production **or** when `LOG_TO_FILE=1`                       | JSON (one line per event) |

Default file path: `apps/api/logs/api.log` (auto-created on first write).
Override with `LOG_FILE=/absolute/path/to/file.log`.

Set `LOG_TO_FILE=0` (or `false`) to force the file sink off in production.

### How to read them

#### 1. Locally during development

```bash
# Pretty stdout, no file — the default dev experience:
pnpm --filter @red-handed/api dev

# Force file logging in dev too (useful for after-the-fact grepping):
LOG_TO_FILE=1 pnpm --filter @red-handed/api dev

# Tail the file:
tail -f apps/api/logs/api.log

# Pretty-print a JSON file stream:
tail -f apps/api/logs/api.log | npx pino-pretty
```

#### 2. With Docker Compose

```bash
# Stream the API container's stdout:
docker compose logs -f api

# Filter for errors:
docker compose logs api | grep -i '"level":50'   # pino level 50 = error

# Tail just the file sink from inside the container:
docker compose exec api tail -f apps/api/logs/api.log
```

The dev compose file mounts the repo, so `apps/api/logs/api.log` on your host
is the same file the container writes to. The prod compose file keeps the file
inside the container — grab it with `docker compose cp api:/app/apps/api/logs/api.log ./`.

#### 3. In production (AWS ECS Fargate)

The production container writes to stdout **and** to `apps/api/logs/api.log`.

- **stdout** is captured by the `awslogs` driver and forwarded to CloudWatch
  Logs under the log group configured in `infra/aws/` (30-day retention — see
  the infra README).
- **Browse in the console:** AWS → CloudWatch → Log groups → `/ecs/red-handed-api`
  (or whatever your stack named it) → pick a stream by task id.
- **Query with Logs Insights** — example: "every error in the last hour":
  ```
  fields @timestamp, name, msg, err.message, userId, roomId
  | filter level = 50
  | sort @timestamp desc
  | limit 200
  ```
- **CLI:**
  ```bash
  aws logs tail /ecs/red-handed-api --follow --since 15m
  ```

#### 4. Quick filters (JSON output)

Because every line is one JSON object, `jq` + friends make ad-hoc queries easy:

```bash
# Only errors + warnings:
tail -f apps/api/logs/api.log | jq 'select(.level >= 40)'

# All socket:room logs for one roomId:
grep '"roomId":"abc123"' apps/api/logs/api.log | jq 'select(.name=="socket:room")'

# Count log events by level over a file:
jq -s 'group_by(.level) | map({level: .[0].level, count: length})' apps/api/logs/api.log
```

### Pino levels cheat sheet

| Name   | Numeric | Used for                                                |
|--------|---------|---------------------------------------------------------|
| trace  | 10      | Very chatty tracing — rarely enabled                    |
| debug  | 20      | Developer diagnostics (`LOG_LEVEL=debug`)               |
| info   | 30      | Normal operations (signin, game start, round resolved)  |
| warn   | 40      | Recoverable problems (auth failures, insufficient funds, reports filed) |
| error  | 50      | Something broke (exceptions, upstream fetch failures)   |
| fatal  | 60      | Process-level failures                                  |

### What gets logged

Non-exhaustive — every route, socket handler, background job, and service
logs the events below using the shared logger.

- **Auth** (`routes/auth.ts`, `routes/oauth.ts`) — signup / signin attempts,
  success, failures (bad password, taken email/username), password reset
  requests, OAuth verifications, username setup.
- **Users** (`routes/users.ts`) — profile updates, avatar uploads, password
  changes, push-token register/clear, block / unblock / report (warn-level so
  moderation activity is easy to audit), account deletion.
- **Rooms** (`routes/rooms.ts`, `socket/handlers/room.ts`) — room creation,
  joins, leaves, starts (with failed-start reasons), ready-toggles, settings
  changes, host transfers, disconnects, forfeits.
- **Game loop** (`socket/gameLoop.ts`) — round start, clue phase, vote tally,
  eliminations, tiebreakers, special-role resolutions (jester, kamikaze,
  judge, revenant), game finish with winner + LP/XP updates.
- **Matchmaking** (`socket/handlers/matchmaking.ts`) — queue joins / leaves,
  window widening, match executed.
- **Chat & DMs** (`socket/handlers/chat.ts`, `socket/index.ts`) — messages
  sent (lengths only, never bodies).
- **Shop / gifts / season pass / word packs / achievements** — purchases,
  claims, gift send/claim, tier claims, achievement unlocks (with keys),
  word-pack create/delete.
- **Infrastructure** — Redis connect/ready/error/close/reconnecting, Prisma
  init, LP-decay worker tick + failures.
- **Push notifications** (`services/push.ts`) — invalid tokens, Expo ticket
  errors, batch delivery counts.
- **Email** (`services/email.ts`) — send attempts per provider (Resend /
  SMTP / dev fallback).

Every `req.log.*` call inherits Fastify's auto-attached request id, so each
line is trivially correlated to the HTTP request that produced it.

---

## Web (React + Vite)

[`apps/web/src/lib/logger.ts`](../apps/web/src/lib/logger.ts) exports a
`createLogger(module)` factory that prints to the browser console with a
consistent prefix:

```
[2026-04-14T10:12:34.567Z] [INFO] [socket] connected { userId: '...' }
```

### Where to see them

- **Browser DevTools → Console.** All levels (`debug`/`info`/`warn`/`error`)
  land there. Filter by the `[module]` bracket to narrow scope.
- Set the floor via `VITE_LOG_LEVEL` at build time:
  ```bash
  VITE_LOG_LEVEL=debug pnpm --filter @red-handed/web dev
  ```
  Defaults to `info`.

Not persisted — if you need a copy, use the browser's "Preserve log" setting
and "Save as…" from the console.

---

## Mobile (React Native + Expo)

[`apps/mobile/lib/logger.ts`](../apps/mobile/lib/logger.ts) mirrors the web
logger — same API, same formatting — and routes through `console.*` so Metro
prints them.

### Where to see them

- **`pnpm --filter @red-handed/mobile dev`** — the Metro terminal shows every
  log.
- **Expo DevTools** → "Logs" tab.
- **Device console:**
  - iOS Simulator → `xcrun simctl spawn booted log stream --predicate 'processImagePath CONTAINS "Expo"'`
  - Android → `adb logcat *:S ReactNative:V ReactNativeJS:V`
- Level defaults to `debug` in dev (`__DEV__`) and `info` in release builds.

---

## Runtime toggles (API env vars)

| Variable      | Values                                     | Effect                                                      |
|---------------|--------------------------------------------|-------------------------------------------------------------|
| `LOG_LEVEL`   | `trace`/`debug`/`info`/`warn`/`error`/`silent` | Minimum level the logger emits                          |
| `LOG_TO_FILE` | `0` / `1` / `true` / `false`               | Force the file sink on/off (defaults on in production)      |
| `LOG_FILE`    | Absolute path                              | Override the rolling log file location                      |

Example — verbose JSON logs streamed to both stdout and a custom file:

```bash
NODE_ENV=production \
LOG_LEVEL=debug \
LOG_TO_FILE=1 \
LOG_FILE=/var/log/red-handed/api.log \
node dist/index.js
```

---

## Adding logs to new code

Always use the shared logger, never `console.*`:

```ts
// apps/api/src/whatever.ts
import { childLogger } from './config/logger'
const log = childLogger('whatever')

log.info({ userId, something }, 'something happened')
log.warn({ err }, 'recoverable problem')
log.error({ err }, 'broke')
```

Inside a Fastify route handler, prefer `req.log.*` — it auto-adds the request
id so the full request timeline can be reconstructed from the log file:

```ts
fastify.post('/x', async (req, reply) => {
  req.log.info({ foo }, 'x attempt')
  // ...
})
```

Guidelines:

- **Log every side effect** (DB writes, external API calls, socket emits).
- Put structured data in the **first arg** (an object), free-text second.
- **Never log secrets** — passwords, tokens, raw card numbers, PII beyond
  user ids. Field names to avoid in objects: `password`, `token`, `secret`,
  `authorization`.
- Prefer `warn` for user-caused failures (bad login, insufficient funds) and
  `error` for server-caused failures (exceptions, upstream outages).
