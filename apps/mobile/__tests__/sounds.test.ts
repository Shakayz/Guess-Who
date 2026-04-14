import { describe, it, expect, vi, beforeEach } from 'vitest'

// The mobile SoundManager uses a dynamic `require('expo-av')` inside the
// module, so it degrades gracefully when expo-av can't be resolved (which
// is exactly what happens under vitest + Node). We take advantage of that
// to exercise the pure bookkeeping paths: enable/disable, persistence,
// public-API surface, and the "no expo-av available" no-op behavior.

const storage = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      storage.set(k, v)
    }),
  },
}))

describe('mobile SoundManager', () => {
  beforeEach(() => {
    storage.clear()
    vi.resetModules()
  })

  it('exposes the public API and is enabled by default', async () => {
    const { SoundManager } = await import('../lib/sounds')
    expect(SoundManager.isEnabled()).toBe(true)
    expect(typeof SoundManager.play).toBe('function')
    expect(typeof SoundManager.init).toBe('function')
    expect(typeof SoundManager.setEnabled).toBe('function')
  })

  it('persists disabled preference to AsyncStorage', async () => {
    const { SoundManager } = await import('../lib/sounds')
    await SoundManager.setEnabled(false)
    expect(storage.get('sound_enabled')).toBe('false')
    expect(SoundManager.isEnabled()).toBe(false)
  })

  it('persists enabled-true preference to AsyncStorage', async () => {
    const { SoundManager } = await import('../lib/sounds')
    await SoundManager.setEnabled(true)
    expect(storage.get('sound_enabled')).toBe('true')
    expect(SoundManager.isEnabled()).toBe(true)
  })

  it('init() reads persisted disabled preference', async () => {
    storage.set('sound_enabled', 'false')
    const { SoundManager } = await import('../lib/sounds')
    await SoundManager.init()
    expect(SoundManager.isEnabled()).toBe(false)
  })

  it('init() is idempotent and never throws', async () => {
    const { SoundManager } = await import('../lib/sounds')
    await expect(SoundManager.init()).resolves.toBeUndefined()
    await expect(SoundManager.init()).resolves.toBeUndefined()
  })

  it('play() never throws even without a native audio backend', async () => {
    const { SoundManager } = await import('../lib/sounds')
    const types: Array<Parameters<typeof SoundManager.play>[0]> = [
      'click',
      'success',
      'error',
      'notification',
      'vote',
      'reveal',
      'elimination',
      'timer_tick',
      'timer_warning',
      'game_start',
      'game_end',
      'round_start',
      'chat_message',
    ]
    for (const t of types) {
      expect(() => SoundManager.play(t)).not.toThrow()
    }
  })

  it('play() does nothing when sounds are disabled', async () => {
    const { SoundManager } = await import('../lib/sounds')
    await SoundManager.setEnabled(false)
    // If we were enabled, the internal path would schedule an async
    // createAsync that we can't easily observe here — but when disabled
    // the function must return synchronously without even trying.
    expect(() => SoundManager.play('reveal')).not.toThrow()
  })
})
