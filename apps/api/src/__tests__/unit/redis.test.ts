import { describe, it, expect } from 'vitest'

// The setup.ts mocks redis globally. We verify the mock is in shape here.

describe('redis config', () => {
  it('exports a redis instance', async () => {
    const { redis } = await import('../../config/redis')
    expect(redis).toBeDefined()
    expect(typeof redis).toBe('object')
  })

  it('redis mock has expected methods', async () => {
    const { redis } = await import('../../config/redis')
    expect(typeof redis.get).toBe('function')
    expect(typeof redis.set).toBe('function')
    expect(typeof redis.del).toBe('function')
  })
})
