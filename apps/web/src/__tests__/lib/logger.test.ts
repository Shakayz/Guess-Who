import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../../lib/logger'

describe('createLogger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    infoSpy  = vi.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    debugSpy.mockRestore()
    infoSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('returns an object with debug/info/warn/error methods', () => {
    const log = createLogger('test')
    expect(typeof log.debug).toBe('function')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('info() writes through console.info with module tag', () => {
    const log = createLogger('auth')
    log.info('hello')
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const [prefix, msg] = infoSpy.mock.calls[0]
    expect(String(prefix)).toContain('[INFO]')
    expect(String(prefix)).toContain('[auth]')
    expect(msg).toBe('hello')
  })

  it('warn() writes through console.warn', () => {
    createLogger('mod').warn('careful', { x: 1 })
    expect(warnSpy).toHaveBeenCalled()
    const [prefix, msg, data] = warnSpy.mock.calls[0]
    expect(String(prefix)).toContain('[WARN]')
    expect(msg).toBe('careful')
    expect(data).toEqual({ x: 1 })
  })

  it('error() writes through console.error', () => {
    createLogger('mod').error('boom')
    expect(errorSpy).toHaveBeenCalled()
    expect(String(errorSpy.mock.calls[0][0])).toContain('[ERROR]')
  })

  it('debug() is silent by default (info-level)', () => {
    createLogger('mod').debug('noise')
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('passes optional structured data through as the third arg', () => {
    createLogger('mod').info('event', { userId: 'u1', score: 3 })
    const args = infoSpy.mock.calls[0]
    expect(args[2]).toEqual({ userId: 'u1', score: 3 })
  })

  it('omits data argument as empty string when none passed', () => {
    createLogger('mod').info('event')
    const args = infoSpy.mock.calls[0]
    expect(args[2]).toBe('')
  })

  it('includes ISO timestamp in prefix', () => {
    createLogger('mod').info('event')
    const prefix = String(infoSpy.mock.calls[0][0])
    expect(prefix).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
  })
})
