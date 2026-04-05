import { describe, it, expect } from 'vitest'

import en from '../i18n/en'
import fr from '../i18n/fr'
import es from '../i18n/es'
import ar from '../i18n/ar'
import de from '../i18n/de'
import itLocale from '../i18n/it'
import pt from '../i18n/pt'
import zh from '../i18n/zh'

const REQUIRED_TOP_LEVEL_KEYS = ['common', 'nav', 'auth', 'home']

function isNonEmptyObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length > 0
}

describe('i18n translation files', () => {
  const translations: Record<string, Record<string, unknown>> = { en, fr, es, ar, de, it: itLocale, pt, zh }

  it('all locales export a non-empty object', () => {
    for (const [locale, t] of Object.entries(translations)) {
      expect(isNonEmptyObject(t), `${locale} should export a non-empty object`).toBe(true)
    }
  })

  it('all locales have the required top-level keys', () => {
    for (const [locale, t] of Object.entries(translations)) {
      for (const key of REQUIRED_TOP_LEVEL_KEYS) {
        expect(t, `${locale} should have key "${key}"`).toHaveProperty(key)
        expect(isNonEmptyObject(t[key]), `${locale}.${key} should be an object`).toBe(true)
      }
    }
  })

  it('en translation has common.loading', () => {
    expect(en.common.loading).toBeTruthy()
  })

  it('en translation has nav keys', () => {
    expect((en.nav as any).play).toBeTruthy()
    expect((en.nav as any).profile).toBeTruthy()
    expect((en.nav as any).signOut).toBeTruthy()
  })

  it('en translation has auth keys', () => {
    expect((en.auth as any).signIn).toBeTruthy()
    expect((en.auth as any).signUp).toBeTruthy()
    expect((en.auth as any).email).toBeTruthy()
    expect((en.auth as any).password).toBeTruthy()
  })

  it('all locales have nav.signOut defined', () => {
    for (const [locale, t] of Object.entries(translations)) {
      expect((t.nav as any)?.signOut, `${locale} nav.signOut should be defined`).toBeDefined()
    }
  })

  it('french locale has Chargement as loading text', () => {
    expect((fr.common as any).loading).toContain('hargement')
  })
})
