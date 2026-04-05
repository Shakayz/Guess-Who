import { vi } from 'vitest'

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.PORT = '0'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
process.env.ALLOWED_ORIGINS = 'http://localhost:3000'
process.env.LOG_LEVEL = 'silent'

// Mock Prisma
vi.mock('../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    honor: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock Redis
vi.mock('../config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}))
