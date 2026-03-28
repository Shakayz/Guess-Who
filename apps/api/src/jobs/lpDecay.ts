import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '../config/prisma'
import { env } from '../config/env'

// BullMQ requires maxRetriesPerRequest: null
const bullRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
import { LP_DECAY, getTierFromLP } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'

const QUEUE_NAME = 'lp-decay'

// ─── Queue ───────────────────────────────────────────────────────────────────

export const lpDecayQueue = new Queue(QUEUE_NAME, {
  connection: bullRedis as any,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
})

// ─── Worker ──────────────────────────────────────────────────────────────────

export function startLpDecayWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      // Use timestamp arithmetic to stay timezone-agnostic (UTC-safe)
      const cutoff = new Date(Date.now() - LP_DECAY.INACTIVITY_DAYS * 24 * 60 * 60 * 1000)

      // Find ranked users inactive for more than INACTIVITY_DAYS
      // "inactive" = no game participation created after cutoff
      const inactiveUsers = await prisma.user.findMany({
        where: {
          rankTier: { notIn: LP_DECAY.EXEMPT_TIERS },
          rankPoints: { gt: LP_DECAY.MINIMUM_LP },
          gameParticipations: {
            none: { createdAt: { gte: cutoff } },
          },
        },
        select: { id: true, rankPoints: true, rankTier: true },
      })

      // Batch decay updates in chunks of 50 to avoid overwhelming the DB
      const BATCH_SIZE = 50
      let decayed = 0
      for (let i = 0; i < inactiveUsers.length; i += BATCH_SIZE) {
        const batch = inactiveUsers.slice(i, i + BATCH_SIZE)
        await prisma.$transaction(
          batch.map((user) => {
            const newLp      = Math.max(LP_DECAY.MINIMUM_LP, user.rankPoints - LP_DECAY.DECAY_AMOUNT)
            const newTier    = getTierFromLP(newLp)
            const tierChanged = newTier !== (user.rankTier as RankTier)
            return prisma.user.update({
              where: { id: user.id },
              data:  { rankPoints: newLp, ...(tierChanged ? { rankTier: newTier } : {}) },
            })
          })
        ).catch((err) => console.error(`[LP Decay] Batch ${i} error:`, err))
        decayed += batch.length
      }

      console.log(`[LP Decay] Applied decay to ${decayed} inactive players`)
    },
    { connection: bullRedis as any, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[LP Decay] Job ${job?.id} failed:`, err.message)
  })

  return worker
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function scheduleLpDecayJob() {
  // Remove any existing repeatable jobs to avoid duplicates on restart
  const repeatableJobs = await lpDecayQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    await lpDecayQueue.removeRepeatableByKey(job.key)
  }

  // Schedule daily at midnight UTC
  await lpDecayQueue.add(
    'daily-decay',
    {},
    { repeat: { pattern: '0 0 * * *' } },
  )

  console.log('[LP Decay] Daily decay job scheduled (0 0 * * *)')
}
