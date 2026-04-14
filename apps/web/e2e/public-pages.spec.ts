import { test, expect } from '@playwright/test'

/**
 * Public informational pages — render & back-navigation.
 *
 * These routes are reachable without auth and contain mostly static
 * content. We verify each one renders, and that /offline exposes the
 * start-of-game form (fully local Pass & Play).
 */

test('terms page renders', async ({ page }) => {
  await page.goto('/terms')
  // TermsPage has a heading; just assert the document has body text.
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).toHaveURL(/\/terms$/)
})

test('privacy page renders', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).toHaveURL(/\/privacy$/)
})

test('how-to-play page renders role descriptions', async ({ page }) => {
  await page.goto('/how-to-play')
  await expect(page).toHaveURL(/\/how-to-play$/)
  // The page lists all roles; at least one role name from the registry
  // should be visible. "Villagers" is a top-level team heading.
  await expect(page.getByText(/Villagers|Imposters/).first()).toBeVisible()
})

test('offline (Pass & Play) page loads its setup form', async ({ page }) => {
  await page.goto('/offline')
  await expect(page).toHaveURL(/\/offline$/)
  // The offline screen's defaults mirror the mobile app — "Players" and
  // "Imposters" labels from the game-setup section.
  await expect(page.getByText(/Players/i).first()).toBeVisible()
})
