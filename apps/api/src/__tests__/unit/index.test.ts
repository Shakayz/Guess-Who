import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock heavy dependencies before importing index
vi.mock('dotenv', () => ({
  config: vi.fn(),
}))

vi.mock('path', async (importOriginal) => {
  const original = await importOriginal<typeof import('path')>()
  return { ...original, resolve: vi.fn().mockReturnValue('/fake/.env') }
})

// Mock buildApp so it doesn't spin up a real server
const mockListen = vi.fn().mockResolvedValue(undefined)
const mockLog = { error: vi.fn(), info: vi.fn() }
const mockApp = {
  listen: mockListen,
  log: mockLog,
}
vi.mock('../../app', () => ({
  buildApp: vi.fn().mockResolvedValue(mockApp),
}))

// Mock job functions
const mockStartLpDecayWorker = vi.fn()
const mockScheduleLpDecayJob = vi.fn().mockResolvedValue(undefined)
vi.mock('../../jobs/lpDecay', () => ({
  startLpDecayWorker: mockStartLpDecayWorker,
  scheduleLpDecayJob: mockScheduleLpDecayJob,
}))

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    PORT: 3001,
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

describe('index.ts – server entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListen.mockResolvedValue(undefined)
    mockScheduleLpDecayJob.mockResolvedValue(undefined)
  })

  it('builds the app and starts listening', async () => {
    const { buildApp } = await import('../../app')

    // Dynamically import index to trigger the start() function
    // We use a dynamic import with cache-busting to re-execute the module
    vi.resetModules()

    // Re-mock after resetModules
    vi.mock('../../app', () => ({
      buildApp: vi.fn().mockResolvedValue(mockApp),
    }))
    vi.mock('../../jobs/lpDecay', () => ({
      startLpDecayWorker: mockStartLpDecayWorker,
      scheduleLpDecayJob: mockScheduleLpDecayJob,
    }))
    vi.mock('../../config/env', () => ({
      env: {
        PORT: 3001,
        NODE_ENV: 'test',
        JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        REDIS_URL: 'redis://localhost:6379',
      },
    }))

    // Import the module to trigger side effects
    await import('../../index')

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockListen).toHaveBeenCalled()
    expect(mockStartLpDecayWorker).toHaveBeenCalled()
    expect(mockScheduleLpDecayJob).toHaveBeenCalled()
  })
})

// Test error path: when app.listen throws, process.exit(1) is called.
// We use a separate describe with its own mocking via doMock.
describe('index.ts — error handling', () => {
  it('calls app.log.error and process.exit when listen throws', async () => {
    vi.resetModules()

    // Use doMock (not vi.mock) to avoid hoisting issues with local variables
    const logErrorFn = vi.fn()
    vi.doMock('../../app', () => ({
      buildApp: vi.fn().mockResolvedValue({
        listen: vi.fn().mockRejectedValue(new Error('Port in use')),
        log: { error: logErrorFn },
      }),
    }))
    vi.doMock('../../jobs/lpDecay', () => ({
      startLpDecayWorker: vi.fn(),
      scheduleLpDecayJob: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('../../config/env', () => ({
      env: {
        PORT: 3001,
        NODE_ENV: 'test',
        JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        REDIS_URL: 'redis://localhost:6379',
      },
    }))
    vi.doMock('dotenv', () => ({ config: vi.fn() }))
    vi.doMock('path', () => ({
      resolve: vi.fn().mockReturnValue('/fake/.env'),
      default: { resolve: vi.fn().mockReturnValue('/fake/.env') },
    }))

    // Spy on process.exit to prevent the test process from actually exiting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    try {
      await import('../../index')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(logErrorFn).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    } finally {
      exitSpy.mockRestore()
      vi.doUnmock('../../app')
      vi.doUnmock('../../jobs/lpDecay')
      vi.doUnmock('../../config/env')
      vi.doUnmock('dotenv')
      vi.doUnmock('path')
      vi.resetModules()
    }
  })
})
