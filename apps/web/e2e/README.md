# Web E2E (Playwright)

End-to-end browser tests for `@red-handed/web`.

## Running

```bash
# All specs, headless, both projects (desktop + mobile viewport):
pnpm --filter @red-handed/web e2e

# Just chromium:
pnpm --filter @red-handed/web e2e --project=chromium

# Visible browser (debugging):
pnpm --filter @red-handed/web e2e:headed

# Playwright UI runner (watch mode, best DX):
pnpm --filter @red-handed/web e2e:ui

# After a failed run, open the HTML report:
pnpm --filter @red-handed/web e2e:report
```

The `playwright.config.ts` launches `pnpm dev` on port 5173 automatically
when you run the suite — `reuseExistingServer` lets it attach to an
already-running dev server in local iteration.

## What's covered

| Spec | Scope |
|------|-------|
| `auth.spec.ts` | Auth page rendering, mode toggle, HTML5 validation, nav to forgot-password |
| `routing.spec.ts` | Protected routes redirect to `/auth`; public routes load; `*` → home → `/auth` |
| `public-pages.spec.ts` | Terms, Privacy, How-to-Play, Offline (Pass & Play) pages render |
| `i18n.spec.ts` | Language picker defaults to EN, switches to FR, persists the change |

All specs run **without a backend**. They exercise UI, routing, and i18n
state only.

## What's NOT covered (yet)

Flows that need the API + sockets:
- sign-in / sign-up / Google OAuth round-trips
- matchmaking (`/(tabs)` on mobile, `/` on web)
- lobby creation, game play, results
- profile edits, achievements, leaderboard data

Add those under `e2e/authed/` with a fixture that seeds a user via the API
and sets the zustand token in `localStorage` before `page.goto(...)`. The
config already exposes `E2E_BASE_URL` and the dev proxy forwards `/api` to
`API_TARGET` (default `http://localhost:3001`).

## Adding a spec

Playwright's docs are excellent — the common patterns here are:

```ts
import { test, expect } from '@playwright/test'

test('some flow', async ({ page }) => {
  await page.goto('/some-route')
  await page.getByRole('button', { name: 'Click me' }).click()
  await expect(page.getByText('Success')).toBeVisible()
})
```

Selector tips specific to this app:

- The auth page has overloaded text — "Sign In" / "Sign Up" appear as BOTH
  mode-tab buttons and the submit button. Disambiguate with
  `page.locator('form').getByRole('button', { name: 'Sign In' })` for the
  submit and `page.locator('button[type="button"]', { hasText: /^Sign Up$/ })`
  for the tab. See `auth.spec.ts` for the helper.
- Routes lazy-load via `React.lazy` — give them time by using the default
  navigation/action timeouts in the config; don't race them.
- Language is persisted in `localStorage` under `i18nextLng`. If a spec
  needs to start from a known locale, clear it with `addInitScript`.
