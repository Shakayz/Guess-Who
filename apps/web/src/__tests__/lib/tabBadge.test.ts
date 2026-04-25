/**
 * tabBadge.test.ts
 *
 * Covers the favicon-badge / title-prefix / web-notification helpers used to
 * surface invites, DMs, and matchmaking hits while the user is on a
 * different tab.
 *
 * The interesting bits:
 *   - setBadge() updates document.title and the <link rel="icon"> href.
 *     The favicon canvas pipeline ends up calling toDataURL() — jsdom
 *     supports it but returns a stub data URL, which is enough to assert
 *     "the link was rewritten".
 *   - clearBadge() restores the original title + favicon href.
 *   - requestNotificationPermission() is a one-shot wrapper around the
 *     `default` → `granted/denied` flow; we simulate each branch.
 *   - showBrowserNotification() must NOT fire while the tab is visible
 *     (the in-app toast already covers that case).
 *
 * jsdom doesn't construct real <img>s synchronously — the loader fires its
 * onload/onerror later. We wire a fake constructor so the canvas path
 * resolves deterministically inside one tick.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.resetModules() between tests gives us a fresh module-scope (originalTitle,
// permissionRequested, badge counter) per case, since tabBadge.ts captures
// those in closures.
async function freshModule() {
  vi.resetModules()
  return await import('../../lib/tabBadge')
}

let originalImage: typeof Image
let originalNotification: any

beforeEach(() => {
  // Reset DOM state so each test starts from a known baseline. Set title
  // AFTER clearing head — otherwise jsdom's <title> element gets wiped by
  // the innerHTML reset and document.title falls back to ''.
  document.head.innerHTML = ''
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = '/original-favicon.ico'
  document.head.appendChild(link)
  document.title = 'Red Handed !'

  originalImage = globalThis.Image
  // Synchronous image stub — fires onload on the next microtask, similar
  // enough to a cached-from-cache load that tabBadge's await chain resolves.
  ;(globalThis as any).Image = class {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    crossOrigin = ''
    complete = true
    naturalWidth = 64
    set src(_v: string) {
      Promise.resolve().then(() => this.onload?.())
    }
    get src() { return '' }
  }

  originalNotification = (globalThis as any).Notification
})

afterEach(() => {
  globalThis.Image = originalImage
  ;(globalThis as any).Notification = originalNotification
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

describe('setBadge', () => {
  it('rewrites the document title with the count when count > 0', async () => {
    const { setBadge } = await freshModule()
    await setBadge(3)
    expect(document.title).toBe('(3) Red Handed !')
  })

  it('caps the visible count at "9+" so the title does not balloon', async () => {
    const { setBadge } = await freshModule()
    await setBadge(15)
    expect(document.title).toBe('(9+) Red Handed !')
  })

  it('resets the title to the original when count drops to 0', async () => {
    const { setBadge } = await freshModule()
    await setBadge(2)
    await setBadge(0)
    expect(document.title).toBe('Red Handed !')
  })

  it('clamps negative counts to 0 (no "(- 1) Red Handed !")', async () => {
    const { setBadge } = await freshModule()
    await setBadge(-5)
    expect(document.title).toBe('Red Handed !')
  })

  it('updates the title even when the canvas pipeline cannot render (jsdom has no Canvas2D)', async () => {
    // jsdom does not implement HTMLCanvasElement.getContext() unless the
    // optional `canvas` package is installed, so renderBadgeDataUrl bails
    // out and the favicon href is left as-is. The title path is independent
    // and must still flip — that's what we assert here.
    const { setBadge } = await freshModule()
    await setBadge(1)
    expect(document.title).toBe('(1) Red Handed !')
  })

  it('returns early without crashing when no <link rel="icon"> exists', async () => {
    document.head.innerHTML = ''
    const { setBadge } = await freshModule()
    await expect(setBadge(2)).resolves.toBeUndefined()
  })
})

describe('incrementBadge', () => {
  it('increments the in-memory counter and renders it in the title', async () => {
    const { incrementBadge, setBadge } = await freshModule()
    await setBadge(0)
    incrementBadge()
    // Wait a microtask for the inner setBadge() to flush.
    await Promise.resolve(); await Promise.resolve()
    expect(document.title).toBe('(1) Red Handed !')
  })
})

describe('clearBadge', () => {
  it('restores both title and favicon to their pre-badge state', async () => {
    const { setBadge, clearBadge } = await freshModule()
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!
    const originalHref = link.href
    await setBadge(4)
    expect(document.title).toContain('(4)')

    clearBadge()
    expect(document.title).toBe('Red Handed !')
    expect(link.href).toBe(originalHref)
  })

  it('is a safe no-op when the favicon link is missing', async () => {
    const { clearBadge } = await freshModule()
    document.head.innerHTML = ''
    expect(() => clearBadge()).not.toThrow()
    expect(document.title).toBe('Red Handed !')
  })
})

describe('requestNotificationPermission', () => {
  it('returns "unsupported" when the Notification API is not present', async () => {
    delete (globalThis as any).Notification
    const { requestNotificationPermission } = await freshModule()
    expect(await requestNotificationPermission()).toBe('unsupported')
  })

  it('short-circuits when permission has already been granted', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    ;(globalThis as any).Notification = { permission: 'granted', requestPermission }
    const { requestNotificationPermission } = await freshModule()
    expect(await requestNotificationPermission()).toBe('granted')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('asks the user when permission is "default" and reports the result', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    ;(globalThis as any).Notification = { permission: 'default', requestPermission }
    const { requestNotificationPermission } = await freshModule()
    expect(await requestNotificationPermission()).toBe('granted')
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('only asks once per session — a second call short-circuits', async () => {
    const requestPermission = vi.fn().mockResolvedValue('default')
    ;(globalThis as any).Notification = { permission: 'default', requestPermission }
    const { requestNotificationPermission } = await freshModule()
    await requestNotificationPermission()
    await requestNotificationPermission()
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('swallows requestPermission rejections and returns the current permission', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('boom'))
    ;(globalThis as any).Notification = { permission: 'default', requestPermission }
    const { requestNotificationPermission } = await freshModule()
    expect(await requestNotificationPermission()).toBe('default')
  })
})

describe('showBrowserNotification', () => {
  it('does nothing when the tab is visible — in-app toasts already cover that case', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    const ctor = vi.fn()
    ;(globalThis as any).Notification = Object.assign(
      function (...args: any[]) {
        ctor(...args)
        return { close: vi.fn(), onclick: null }
      },
      { permission: 'granted' },
    )

    const { showBrowserNotification } = await freshModule()
    showBrowserNotification('hi', 'body')
    expect(ctor).not.toHaveBeenCalled()
  })

  it('fires a Notification when the tab is hidden and permission is granted', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    const ctor = vi.fn()
    ;(globalThis as any).Notification = Object.assign(
      function (...args: any[]) {
        ctor(...args)
        return { close: vi.fn(), onclick: null }
      },
      { permission: 'granted' },
    )

    const { showBrowserNotification } = await freshModule()
    showBrowserNotification('Invited', 'bob invited you', { tag: 'invite' })
    expect(ctor).toHaveBeenCalledWith('Invited', expect.objectContaining({ body: 'bob invited you', tag: 'invite' }))
  })

  it('does nothing when permission has not been granted', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    const ctor = vi.fn()
    ;(globalThis as any).Notification = Object.assign(
      function (...args: any[]) {
        ctor(...args)
        return { close: vi.fn(), onclick: null }
      },
      { permission: 'denied' },
    )

    const { showBrowserNotification } = await freshModule()
    showBrowserNotification('Invited', 'bob invited you')
    expect(ctor).not.toHaveBeenCalled()
  })
})
