/**
 * Centralised logger for the API.
 *
 * This module builds a single root pino instance and exposes a helper
 * (`childLogger`) that every other module should use instead of calling
 * `pino(...)` directly. Doing so gives us three things at once:
 *
 *   1. A consistent base set of fields on every log line (service, env, pid).
 *   2. A single place to wire up dual output — pretty-printed stdout while
 *      developing + a rolling file sink so logs are durable for inspection.
 *   3. An easy hook to silence everything in tests (`LOG_LEVEL=silent`).
 *
 * ─── Where to find the logs ────────────────────────────────────────────────
 *
 * - **stdout** — pretty-printed in dev (`NODE_ENV=development`), structured
 *   JSON in production. Visible in the terminal running `pnpm --filter
 *   @imposter/api dev` or `docker compose logs -f api`.
 *
 * - **file** — when `LOG_TO_FILE=1` (or in production by default), logs are
 *   also written to `apps/api/logs/api.log`. The directory is created lazily
 *   on first write. Path can be overridden via `LOG_FILE` (absolute path).
 *   Tail the file from the repo root:
 *
 *       tail -f apps/api/logs/api.log
 *
 *   Each line is one JSON object. Pipe through `pino-pretty` for a nicer
 *   view:
 *
 *       tail -f apps/api/logs/api.log | npx pino-pretty
 *
 * - **silent in tests** — the shared test setup sets `LOG_LEVEL=silent`, so
 *   `logger.info(...)` is a no-op. Tests can still spy on the logger by
 *   mocking this module if they need to assert log output.
 */
import pino, { type Logger } from 'pino'
import fs from 'fs'
import path from 'path'

function resolveLogFilePath(): string | null {
  if (process.env.NODE_ENV === 'test') return null
  const forceOff = process.env.LOG_TO_FILE === '0' || process.env.LOG_TO_FILE === 'false'
  if (forceOff) return null
  const forceOn = process.env.LOG_TO_FILE === '1' || process.env.LOG_TO_FILE === 'true'
  const defaultOn = process.env.NODE_ENV === 'production' || forceOn
  if (!defaultOn && process.env.NODE_ENV === 'development' && !forceOn) {
    // In dev, default to file-off unless the user opts in. Terminal is enough
    // for day-to-day work; turning LOG_TO_FILE=1 will persist the session.
    return null
  }
  if (process.env.LOG_FILE) return process.env.LOG_FILE
  // Default: <repo>/apps/api/logs/api.log
  const logDir = path.resolve(process.cwd(), 'apps/api/logs')
  return path.join(logDir, 'api.log')
}

function ensureLogFile(filePath: string): fs.WriteStream | null {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    return fs.createWriteStream(filePath, { flags: 'a' })
  } catch (err) {
    // Never let a logger-wiring failure crash the server — fall back to stdout.
    // eslint-disable-next-line no-console
    console.error('[logger] failed to open log file, falling back to stdout:', err)
    return null
  }
}

function buildRootLogger(): Logger {
  const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info')

  const base = {
    service: 'imposter-api',
    env: process.env.NODE_ENV ?? 'development',
    pid: process.pid,
  }

  const filePath = resolveLogFilePath()
  const fileStream = filePath ? ensureLogFile(filePath) : null

  // Dev: pretty stdout (no file by default). Prod / LOG_TO_FILE=1: JSON stdout
  // + JSON file. Tests: silent.
  if (process.env.NODE_ENV === 'development' && !fileStream) {
    return pino({
      level,
      base,
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } },
    })
  }

  if (fileStream) {
    // Multi-stream: process stdout + file. Both receive the same JSON lines.
    const streams: pino.StreamEntry[] = [
      { level: level as pino.Level, stream: process.stdout },
      { level: level as pino.Level, stream: fileStream },
    ]
    return pino({ level, base }, pino.multistream(streams))
  }

  return pino({ level, base })
}

export const rootLogger: Logger = buildRootLogger()

/**
 * Create a namespaced child logger. Every module in the codebase should call
 * this instead of `pino({ name: ... })` so that log lines carry consistent
 * `service`/`env`/`pid` fields plus the module-specific `name`.
 *
 *     const log = childLogger('socket:room')
 *     log.info({ userId, roomCode }, 'room:join attempt')
 */
export function childLogger(name: string): Logger {
  return rootLogger.child({ name })
}

/**
 * Where the rolling log file lives on disk (or null if file logging is off).
 * Exposed so scripts / diagnostics can report the active path.
 */
export function getLogFilePath(): string | null {
  return resolveLogFilePath()
}
