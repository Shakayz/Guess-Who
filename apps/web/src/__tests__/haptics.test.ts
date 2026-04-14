import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('haptics', () => {
  beforeEach(() => {
    // Fresh module state for every test so the persisted-preference
    // initializer runs against the current localStorage value.
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockVibrate() {
    const vibrate = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
      writable: true,
    })
    return vibrate
  }

  function clearVibrate() {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  }

  it('defaults to enabled when no preference is stored', async () => {
    const { HapticManager } = await import('../lib/haptics')
    expect(HapticManager.isEnabled()).toBe(true)
  })

  it('persists disabled preference to localStorage', async () => {
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.setEnabled(false)
    expect(localStorage.getItem('haptics_enabled')).toBe('false')
    expect(HapticManager.isEnabled()).toBe(false)
  })

  it('re-reads disabled preference across module loads', async () => {
    localStorage.setItem('haptics_enabled', 'false')
    const { HapticManager } = await import('../lib/haptics')
    expect(HapticManager.isEnabled()).toBe(false)
  })

  it('isSupported() returns true when navigator.vibrate exists', async () => {
    mockVibrate()
    const { HapticManager } = await import('../lib/haptics')
    expect(HapticManager.isSupported()).toBe(true)
  })

  it('isSupported() returns false when navigator.vibrate is absent', async () => {
    clearVibrate()
    const { HapticManager } = await import('../lib/haptics')
    expect(HapticManager.isSupported()).toBe(false)
  })

  it('calls navigator.vibrate with a number for single-pulse kinds', async () => {
    const vibrate = mockVibrate()
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.light()
    HapticManager.medium()
    HapticManager.heavy()
    HapticManager.selection()
    expect(vibrate).toHaveBeenNthCalledWith(1, 10)
    expect(vibrate).toHaveBeenNthCalledWith(2, 20)
    expect(vibrate).toHaveBeenNthCalledWith(3, 40)
    expect(vibrate).toHaveBeenNthCalledWith(4, 5)
  })

  it('calls navigator.vibrate with a pattern for notification kinds', async () => {
    const vibrate = mockVibrate()
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.success()
    HapticManager.warning()
    HapticManager.error()
    expect(vibrate).toHaveBeenNthCalledWith(1, [15, 40, 15])
    expect(vibrate).toHaveBeenNthCalledWith(2, [20, 60, 40])
    expect(vibrate).toHaveBeenNthCalledWith(3, [30, 40, 30, 40, 30])
  })

  it('skips vibration entirely when disabled', async () => {
    const vibrate = mockVibrate()
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.setEnabled(false)
    expect(HapticManager.light()).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('returns false and does not throw on unsupported browsers', async () => {
    clearVibrate()
    const { HapticManager } = await import('../lib/haptics')
    expect(() => HapticManager.heavy()).not.toThrow()
    expect(HapticManager.heavy()).toBe(false)
  })

  it('swallows errors thrown by navigator.vibrate', async () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => {
        throw new Error('boom')
      }),
      configurable: true,
      writable: true,
    })
    const { HapticManager } = await import('../lib/haptics')
    expect(() => HapticManager.success()).not.toThrow()
    expect(HapticManager.success()).toBe(false)
  })

  it('trigger() accepts any HapticKind string', async () => {
    const vibrate = mockVibrate()
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.trigger('heavy')
    expect(vibrate).toHaveBeenCalledWith(40)
  })
})
