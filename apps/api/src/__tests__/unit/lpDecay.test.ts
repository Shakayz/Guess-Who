import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/config/prisma'

// ─── Hoist mock helpers so they're available inside vi.mock factories ──────
const { mockQueueAdd, mockGetRepeatableJobs, mockRemoveRepeatableByKey } = vi.hoisted(() => ({
  mockQueueAdd:             vi.fn().mockResolvedValue({}),
  mockGetRepeatableJobs:    vi.fn().mockResolvedValue([]),
  mockRemoveRepeatableByKey: vi.fn().mockResolvedValue(undefined),
}))

// ─── Mock heavy dependencies before importing the module ───────────────────

// BullMQ Queue & Worker
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getRepeatableJobs: mockGetRepeatableJobs,
    removeRepeatableByKey: mockRemoveRepeatableByKey,
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: Function) => ({
    // Expose the processor so tests can call it directly
    _processor: processor,
    on: vi.fn(),
  })),
}))

// ioredis (used for BullMQ connection)
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    status: 'ready',
  })),
}))

// ─── Now import the module under test ──────────────────────────────────────

import { startLpDecayWorker, scheduleLpDecayJob } from '@/jobs/lpDecay'
import { LP_DECAY, getTierFromLP } from '@red-handed/shared'

// Cast prisma to access vi.fn() helpers
const prismaMock = prisma as any

describe('lpDecay – decay logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRepeatableJobs.mockResolvedValue([])
  })

  it('queries only non-exempt, active-LP users who are inactive', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.$transaction.mockResolvedValue([])

    const worker = startLpDecayWorker() as any
    await worker._processor()

    expect(prismaMock.user.findMany).toHaveBeenCalledOnce()
    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.rankTier.notIn).toEqual(LP_DECAY.EXEMPT_TIERS)
    expect(where.rankPoints.gt).toBe(LP_DECAY.MINIMUM_LP)
    expect(where.gameParticipations.none.createdAt.gte).toBeInstanceOf(Date)
  })

  it('applies LP_DECAY.DECAY_AMOUNT and floors at MINIMUM_LP', async () => {
    const users = [
      { id: 'u1', rankPoints: 10, rankTier: 'bronze' },
      { id: 'u2', rankPoints: 3,  rankTier: 'bronze' },  // would go below 0
    ]
    prismaMock.user.findMany.mockResolvedValue(users)
    prismaMock.$transaction.mockResolvedValue([])

    const worker = startLpDecayWorker() as any
    await worker._processor()

    expect(prismaMock.user.update).toHaveBeenCalledTimes(2)

    const call1 = prismaMock.user.update.mock.calls.find(
      (c: any) => c[0].where.id === 'u1',
    )
    expect(call1[0].data.rankPoints).toBe(10 - LP_DECAY.DECAY_AMOUNT)

    const call2 = prismaMock.user.update.mock.calls.find(
      (c: any) => c[0].where.id === 'u2',
    )
    expect(call2[0].data.rankPoints).toBe(LP_DECAY.MINIMUM_LP) // floored
  })

  it('updates rankTier when the new LP crosses a tier boundary', async () => {
    // 100 LP = bronze; decay by 5 → 95 = wooden (bronze starts at 100)
    const users = [{ id: 'u3', rankPoints: 100, rankTier: 'bronze' }]
    prismaMock.user.findMany.mockResolvedValue(users)
    prismaMock.$transaction.mockResolvedValue([])

    const worker = startLpDecayWorker() as any
    await worker._processor()

    const call = prismaMock.user.update.mock.calls.find(
      (c: any) => c[0].where.id === 'u3',
    )
    const newLp = 100 - LP_DECAY.DECAY_AMOUNT  // 95
    const expectedTier = getTierFromLP(newLp)    // 'wooden'
    expect(call[0].data.rankPoints).toBe(newLp)
    expect(call[0].data.rankTier).toBe(expectedTier)
  })

  it('does not add rankTier to update when tier is unchanged', async () => {
    // 150 LP = bronze; 150 - 5 = 145 still bronze → no tier change
    const users = [{ id: 'u4', rankPoints: 150, rankTier: 'bronze' }]
    prismaMock.user.findMany.mockResolvedValue(users)
    prismaMock.$transaction.mockResolvedValue([])

    const worker = startLpDecayWorker() as any
    await worker._processor()

    const call = prismaMock.user.update.mock.calls.find(
      (c: any) => c[0].where.id === 'u4',
    )
    expect(call[0].data).not.toHaveProperty('rankTier')
  })

  it('registers a failed event handler on the worker', () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const worker = startLpDecayWorker() as any
    expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function))
  })

  it('registers a failed handler that does not throw', () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const worker = startLpDecayWorker() as any

    // Extract the 'failed' handler and call it
    const failedHandler = worker.on.mock.calls.find(
      (c: any) => c[0] === 'failed'
    )?.[1]

    expect(failedHandler).toBeDefined()

    // Call the handler — should not throw (logs via pino)
    expect(() => failedHandler({ id: 'job-123' }, new Error('something broke'))).not.toThrow()
  })
})

describe('scheduleLpDecayJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes existing repeatable jobs before scheduling a new one', async () => {
    const existingJobs = [{ key: 'old-key-1' }, { key: 'old-key-2' }]
    mockGetRepeatableJobs.mockResolvedValue(existingJobs)

    await scheduleLpDecayJob()

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledTimes(2)
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith('old-key-1')
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith('old-key-2')
  })

  it('schedules the daily-decay job with a midnight UTC cron pattern', async () => {
    await scheduleLpDecayJob()

    expect(mockQueueAdd).toHaveBeenCalledOnce()
    const [jobName, , opts] = mockQueueAdd.mock.calls[0]
    expect(jobName).toBe('daily-decay')
    expect(opts.repeat.pattern).toBe('0 0 * * *')
  })
})
