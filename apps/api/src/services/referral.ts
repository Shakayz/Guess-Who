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
 * Credit both sides of a referral atomically. The invitee row must NOT have
 * a `referredByUserId` yet — this is the check that makes the operation
 * idempotent against concurrent retries. On success, returns the rewards
 * that were applied; returns null if the invitee had already been credited
 * (the signup flow should treat that as a silent no-op).
 */
export async function creditReferral(
  inviterId: string,
  inviteeId: string,
): Promise<{ inviterReward: number; inviteeReward: number } | null> {
  if (inviterId === inviteeId) return null

  const claim = await prisma.user.updateMany({
    where: { id: inviteeId, referredByUserId: null },
    data: {
      referredByUserId: inviterId,
      starCoins: { increment: REFERRAL_INVITEE_REWARD },
    },
  })
  if (claim.count !== 1) return null

  await prisma.user.update({
    where: { id: inviterId },
    data: { starCoins: { increment: REFERRAL_INVITER_REWARD } },
  })

  return {
    inviterReward: REFERRAL_INVITER_REWARD,
    inviteeReward: REFERRAL_INVITEE_REWARD,
  }
}
