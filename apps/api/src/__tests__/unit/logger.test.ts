import { describe, it, expect } from 'vitest'

import { rootLogger, childLogger, getLogFilePath } from '../../config/logger'

describe('rootLogger', () => {
  it('exports a pino-compatible logger with level methods', () => {
    expect(typeof rootLogger.info).toBe('function')
    expect(typeof rootLogger.warn).toBe('function')
    expect(typeof rootLogger.error).toBe('function')
    expect(typeof rootLogger.debug).toBe('function')
    expect(typeof rootLogger.trace).toBe('function')
  })

  it('is silent in the test env so assertions do not spam the console', () => {
    // LOG_LEVEL="silent" → pino level number is Infinity.
    expect(rootLogger.level).toBe('silent')
  })

  it('carries the base fields (service, env)', () => {
    const bindings = rootLogger.bindings()
    expect(bindings.service).toBe('red-handed-api')
    expect(bindings.env).toBeDefined()
  })
})

describe('childLogger', () => {
  it('adds a "name" field to every record produced by the child', () => {
    const child = childLogger('socket:room')
    const bindings = child.bindings()
    expect(bindings.name).toBe('socket:room')
    expect(bindings.service).toBe('red-handed-api')
  })

  it('returns distinct instances for distinct names', () => {
    const a = childLogger('a')
    const b = childLogger('b')
    expect(a).not.toBe(b)
    expect(a.bindings().name).toBe('a')
    expect(b.bindings().name).toBe('b')
  })
})

describe('getLogFilePath', () => {
  it('returns null in the test environment', () => {
    expect(getLogFilePath()).toBeNull()
  })
})
