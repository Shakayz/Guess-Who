import { describe, it, expect, vi } from 'vitest'

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

// Test the real redis.ts module code via vi.importActual.
// Since setup.ts globally mocks redis, importActual bypasses that to run the real file.
describe('redis.ts real module (via importActual)', () => {
  it('creates a Redis instance using env.REDIS_URL', async () => {
    let capturedArgs: any[] = []
    let capturedHandler: Function | undefined

    const mockRedisInstance = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'error') capturedHandler = handler
      }),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    }

    // Mock ioredis so Redis constructor is captured
    vi.doMock('ioredis', () => ({
      default: vi.fn((...args: any[]) => {
        capturedArgs = args
        return mockRedisInstance
      }),
    }))
    // Mock the env dependency
    vi.doMock('../../config/env', () => ({
      env: { REDIS_URL: 'redis://test:6379', NODE_ENV: 'test' },
    }))

    try {
      const mod = await vi.importActual<typeof import('../../config/redis')>('../../config/redis')
      expect(mod.redis).toBeDefined()
      // Constructor was called with the URL from env
      expect(capturedArgs[0]).toBe('redis://test:6379')
      expect(capturedArgs[1]).toMatchObject({ maxRetriesPerRequest: 3, lazyConnect: true })
      // Error listener was registered
      expect(capturedHandler).toBeDefined()

      // Invoke the error handler to cover that branch
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      capturedHandler!(new Error('redis down'))
      expect(consoleSpy).toHaveBeenCalledWith('Redis error:', expect.any(Error))
      consoleSpy.mockRestore()
    } finally {
      vi.doUnmock('ioredis')
      vi.doUnmock('../../config/env')
    }
  })
})
