import type { FastifyPluginAsync } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import * as jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import { INITIAL_STAR_COINS, EMAIL_VERIFICATION_REWARD } from '@red-handed/shared'
import { allocateReferralCode, creditInvitee, resolveInviter } from '../services/referral'

// Google/Apple have already attested the email, so these users skip the
// 6-digit verification flow AND get the same total balance an email-signup
// user would end up with after verifying (initial + verification reward).
const OAUTH_INITIAL_STAR_COINS = INITIAL_STAR_COINS + EMAIL_VERIFICATION_REWARD

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

    req.log.info('google oauth verify attempt')

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
      let isNewUser = false
      if (!user) {
        const byEmail = email ? await prisma.user.findUnique({ where: { email } }) : null
        if (byEmail) {
          user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId, avatarUrl: byEmail.avatarUrl ?? avatarUrl } })
        } else {
          const tempUsername = `pending_${Date.now()}`.slice(0, 20)
          const referralCode = await allocateReferralCode()
          user = await prisma.user.create({
            data: {
              googleId,
              email: email ?? `${googleId}@google.oauth`,
              username: tempUsername,
              avatarUrl,
              emailVerified: true,
              starCoins: OAUTH_INITIAL_STAR_COINS,
              referralCode,
            },
          })
          isNewUser = true
        }
      }

      if (isNewUser) {
        req.log.info({ userId: user.id }, 'google oauth: new user, needs username setup')
        const setupToken = fastify.jwt.sign({ sub: user.id, setup: true }, { expiresIn: '10m' })
        const suggestedUsername = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) || 'user'
        return reply.send({ needsUsername: true, setupToken, suggestedUsername, user: { id: user.id, email: user.email } })
      }

      req.log.info({ userId: user.id, username: user.username }, 'google oauth verify successful')
      const token = issueToken(fastify, user)
      return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
    } catch (err: any) {
      req.log.error({ err }, 'google oauth verify error')
      return reply.status(401).send({ error: 'Google authentication failed' })
    }
  })

  // POST /api/auth/apple/verify
  // Body: { identityToken: string, name?: string }  — from Apple Sign In
  fastify.post('/apple/verify', async (req, reply) => {
    const { identityToken, name } = req.body as { identityToken?: string; name?: string }
    if (!identityToken) return reply.status(400).send({ error: 'Missing identityToken' })

    req.log.info('apple oauth verify attempt')

    let verifiedPayload = await verifyAppleToken(identityToken)
    if (!verifiedPayload) {
      // In development without Apple credentials, accept any token and use sub claim directly
      if (env.NODE_ENV !== 'development') {
        return reply.status(401).send({ error: 'Invalid Apple token' })
      }
      // Dev fallback: decode without verifying
      const decoded = jwt.decode(identityToken) as { sub?: string; email?: string } | null
      if (!decoded?.sub) return reply.status(401).send({ error: 'Invalid Apple token' })
      verifiedPayload = decoded as { sub: string; email?: string }
    }

    const appleId = verifiedPayload.sub
    const email = verifiedPayload.email
    const displayName = name ?? email?.split('@')[0] ?? 'user'

    let user = await prisma.user.findFirst({ where: { appleId } })
    let isNewUser = false
    if (!user) {
      const byEmail = email ? await prisma.user.findUnique({ where: { email } }) : null
      if (byEmail) {
        user = await prisma.user.update({ where: { id: byEmail.id }, data: { appleId } })
      } else {
        const tempUsername = `pending_${Date.now()}`.slice(0, 20)
        const safeEmail = email ?? `${appleId}@apple.oauth`
        const referralCode = await allocateReferralCode()
        user = await prisma.user.create({
          data: {
            appleId,
            email: safeEmail,
            username: tempUsername,
            emailVerified: true,
            starCoins: OAUTH_INITIAL_STAR_COINS,
            referralCode,
          },
        })
        isNewUser = true
      }
    }

    if (isNewUser) {
      req.log.info({ userId: user.id }, 'apple oauth: new user, needs username setup')
      const setupToken = fastify.jwt.sign({ sub: user.id, setup: true }, { expiresIn: '10m' })
      const suggestedUsername = displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) || 'user'
      return reply.send({ needsUsername: true, setupToken, suggestedUsername, user: { id: user.id, email: user.email } })
    }

    req.log.info({ userId: user.id, username: user.username }, 'apple oauth verify successful')
    const token = issueToken(fastify, user)
    return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
  })

  // POST /api/auth/setup-username — finalize new OAuth user with chosen username
  fastify.post('/setup-username', async (req, reply) => {
    const { setupToken, username, referralCode } = req.body as {
      setupToken?: string
      username?: string
      referralCode?: string
    }
    if (!setupToken || !username) return reply.status(400).send({ error: 'Missing setupToken or username' })

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return reply.status(400).send({ error: 'Username must be 3-20 characters (letters, numbers, underscores)' })
    }

    let payload: { sub: string; setup: boolean }
    try {
      payload = fastify.jwt.verify(setupToken) as any
    } catch {
      req.log.warn('setup-username: invalid or expired setup token')
      return reply.status(401).send({ error: 'Invalid or expired setup token' })
    }

    if (!payload.setup) return reply.status(401).send({ error: 'Invalid setup token' })

    req.log.info({ userId: payload.sub, username }, 'setup-username attempt')

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing && existing.id !== payload.sub) {
      req.log.warn({ username }, 'setup-username failed: username already taken')
      return reply.status(409).send({ error: 'Username already taken' })
    }

    const user = await prisma.user.update({
      where: { id: payload.sub },
      data: { username },
    })

    // Apply the invitee-side credit after the OAuth account is finalized.
    // The inviter's reward is deferred until this user plays their first
    // ranked game (handled by the gameLoop). Matches the plain signup flow —
    // an invalid code is silently ignored rather than blocking setup.
    if (referralCode) {
      const inviter = await resolveInviter(referralCode, user.id)
      if (inviter) {
        const credit = await creditInvitee(inviter.id, user.id)
        if (credit) {
          req.log.info(
            { userId: user.id, inviterId: inviter.id, ...credit },
            'setup-username: invitee credited (inviter reward deferred to first ranked game)',
          )
        }
      } else {
        req.log.info({ referralCode }, 'setup-username: unknown referral code, ignoring')
      }
    }

    req.log.info({ userId: user.id, username: user.username }, 'setup-username successful')
    const token = issueToken(fastify, user)
    return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
  })
}
