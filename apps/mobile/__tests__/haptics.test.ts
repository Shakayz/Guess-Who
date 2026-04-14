import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub the native modules the HapticManager depends on. Vitest runs in Node,
// so expo-haptics and @react-native-async-storage/async-storage aren't
// available — we mock them with minimal in-memory fakes.
const impactAsyncMock = vi.fn()
const notificationAsyncMock = vi.fn()
const selectionAsyncMock = vi.fn()

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  impactAsync: (...args: unknown[]) => impactAsyncMock(...args),
  notificationAsync: (...args: unknown[]) => notificationAsyncMock(...args),
  selectionAsync: (...args: unknown[]) => selectionAsyncMock(...args),
}))

const storage = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      storage.set(k, v)
    }),
  },
}))

describe('mobile haptics', () => {
  beforeEach(async () => {
    storage.clear()
    impactAsyncMock.mockClear()
    notificationAsyncMock.mockClear()
    selectionAsyncMock.mockClear()
    vi.resetModules()
  })

  it('exposes the full API surface expected by call sites', async () => {
    const { HapticManager } = await import('../lib/haptics')
    expect(typeof HapticManager.light).toBe('function')
    expect(typeof HapticManager.medium).toBe('function')
    expect(typeof HapticManager.heavy).toBe('function')
    expect(typeof HapticManager.success).toBe('function')
    expect(typeof HapticManager.warning).toBe('function')
    expect(typeof HapticManager.error).toBe('function')
    expect(typeof HapticManager.selection).toBe('function')
  })

  it('calls impactAsync for light/medium/heavy', async () => {
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.light()
    HapticManager.medium()
    HapticManager.heavy()
    expect(impactAsyncMock).toHaveBeenCalledTimes(3)
    expect(impactAsyncMock).toHaveBeenNthCalledWith(1, 'light')
    expect(impactAsyncMock).toHaveBeenNthCalledWith(2, 'medium')
    expect(impactAsyncMock).toHaveBeenNthCalledWith(3, 'heavy')
  })

  it('calls notificationAsync for success/warning/error', async () => {
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.success()
    HapticManager.warning()
    HapticManager.error()
    expect(notificationAsyncMock).toHaveBeenCalledTimes(3)
    expect(notificationAsyncMock).toHaveBeenNthCalledWith(1, 'success')
    expect(notificationAsyncMock).toHaveBeenNthCalledWith(2, 'warning')
    expect(notificationAsyncMock).toHaveBeenNthCalledWith(3, 'error')
  })

  it('calls selectionAsync for selection()', async () => {
    const { HapticManager } = await import('../lib/haptics')
    HapticManager.selection()
    expect(selectionAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('honors the disabled preference and skips all vibration calls', async () => {
    const { HapticManager } = await import('../lib/haptics')
    await HapticManager.setEnabled(false)
    HapticManager.light()
    HapticManager.success()
    HapticManager.selection()
    expect(impactAsyncMock).not.toHaveBeenCalled()
    expect(notificationAsyncMock).not.toHaveBeenCalled()
    expect(selectionAsyncMock).not.toHaveBeenCalled()
  })

  it('persists the disabled preference to AsyncStorage', async () => {
    const { HapticManager } = await import('../lib/haptics')
    await HapticManager.setEnabled(false)
    expect(storage.get('haptics_enabled')).toBe('false')
    expect(HapticManager.isEnabled()).toBe(false)
  })

  it('init() reads the persisted preference', async () => {
    storage.set('haptics_enabled', 'false')
    const { HapticManager } = await import('../lib/haptics')
    await HapticManager.init()
    expect(HapticManager.isEnabled()).toBe(false)
  })
})
