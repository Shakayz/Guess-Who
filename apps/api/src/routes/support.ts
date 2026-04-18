import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { sendSupportMessage } from '../services/email'

const contactSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
})

export const supportRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/support/contact — send a message to the support inbox
  fastify.post(
    '/contact',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const userId = req.user.sub
      const parsed = contactSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      })
      if (!user?.email) {
        return reply.status(400).send({ error: 'Account email missing — cannot send support message.' })
      }

      req.log.info({ userId, subject: parsed.data.subject }, 'support message submitted')

      try {
        await sendSupportMessage({
          fromEmail: user.email,
          username: user.username,
          userId,
          subject: parsed.data.subject,
          message: parsed.data.message,
        })
      } catch (err) {
        req.log.error({ err, userId }, 'failed to send support email')
        return reply.status(502).send({ error: 'Could not deliver your message. Please try again later.' })
      }

      return reply.send({ success: true })
    },
  )
}
