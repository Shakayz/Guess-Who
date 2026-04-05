import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
const mockLog = { error: vi.fn() }
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
