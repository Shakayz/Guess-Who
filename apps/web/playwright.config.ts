import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config for the Imposter Game web app.
 *
 * WHAT THIS SUITE COVERS
 * ----------------------
 * The `e2e/` specs exercise the *unauthenticated* surface of the app:
 * auth page rendering & validation, protected-route redirects, public
 * pages (offline, how-to-play, terms, privacy), i18n switching, and
 * deep-link handling. This runs standalone — no backend needed.
 *
 * An additional `e2e/authed/` folder (not required) can be added later
 * for flows that need a running API. Keep those tagged with @authed
 * and skipped in CI unless API_TARGET is set.
 *
 * RUNNING
 * -------
 *   pnpm --filter @imposter/web e2e          # headless
 *   pnpm --filter @imposter/web e2e:headed   # visible browser
 *   pnpm --filter @imposter/web e2e:ui       # Playwright UI runner
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The dev server lazy-loads routes via React.lazy — give them a beat.
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // Spin up `vite` automatically if nothing is already on :5173.
    // `reuseExistingServer` is essential for the interactive UI runner.
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
