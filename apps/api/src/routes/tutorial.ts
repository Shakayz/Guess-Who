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
  //
  // Implementation note: we use `updateMany` (not `update`) for the guarded
  // flip so a no-op produces `{ count: 0 }` instead of throwing P2025 —
  // `update` with a non-unique where clause would crash the request when a
  // concurrent call (or a retry from the client after a partially-failed
  // prior POST) had already flipped the flag, surfacing to the user as
  // "Impossible de créditer votre récompense pour le moment — réessayez."
  // With updateMany, the race path is expressed as data rather than as a
  // thrown error and we can always return a clean alreadyCompleted=true.
  fastify.post('/complete', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    // Atomic guarded update. Only touches the row if tutorialCompleted is
    // still false; returns { count: 1 } on first completion, { count: 0 }
    // on every subsequent call.
    const flip = await prisma.user.updateMany({
      where: { id: userId, tutorialCompleted: false },
      data: {
        tutorialCompleted: true,
        starCoins: { increment: TUTORIAL_COMPLETION_REWARD },
      },
    })
    const wasJustCredited = flip.count === 1

    // Always read back the (possibly updated) row so we can return the live
    // balance for the UI and distinguish "user doesn't exist" (→ 404) from
    // "user exists but tutorial was already completed" (→ alreadyCompleted).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { starCoins: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    if (wasJustCredited) {
      req.log.info(
        { userId, reward: TUTORIAL_COMPLETION_REWARD, newBalance: user.starCoins },
        'tutorial completed — reward granted',
      )
      return reply.send({
        success: true,
        alreadyCompleted: false,
        reward: TUTORIAL_COMPLETION_REWARD,
        starCoins: user.starCoins,
      })
    }

    req.log.info({ userId, balance: user.starCoins }, 'tutorial completion attempted but already completed')
    return reply.send({
      success: true,
      alreadyCompleted: true,
      reward: 0,
      starCoins: user.starCoins,
    })
  })
}
