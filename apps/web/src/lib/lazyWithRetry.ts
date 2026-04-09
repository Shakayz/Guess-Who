import React from 'react'
import { createLogger } from './logger'

const log = createLogger('lazy')

/**
 * `React.lazy` with automatic retry + hard-reload-once fallback.
 *
 * Problem: when we deploy a new build, the S3 sync with `--delete` removes old
 * code-split chunks. Any user who had the app loaded in a tab before the deploy
 * still references the OLD chunk hashes in their cached index.html / JS. When
 * they navigate to a lazy-loaded route, the dynamic import fails with:
 *
 *   TypeError: Failed to fetch dynamically imported module: .../ProfilePage-abc.js
 *
 * React surfaces this through the Suspense boundary → ErrorBoundary → the
 * "Something went wrong" screen.
 *
 * Fix: wrap the import factory with a retry helper that
 *   1. retries the import once after a short delay (handles flaky network)
 *   2. if it still fails with a chunk-load error, forces a hard reload of the
 *      page ONCE per session so the browser fetches a fresh index.html and
 *      resolves the new chunk hashes
 *   3. keeps a sessionStorage flag so we don't get stuck in a reload loop if
 *      the reload itself can't load the chunk (e.g. API down)
 *
 * The reload is a soft recovery: the user just sees a brief flash and lands
 * back on the page they were trying to reach.
 */

const RELOAD_FLAG = 'chunk-reload-attempted'

// Matches the shape of module-load errors thrown by Vite / browsers:
//   - Chromium: TypeError: Failed to fetch dynamically imported module
//   - Firefox:  error loading dynamically imported module
//   - Safari:   Importing a module script failed
const CHUNK_ERROR_REGEX =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return CHUNK_ERROR_REGEX.test(msg)
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const mod = await factory()
      // Clear the reload flag on any successful import — the app is healthy
      // again, so the next stale-chunk error is allowed to trigger a reload.
      try { sessionStorage.removeItem(RELOAD_FLAG) } catch {}
      return mod
    } catch (err) {
      if (!isChunkLoadError(err)) {
        // Non-chunk error — surface it to the ErrorBoundary as usual
        throw err
      }

      // Retry once after a short delay (handles transient network blips)
      log.warn('chunk load failed, retrying', { error: String(err) })
      try {
        await new Promise((r) => setTimeout(r, 400))
        const mod = await factory()
        try { sessionStorage.removeItem(RELOAD_FLAG) } catch {}
        return mod
      } catch (retryErr) {
        if (!isChunkLoadError(retryErr)) throw retryErr

        // Still failing → the chunk is gone. Hard-reload once per session.
        let alreadyReloaded = false
        try { alreadyReloaded = !!sessionStorage.getItem(RELOAD_FLAG) } catch {}

        if (!alreadyReloaded) {
          log.info('chunk still missing after retry, forcing hard reload')
          try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())) } catch {}
          window.location.reload()
          // Return a never-resolving promise so Suspense stays in the loading
          // state while the page reloads, instead of flashing the error UI.
          return new Promise<never>(() => {})
        }

        log.error('chunk still missing after reload, surfacing error', { error: String(retryErr) })
        throw retryErr
      }
    }
  })
}
