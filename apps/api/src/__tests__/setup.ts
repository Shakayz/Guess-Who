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
//
// Notes on defaults:
//   * `user.update` resolves to `{}` by default so fire-and-forget `.catch()`
//     calls (e.g. the `lastSeenAt` stamp in socket/index.ts connection/disconnect)
//     don't throw synchronously when a test hasn't pre-mocked them. Tests that
//     care about the return value can still call `mockResolvedValue(...)` to
//     override.
//   * Same reason for `room.update` — the socket disconnect path does
//     fire-and-forget host reassignments that would otherwise crash tests.
vi.mock('../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      // `[]` so `.filter/.map` never crash on the returned value. game:start
      // in socket/handlers/room.ts does `prisma.user.findMany(...).filter(...)`
      // outside a try/catch to pre-compute premium status, and the old
      // `vi.fn()` default (undefined) made every callsite blow up.
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
    honor: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock Redis. `duplicate()` returns a connect-able fake so app.ts's
// socket.io-redis adapter setup doesn't blow up during buildApp() in tests.
vi.mock('../config/redis', () => {
  const makeFake = () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    duplicate: vi.fn(),
  })
  const fake = makeFake()
  fake.duplicate = vi.fn(() => makeFake())
  return { redis: fake }
})
