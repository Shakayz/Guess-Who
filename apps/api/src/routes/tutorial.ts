import type { FastifyPluginAsync } from 'fastify'
import { TUTORIAL_COMPLETION_REWARD } from '@imposter/shared'
import { prisma } from '../config/prisma'

// Re-exported so existing test imports (`import { TUTORIAL_COMPLETION_REWARD }
// from '../../routes/tutorial'`) keep working. The value lives in
// packages/shared so the web UI can render the same number on its CTAs
// without drifting.
export { TUTORIAL_COMPLETION_REWARD }

export const tutorialRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/tutorial/status — lightweight check for the web client so it can
  // decide whether to show the "Complete tutorial for +50 ⭐" banner.
  fastify.get('/status', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tutorialCompleted: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({
      completed: user.tutorialCompleted,
      reward: TUTORIAL_COMPLETION_REWARD,
    })
  })

  // POST /api/tutorial/complete — mark the tutorial as completed and grant
  // the one-time 50 ⭐ reward. Safe to call multiple times: subsequent calls
  // return { alreadyCompleted: true } and do NOT grant stars.
  fastify.post('/complete', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tutorialCompleted: true, starCoins: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    if (user.tutorialCompleted) {
      req.log.info({ userId }, 'tutorial completion attempted but already completed')
      return reply.send({
        success: true,
        alreadyCompleted: true,
        reward: 0,
        starCoins: user.starCoins,
      })
    }

    // Atomic: flip the flag and credit coins in a single statement so we can
    // never double-grant even under concurrent requests.
    const updated = await prisma.user.update({
      where: { id: userId, tutorialCompleted: false },
      data: {
        tutorialCompleted: true,
        starCoins: { increment: TUTORIAL_COMPLETION_REWARD },
      },
      select: { starCoins: true },
    })

    req.log.info(
      { userId, reward: TUTORIAL_COMPLETION_REWARD, newBalance: updated.starCoins },
      'tutorial completed — reward granted',
    )

    return reply.send({
      success: true,
      alreadyCompleted: false,
      reward: TUTORIAL_COMPLETION_REWARD,
      starCoins: updated.starCoins,
    })
  })
}
