/**
 * referral.test.ts
 *
 * Tests for src/services/referral.ts — the code-allocation + credit helpers
 * that back the referral system.
 *
 * The service is purely Prisma-driven (no Redis, no external APIs), so the
 * harness is the same as the other unit tests: `prisma` is mocked from
 * setup.ts, each test wires `mockImplementation` on the specific calls it
 * exercises, and we assert the updateMany/update call shapes that encode the
 * idempotency guarantees.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../config/prisma'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
} from '@red-handed/shared'
import {
  allocateReferralCode,
  ensureReferralCode,
  resolveInviter,
  creditInvitee,
  creditInviterForFirstGame,
} from '../../services/referral'

const mockPrisma = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('allocateReferralCode', () => {
  it('returns an 8-char code drawn from the unambiguous alphabet', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    const code = await allocateReferralCode()
    expect(code).toHaveLength(8)
    // Alphabet excludes 0/O/I/1 to avoid read-aloud ambiguity.
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
  })

  it('retries when a generated candidate collides with an existing user', async () => {
    // First candidate collides, second is free.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'someone-else' })
      .mockResolvedValueOnce(null)
    const code = await allocateReferralCode()
    expect(code).toHaveLength(8)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('throws if the first 6 candidates all collide (catastrophic alphabet exhaustion)', async () => {
    // Every findUnique returns a row → every candidate collides.
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'always-collides' })
    await expect(allocateReferralCode()).rejects.toThrow(/unique referral code after 6 attempts/)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(6)
  })
})

describe('ensureReferralCode', () => {
  it('returns the existing code without allocating when one is already set', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ referralCode: 'EXISTING0' })

    const code = await ensureReferralCode('u1')

    expect(code).toBe('EXISTING0')
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('allocates a fresh code and persists it via a null-guarded updateMany', async () => {
    // First findUnique: current user has no code.
    // Second findUnique (inside allocateReferralCode): candidate check — no collision.
    // Third findUnique: re-read after write.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ referralCode: null })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ referralCode: 'NEWCODE1' })
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 })

    const code = await ensureReferralCode('u1')

    expect(code).toBe('NEWCODE1')
    // The WHERE clause must include `referralCode: null` so a concurrent write
    // from another request can't be clobbered.
    const [call] = mockPrisma.user.updateMany.mock.calls
    expect(call[0].where).toEqual({ id: 'u1', referralCode: null })
    expect(typeof call[0].data.referralCode).toBe('string')
    expect(call[0].data.referralCode).toHaveLength(8)
  })

  it('throws when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(ensureReferralCode('missing')).rejects.toThrow(/not found/)
  })

  it('returns the winner-take-all code if a concurrent request allocated first', async () => {
    // First read: no code. Candidate check: free. Update runs.
    // Re-read shows a DIFFERENT code — another request won the race.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ referralCode: null })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ referralCode: 'RACEWIN1' })
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 })

    const code = await ensureReferralCode('u1')

    expect(code).toBe('RACEWIN1')
  })
})

describe('resolveInviter', () => {
  it('normalises the input (trim + uppercase) before lookup', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'inviter' })
    const inviter = await resolveInviter('  abc12345 ')
    expect(inviter).toEqual({ id: 'inviter' })
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { referralCode: 'ABC12345' },
      select: { id: true },
    })
  })

  it('returns null for an empty/whitespace-only code (no DB lookup)', async () => {
    expect(await resolveInviter('   ')).toBeNull()
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when the code does not match any user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    expect(await resolveInviter('UNKNOWN1')).toBeNull()
  })

  it('rejects self-referral when excludeUserId matches the inviter', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'same-user' })
    expect(await resolveInviter('SELFCODE', 'same-user')).toBeNull()
  })

  it('allows a different user to redeem the code', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'inviter' })
    expect(await resolveInviter('SOMECODE', 'different-user')).toEqual({ id: 'inviter' })
  })
})

describe('creditInvitee', () => {
  it('refuses self-referral outright (no DB touch)', async () => {
    expect(await creditInvitee('u1', 'u1')).toBeNull()
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('atomically claims the invitee slot and credits REFERRAL_INVITEE_REWARD', async () => {
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 })

    const result = await creditInvitee('inviter', 'invitee')

    expect(result).toEqual({ inviteeReward: REFERRAL_INVITEE_REWARD })
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      // The `referredByUserId: null` guard is the idempotency gate.
      where: { id: 'invitee', referredByUserId: null },
      data: {
        referredByUserId: 'inviter',
        starCoins: { increment: REFERRAL_INVITEE_REWARD },
      },
    })
  })

  it('returns null (silent no-op) when the invitee was already linked', async () => {
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await creditInvitee('inviter', 'invitee')).toBeNull()
  })
})

describe('creditInviterForFirstGame', () => {
  it('returns null when the invitee was never referred', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredByUserId: null,
      referralInviterRewarded: false,
    })
    expect(await creditInviterForFirstGame('invitee')).toBeNull()
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('returns null when the inviter has already been paid (idempotency)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredByUserId: 'inviter',
      referralInviterRewarded: true,
    })
    expect(await creditInviterForFirstGame('invitee')).toBeNull()
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('returns null when the invitee row is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    expect(await creditInviterForFirstGame('ghost')).toBeNull()
  })

  it('atomically claims the reward flag and credits the inviter', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredByUserId: 'inviter',
      referralInviterRewarded: false,
    })
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.user.update.mockResolvedValueOnce({ id: 'inviter' })

    const result = await creditInviterForFirstGame('invitee')

    expect(result).toEqual({
      inviterId: 'inviter',
      inviterReward: REFERRAL_INVITER_REWARD,
    })

    // The flag-flip must be idempotent under concurrent calls: only one updater
    // should see referralInviterRewarded: false.
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'invitee',
        referralInviterRewarded: false,
        referredByUserId: { not: null },
      },
      data: { referralInviterRewarded: true },
    })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'inviter' },
      data: { starCoins: { increment: REFERRAL_INVITER_REWARD } },
    })
  })

  it('returns null (skips crediting) when another request already flipped the flag', async () => {
    // findUnique reads stale state (flag still false) but by the time the
    // updateMany runs, the row has already been flipped — count=0 means we
    // lost the race and must NOT credit the inviter a second time.
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      referredByUserId: 'inviter',
      referralInviterRewarded: false,
    })
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 })

    const result = await creditInviterForFirstGame('invitee')

    expect(result).toBeNull()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
