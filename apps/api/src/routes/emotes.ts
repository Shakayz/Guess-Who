import type { FastifyPluginAsync } from 'fastify'
import {
  EMOTE_CATALOG,
  EMOTES_BY_ID,
  DEFAULT_LOADOUT,
  MAX_LOADOUT_SIZE,
  isFreeEmote,
  priceForEmote,
} from '@red-handed/shared'
import { prisma } from '../config/prisma'
import { childLogger } from '../config/logger'

const log = childLogger('emotes')

/**
 * Resolve the authoritative set of emote ids a user "has access to" — the
 * implicit free ids plus the ones they've paid for. Used by the catalog
 * response (so the UI can mark owned items) and by the loadout validator
 * (so players can't equip something they don't own).
 *
 * Never throws: if the DB query fails (e.g. the user_emotes migration hasn't
 * been applied yet, transient connection drop), returns just the free-tier
 * set so the React bar keeps working. Paid emotes silently become
 * unavailable until the DB recovers, which is the right trade — the alternative
 * is bricking every player's reactions for a feature flag.
 */
async function resolveOwnedIds(userId: string): Promise<Set<string>> {
  const owned = new Set<string>(DEFAULT_LOADOUT)
  try {
    const purchased = await prisma.userEmote.findMany({
      where: { userId },
      select: { emoteId: true },
    })
    for (const row of purchased) owned.add(row.emoteId)
  } catch (err) {
    log.error({ err, userId }, 'resolveOwnedIds: falling back to free tier')
  }
  return owned
}

/**
 * Parse the equippedEmotes JSON column into a validated, de-duped id array.
 * Unknown / unowned ids are silently dropped so stale loadouts (catalog item
 * removed, gift refunded, etc.) degrade gracefully instead of 500-ing the
 * whole profile fetch.
 */
function parseLoadout(raw: string | null, owned: Set<string>): string[] {
  if (!raw) return [...DEFAULT_LOADOUT]
  let ids: unknown
  try {
    ids = JSON.parse(raw)
  } catch {
    return [...DEFAULT_LOADOUT]
  }
  if (!Array.isArray(ids)) return [...DEFAULT_LOADOUT]
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of ids) {
    if (typeof v !== 'string') continue
    if (seen.has(v)) continue
    if (!EMOTES_BY_ID[v]) continue
    if (!owned.has(v)) continue
    seen.add(v)
    out.push(v)
    if (out.length >= MAX_LOADOUT_SIZE) break
  }
  // Empty loadout is a lousy UX (no React buttons at all) — fall back to the
  // free basics so the player always has *something* to send.
  return out.length > 0 ? out : [...DEFAULT_LOADOUT]
}

/**
 * Exported for the socket handler: returns the validated loadout ids for a
 * given user. Lives here so the ownership-filtering rules stay in one place.
 *
 * Never throws: on DB error, returns the free default loadout so the in-game
 * React bar keeps sending. This matters during rollouts where the new emote
 * migration hasn't landed on every env yet — without this, every `emote:send`
 * silently failed and emojis appeared broken.
 */
export async function getUserLoadout(userId: string): Promise<{
  loadout: string[]
  owned: Set<string>
}> {
  let equippedRaw: string | null = null
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { equippedEmotes: true },
    })
    equippedRaw = user?.equippedEmotes ?? null
  } catch (err) {
    log.error({ err, userId }, 'getUserLoadout: equippedEmotes read failed, using defaults')
  }
  const owned = await resolveOwnedIds(userId)
  const loadout = parseLoadout(equippedRaw, owned)
  return { loadout, owned }
}

