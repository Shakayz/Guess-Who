import type { FastifyPluginAsync } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import * as jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { env } from '../config/env'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUsername(base: string): string {
  const cleaned = base.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) || 'user'
  const suffix = Math.floor(Math.random() * 9000 + 1000)
  return `${cleaned}${suffix}`
}

async function uniqueUsername(base: string): Promise<string> {
  let username = generateUsername(base)
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.user.findUnique({ where: { username } })
    if (!existing) return username
    username = generateUsername(base)
    attempts++
  }
  return `user${Date.now().toString(36)}`
}

function issueToken(fastify: any, user: { id: string; username: string }) {
  return fastify.jwt.sign({ sub: user.id, username: user.username })
}

// ─── Apple JWT verification ───────────────────────────────────────────────────

async function verifyAppleToken(identityToken: string): Promise<{ sub: string; email?: string } | null> {
  try {
    // Fetch Apple's public keys
    const res = await fetch('https://appleid.apple.com/auth/keys')
    if (!res.ok) return null
    const { keys } = await res.json() as { keys: any[] }

    // Decode header to find which key to use
    const decoded = jwt.decode(identityToken, { complete: true })
    if (!decoded || typeof decoded === 'string') return null
    const { kid } = decoded.header as { kid: string }
    const key = keys.find((k: any) => k.kid === kid)
    if (!key) return null

    // Convert JWK to PEM using Node.js crypto
    const { createPublicKey } = await import('crypto')
    const publicKey = createPublicKey({ key, format: 'jwk' })
    const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string

    const payload = jwt.verify(identityToken, pem, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: env.APPLE_CLIENT_ID,
    }) as { sub: string; email?: string }

    return payload
  } catch {
    return null
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const oauthRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /api/auth/google/verify
  // Body: { idToken?: string, accessToken?: string, userInfo?: object }
  // Supports both ID token (from credential response) and access token (from implicit flow)
  fastify.post('/google/verify', async (req, reply) => {
    const body = req.body as { idToken?: string; accessToken?: string; userInfo?: any }
    if (!env.GOOGLE_CLIENT_ID) return reply.status(503).send({ error: 'Google auth not configured' })

    try {
      let googleId: string
      let email: string | undefined
      let name: string
      let avatarUrl: string | null = null

      if (body.idToken) {
        // Verify ID token via Google
        const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)
        const ticket = await client.verifyIdToken({ idToken: body.idToken, audience: env.GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        if (!payload?.sub) return reply.status(401).send({ error: 'Invalid Google token' })
        googleId = payload.sub
        email = payload.email
        name = payload.name ?? payload.email?.split('@')[0] ?? 'user'
        avatarUrl = payload.picture ?? null
      } else if (body.accessToken) {
        // Use access token to fetch profile from Google
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${body.accessToken}`)
        if (!res.ok) return reply.status(401).send({ error: 'Google token validation failed' })
        const info = await res.json() as { sub: string; email?: string; name?: string; picture?: string }
        googleId = info.sub
        email = info.email
        name = info.name ?? info.email?.split('@')[0] ?? 'user'
        avatarUrl = info.picture ?? null
      } else {
        return reply.status(400).send({ error: 'Provide idToken or accessToken' })
      }

      let user = await prisma.user.findFirst({ where: { googleId } })
      if (!user) {
        const byEmail = email ? await prisma.user.findUnique({ where: { email } }) : null
        if (byEmail) {
          user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId, avatarUrl: byEmail.avatarUrl ?? avatarUrl } })
        } else {
          const username = await uniqueUsername(name)
          user = await prisma.user.create({
            data: { googleId, email: email ?? `${googleId}@google.oauth`, username, avatarUrl },
          })
        }
      }

      const token = issueToken(fastify, user)
      return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
    } catch (err: any) {
      fastify.log.error(err, 'Google verify error')
      return reply.status(401).send({ error: 'Google authentication failed' })
    }
  })

  // POST /api/auth/apple/verify
  // Body: { identityToken: string, name?: string }  — from Apple Sign In
  fastify.post('/apple/verify', async (req, reply) => {
    const { identityToken, name } = req.body as { identityToken?: string; name?: string }
    if (!identityToken) return reply.status(400).send({ error: 'Missing identityToken' })

    const payload = await verifyAppleToken(identityToken)
    if (!payload) {
      // In development without Apple credentials, accept any token and use sub claim directly
      if (env.NODE_ENV !== 'development') {
        return reply.status(401).send({ error: 'Invalid Apple token' })
      }
      // Dev fallback: decode without verifying
      const decoded = jwt.decode(identityToken) as { sub?: string; email?: string } | null
      if (!decoded?.sub) return reply.status(401).send({ error: 'Invalid Apple token' })
      Object.assign(payload ?? {}, decoded)
    }

    const appleId = (payload as any).sub as string
    const email = (payload as any).email as string | undefined
    const displayName = name ?? email?.split('@')[0] ?? 'user'

    let user = await prisma.user.findFirst({ where: { appleId } })
    if (!user) {
      const byEmail = email ? await prisma.user.findUnique({ where: { email } }) : null
      if (byEmail) {
        user = await prisma.user.update({ where: { id: byEmail.id }, data: { appleId } })
      } else {
        const username = await uniqueUsername(displayName)
        const safeEmail = email ?? `${appleId}@apple.oauth`
        user = await prisma.user.create({
          data: { appleId, email: safeEmail, username },
        })
      }
    }

    const token = issueToken(fastify, user)
    return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
  })
}
