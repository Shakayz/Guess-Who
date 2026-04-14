import { test, expect, type Page } from '@playwright/test'

/**
 * Auth page — UI-only specs (no backend needed).
 *
 * Covers rendering, form toggle, and client-side validation messages from
 * apps/web/src/pages/AuthPage.tsx. Submission flows that actually hit
 * the API live in e2e/authed/ (not included in the default suite).
 *
 * Selector notes
 * --------------
 * The page contains THREE buttons whose text is "Sign In" / "Sign Up":
 *   - two mode tabs (type="button")
 *   - the form submit (type="submit")
 * We disambiguate with the form scope + type attribute.
 */

const submitButton = (page: Page, name: 'Sign In' | 'Sign Up') =>
  page.locator('form').getByRole('button', { name, exact: true })

const modeTab = (page: Page, name: 'Sign In' | 'Sign Up') =>
  page.locator('button[type="button"]', { hasText: new RegExp(`^${name}$`) }).first()

test.describe('Auth page', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh load each test — guarantees we're signed out.
    await page.goto('/auth')
    await expect(page.getByText('Imposter Game')).toBeVisible()
  })

  test('renders sign-in form by default', async ({ page }) => {
    await expect(submitButton(page, 'Sign In')).toBeVisible()
    await expect(page.getByPlaceholder('Email or username')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
    // Google OAuth button is always rendered regardless of mode.
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
  })

  test('toggles to sign-up mode and shows the username field', async ({ page }) => {
    await modeTab(page, 'Sign Up').click()

    await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(submitButton(page, 'Sign Up')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0)
  })

  test('sign-in form: empty submission is blocked by HTML5 validation', async ({ page }) => {
    // Inputs are marked required — the submit won't even fire a network call.
    const identifier = page.getByPlaceholder('Email or username')

    await submitButton(page, 'Sign In').click()

    // The browser reports the invalid field — we assert via :invalid.
    await expect(identifier).toHaveJSProperty('validity.valid', false)
  })

  test('sign-up with short password is blocked by HTML5 minlength=8', async ({ page }) => {
    await modeTab(page, 'Sign Up').click()

    await page.getByLabel('Username', { exact: true }).fill('testuser')
    await page.getByLabel('Email', { exact: true }).fill('test@example.com')
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('short') // 5 chars, minlength is 8

    await submitButton(page, 'Sign Up').click()

    await expect(password).toHaveJSProperty('validity.valid', false)
  })

  test('forgot-password link navigates to /forgot-password', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})
