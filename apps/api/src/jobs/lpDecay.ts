import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '../config/prisma'
import { env } from '../config/env'

// BullMQ requires maxRetriesPerRequest: null
const bullRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
import { LP_DECAY } from '@imposter/shared'

const QUEUE_NAME = 'lp-decay'

// ─── Queue ───────────────────────────────────────────────────────────────────

export const lpDecayQueue = new Queue(QUEUE_NAME, {
  connection: bullRedis,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
})

// ─── Worker ──────────────────────────────────────────────────────────────────

export function startLpDecayWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - LP_DECAY.INACTIVITY_DAYS)

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

      let decayed = 0
      for (const user of inactiveUsers) {
        const newLp = Math.max(LP_DECAY.MINIMUM_LP, user.rankPoints - LP_DECAY.DECAY_AMOUNT)
        await prisma.user.update({
          where: { id: user.id },
          data: { rankPoints: newLp },
        }).catch(() => {})
        decayed++
      }

      console.log(`[LP Decay] Applied decay to ${decayed} inactive players`)
    },
    { connection: bullRedis, concurrency: 1 },
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
