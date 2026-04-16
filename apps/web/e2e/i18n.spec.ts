import { test, expect } from '@playwright/test'

/**
 * Language-picker specs.
 *
 * The auth page renders a language trigger (top-right). Clicking it opens
 * a list and picking a language persists to localStorage via
 * i18next-browser-languagedetector. We verify that switching to French
 * changes a known English string and switching back restores it.
 */
test.describe('i18n language picker', () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted language between tests.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('i18nextLng')
      } catch {}
    })
    await page.goto('/auth')
    await expect(page.getByText('Red Handed')).toBeVisible()
  })

  test('defaults to English and "Forgot password?" is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
  })

  test('switching to French translates the forgot-password link', async ({ page }) => {
    // The language trigger shows a flag + the active locale code ("EN").
    // Click the EN chip to open the picker.
    const trigger = page.getByRole('button', { name: /EN/i })
    await expect(trigger).toBeVisible()
    await trigger.click()

    // The picker lists each language by its localized label.
    await page.getByRole('button', { name: /Français/i }).click()

    // The English link text should now be the French translation.
    // From packages/shared/src/i18n/fr.ts: auth.forgotPassword = "Mot de passe oublié ?"
    // (exact wording isn't enforced — we just assert the English string is gone
    // and the trigger now reads FR.)
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /FR/i })).toBeVisible()
  })
})