export const emoteRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /api/emotes/catalog ──────────────────────────────────────────────
  // Public catalog. Identical for every client; served without auth so the
  // shop page can render without a logged-in user (the "owned" badge is
  // driven by /me which needs auth).
  fastify.get('/catalog', async () => {
    return {
      emotes: EMOTE_CATALOG.map((em) => ({
        id: em.id,
        emoji: em.emoji,
        name: em.name,
        rarity: em.rarity,
        price: em.price,
        animation: em.animation,
        particle: em.particle,
      })),
    }
  })

  // ── GET /api/emotes/me ───────────────────────────────────────────────────
  // Returns the caller's owned ids + current loadout. One call is enough to
  // render both the in-game React bar and the Profile customization screen.
  fastify.get(
    '/me',
    { onRequest: [fastify.authenticate] },
    async (req) => {
      const userId = (req.user as { sub: string }).sub
      const { loadout, owned } = await getUserLoadout(userId)
      return {
        ownedIds: [...owned],
        loadout,
        maxLoadout: MAX_LOADOUT_SIZE,
      }
    },
  )

  // ── POST /api/emotes/:id/buy ─────────────────────────────────────────────
  // Spend star coins to unlock a paid emote. Atomic: balance is decremented
  // and the ownership row is written in the same transaction so a crash
  // mid-purchase can't leave a user charged-but-unowned.
  fastify.post<{ Params: { id: string } }>(
    '/:id/buy',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const emoteId = req.params.id
      const emote = EMOTES_BY_ID[emoteId]
      if (!emote) return reply.status(404).send({ error: 'unknown_emote' })
      if (isFreeEmote(emoteId)) {
        return reply.status(400).send({ error: 'emote_is_free' })
      }
      const price = priceForEmote(emoteId)

      // Already-owned check up front — avoids a pointless transaction and
      // lets us return a clean 409 the UI can show.
      const existing = await prisma.userEmote.findUnique({
        where: { userId_emoteId: { userId, emoteId } },
      })
      if (existing) return reply.status(409).send({ error: 'already_owned' })

      // Use a conditional updateMany as the balance check so two concurrent
      // buys can't both pass an earlier read and overdraft the account.
      try {
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.user.updateMany({
            where: { id: userId, starCoins: { gte: price } },
            data: { starCoins: { decrement: price } },
          })
          if (updated.count === 0) {
            throw new Error('insufficient_coins')
          }
          await tx.userEmote.create({
            data: {
              userId,
              emoteId,
              starCoins: price,
            },
          })
          const me = await tx.user.findUnique({
            where: { id: userId },
            select: { starCoins: true },
          })
          return { starCoins: me?.starCoins ?? 0 }
        })
        return { ok: true, emoteId, starCoins: result.starCoins }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('insufficient_coins')) {
          return reply.status(402).send({ error: 'insufficient_coins' })
        }
        req.log.error({ err, userId, emoteId }, 'emote purchase failed')
        return reply.status(500).send({ error: 'purchase_failed' })
      }
    },
  )

  // ── PUT /api/emotes/loadout ──────────────────────────────────────────────
  // Replace the player's equipped loadout. Input is a JSON array of emote
  // ids (ordered — this is what renders left-to-right on the React bar).
  // Unknown or unowned ids are rejected so a malicious client can't stuff
  // the bar with content it hasn't paid for.
  fastify.put<{ Body: { ids: string[] } }>(
    '/loadout',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const body = req.body as { ids?: unknown }
      const raw = Array.isArray(body?.ids) ? body.ids : null
      if (!raw) return reply.status(400).send({ error: 'invalid_body' })
      if (raw.length > MAX_LOADOUT_SIZE) {
        return reply.status(400).send({ error: 'loadout_too_large' })
      }

      const owned = await resolveOwnedIds(userId)
      const cleaned: string[] = []
      const seen = new Set<string>()
      for (const v of raw) {
        if (typeof v !== 'string') return reply.status(400).send({ error: 'invalid_id' })
        if (seen.has(v)) continue
        if (!EMOTES_BY_ID[v]) return reply.status(400).send({ error: 'unknown_emote' })
        if (!owned.has(v)) return reply.status(403).send({ error: 'not_owned' })
        seen.add(v)
        cleaned.push(v)
      }
      // Empty loadout is allowed at the API level (client resets) but
      // getUserLoadout() will substitute defaults on read.
      await prisma.user.update({
        where: { id: userId },
        data: { equippedEmotes: JSON.stringify(cleaned) },
      })
      return { ok: true, loadout: cleaned }
    },
  )
}
