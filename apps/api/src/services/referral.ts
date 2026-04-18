import crypto from 'crypto'
import { prisma } from '../config/prisma'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
} from '@red-handed/shared'

/**
 * Referral codes are 8 uppercase alphanumerics, unambiguous (no 0/O/I/1) so
 * they can be read aloud or typed from a screenshot without transcription
 * errors. 8 chars over the 32-symbol alphabet gives ~10^12 combinations, far
 * more than we'll ever hand out, which keeps the retry loop short.
 */
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCandidate(): string {
  let out = ''
  const bytes = crypto.randomBytes(8)
  for (let i = 0; i < 8; i++) out += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length]
  return out
}

/** Atomically claim a fresh, unique referral code. */
export async function allocateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCandidate()
    const collision = await prisma.user.findUnique({ where: { referralCode: code } })
    if (!collision) return code
  }
  throw new Error('Could not allocate a unique referral code after 6 attempts')
}

/**
 * Ensure the given user has a referralCode, generating and persisting one on
 * first access. Safe to call from any route; subsequent calls are no-ops.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (!user) throw new Error(`User ${userId} not found`)
  if (user.referralCode) return user.referralCode

  const code = await allocateReferralCode()
  // updateMany guards against the case where another request allocated one
  // concurrently; the WHERE clause only matches if we're still the first.
  await prisma.user.updateMany({
    where: { id: userId, referralCode: null },
    data: { referralCode: code },
  })
  const after = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  return after?.referralCode ?? code
}

/**
 * Look up an inviter by code. Returns null if the code doesn't match or
 * belongs to the invitee themselves (self-referral is always rejected).
 */
export async function resolveInviter(
  code: string,
  excludeUserId?: string,
): Promise<{ id: string } | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const inviter = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true },
  })
  if (!inviter) return null
  if (excludeUserId && inviter.id === excludeUserId) return null
  return inviter
}

/**
 * Credit the invitee side of a referral at signup. Sets `referredByUserId`
 * and bumps the invitee's star balance by REFERRAL_INVITEE_REWARD atomically.
 * The invitee row must NOT already have a `referredByUserId` — this is the
 * check that makes the operation idempotent against concurrent retries.
 *
 * The inviter is NOT credited here; their reward is deferred until the
 * invitee plays their first ranked game (see `creditInviterForFirstGame`),
 * so the +50 ⭐ incentive can't be farmed by creating throwaway accounts.
 *
 * Returns the amount awarded to the invitee on success, or null if the
 * invitee had already been linked (treated as a silent no-op).
 */
export async function creditInvitee(
  inviterId: string,
  inviteeId: string,
): Promise<{ inviteeReward: number } | null> {
  if (inviterId === inviteeId) return null

  const claim = await prisma.user.updateMany({
    where: { id: inviteeId, referredByUserId: null },
    data: {
      referredByUserId: inviterId,
      starCoins: { increment: REFERRAL_INVITEE_REWARD },
    },
  })
  if (claim.count !== 1) return null

  return { inviteeReward: REFERRAL_INVITEE_REWARD }
}

/**
 * Fire the deferred inviter reward after the invitee finishes their first
 * ranked game. Called from the gameLoop's post-game XP pass. The
 * `referralInviterRewarded` flag on the invitee row is the idempotency
 * gate — `updateMany` with that flag in the WHERE clause ensures the
 * inviter can only be paid once per invitee, even under concurrent calls.
 *
 * Returns the amount credited to the inviter, or null if there's nothing
 * to do (no inviter, or the reward was already paid).
 */
export async function creditInviterForFirstGame(
  inviteeId: string,
): Promise<{ inviterId: string; inviterReward: number } | null> {
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeId },
    select: { referredByUserId: true, referralInviterRewarded: true },
  })
  if (!invitee || !invitee.referredByUserId || invitee.referralInviterRewarded) {
    return null
  }

  const claim = await prisma.user.updateMany({
    where: { id: inviteeId, referralInviterRewarded: false, referredByUserId: { not: null } },
    data: { referralInviterRewarded: true },
  })
  if (claim.count !== 1) return null

  await prisma.user.update({
    where: { id: invitee.referredByUserId },
    data: { starCoins: { increment: REFERRAL_INVITER_REWARD } },
  })

  return {
    inviterId: invitee.referredByUserId,
    inviterReward: REFERRAL_INVITER_REWARD,
  }
}
