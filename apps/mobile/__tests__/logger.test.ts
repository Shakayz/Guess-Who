import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The mobile logger uses the RN-injected `__DEV__` global to pick a default
// log level. Stub it before the module is imported so we exercise both
// production and dev paths explicitly.

describe('mobile logger', () => {
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  beforeEach(() => {
    vi.resetModules()
    console.debug = vi.fn()
    console.info = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  async function loadLogger(devMode: boolean) {
    ;(globalThis as any).__DEV__ = devMode
    return import('../lib/logger')
  }

  it('exposes debug/info/warn/error', async () => {
    const { createLogger } = await loadLogger(true)
    const log = createLogger('test')
    expect(typeof log.debug).toBe('function')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('logs everything in dev mode', async () => {
    const { createLogger } = await loadLogger(true)
    const log = createLogger('mod')
    log.debug('hello', { a: 1 })
    log.info('info msg')
    log.warn('warn msg')
    log.error('error msg')
    expect(console.debug).toHaveBeenCalledOnce()
    expect(console.info).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('suppresses debug in non-dev mode', async () => {
    const { createLogger } = await loadLogger(false)
    const log = createLogger('prod')
    log.debug('noisy')
    log.info('kept')
    log.warn('kept')
    log.error('kept')
    expect(console.debug).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('includes the module name in every message', async () => {
    const { createLogger } = await loadLogger(true)
    const log = createLogger('payments')
    log.info('charge complete')
    const firstCall = (console.info as any).mock.calls[0] as unknown[]
    expect(firstCall.join(' ')).toContain('[payments]')
    expect(firstCall.join(' ')).toContain('[INFO]')
  })
})
