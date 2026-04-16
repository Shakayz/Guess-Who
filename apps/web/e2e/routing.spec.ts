import { test, expect } from '@playwright/test'

/**
 * Routing & auth-guard specs.
 *
 * App.tsx wraps most routes in <ProtectedRoute>, which redirects to /auth
 * when no token is in useAuthStore. These tests verify the redirect fires
 * for every protected route and that public routes stay public.
 */
const PROTECTED_ROUTES = [
  '/',
  '/lobby/ABCD1234',
  '/game/ABCD1234',
  '/results/ABCD1234',
  '/profile',
  '/leaderboard',
  '/history',
  '/history/some-id',
  '/friends',
  '/player/some-id',
  '/settings',
  '/achievements',
  '/tutorial',
]

const PUBLIC_ROUTES = [
  { path: '/auth', expectText: 'Red Handed' },
  { path: '/forgot-password', expectTitleHeading: true },
  { path: '/offline', expectAny: true },
  { path: '/how-to-play', expectAny: true },
  { path: '/terms', expectAny: true },
  { path: '/privacy', expectAny: true },
] as const

test.describe('Protected routes redirect to /auth when signed out', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`GET ${route} → /auth`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/auth$/)
    })
  }
})

test.describe('Public routes load without a token', () => {
  for (const { path, expectText, expectTitleHeading, expectAny } of PUBLIC_ROUTES) {
    test(`GET ${path} renders`, async ({ page }) => {
      await page.goto(path)
      // URL should NOT have been rewritten to /auth.
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`))

      if (expectText) {
        await expect(page.getByText(expectText)).toBeVisible()
      } else if (expectTitleHeading) {
        await expect(page.getByRole('heading').first()).toBeVisible()
      } else if (expectAny) {
        // Just assert the page isn't blank — <main> or equivalent content.
        await expect(page.locator('body')).not.toBeEmpty()
      }
    })
  }
})

test('unknown routes redirect to home (and then /auth because protected)', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  // App.tsx catch-all <Route path="*" element={<Navigate to="/" replace />} />
  // plus the ProtectedRoute guard → /auth.
  await expect(page).toHaveURL(/\/auth$/)
})
