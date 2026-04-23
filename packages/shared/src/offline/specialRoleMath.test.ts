import {
  ZERO_SPECIAL_COUNTS,
  autoReduceOverflow,
  clampRedHandedCount,
  computeMaxRoleCounts,
  computeRoleHeadroom,
  getDefaultRedHandedCount,
  isNeutralUnlocked,
  isPairUnlocked,
  maxRedHandedFor,
  minPlayersFor,
  type SpecialRoleCounts,
} from './specialRoleMath'

const counts = (overrides: Partial<SpecialRoleCounts> = {}): SpecialRoleCounts => ({
  ...ZERO_SPECIAL_COUNTS,
  ...overrides,
})

describe('getDefaultRedHandedCount', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 2],
    [7, 2],
    [8, 3],
    [11, 3],
    [12, 4],
    [20, 4],
  ])('player count %i → %i redHanded', (players, expected) => {
    expect(getDefaultRedHandedCount(players)).toBe(expected)
  })
})

describe('maxRedHandedFor', () => {
  it('caps at 1/3 of players', () => {
    expect(maxRedHandedFor(3)).toBe(1)
    expect(maxRedHandedFor(6)).toBe(2)
    expect(maxRedHandedFor(9)).toBe(3)
    expect(maxRedHandedFor(10)).toBe(3)
    expect(maxRedHandedFor(12)).toBe(4)
  })

  it('never exceeds 6 even for huge tables', () => {
    expect(maxRedHandedFor(30)).toBe(6)
    expect(maxRedHandedFor(99)).toBe(6)
  })

  it('always returns at least 1', () => {
    expect(maxRedHandedFor(2)).toBe(1)
    expect(maxRedHandedFor(1)).toBe(1)
  })
})

describe('minPlayersFor', () => {
  it('returns 3 for normal mode', () => {
    expect(minPlayersFor('normal')).toBe(3)
  })
  it('returns 6 for special mode', () => {
    expect(minPlayersFor('special')).toBe(6)
  })
})

describe('isNeutralUnlocked', () => {
  it('locks neutrals below 10 players', () => {
    expect(isNeutralUnlocked(9)).toBe(false)
  })
  it('unlocks neutrals at 10+', () => {
    expect(isNeutralUnlocked(10)).toBe(true)
    expect(isNeutralUnlocked(15)).toBe(true)
  })
})

describe('isPairUnlocked', () => {
  it('locks pairs below 10 players', () => {
    expect(isPairUnlocked(9)).toBe(false)
  })
  it('unlocks pairs at 10+', () => {
    expect(isPairUnlocked(10)).toBe(true)
    expect(isPairUnlocked(15)).toBe(true)
  })
})

describe('computeRoleHeadroom', () => {
  it('reports remaining slots for an empty special-role lobby', () => {
    const h = computeRoleHeadroom(6, 2, counts())
    // redHandedCount=2 is the TOTAL evil-side budget; no specials consume it yet.
    expect(h.currentEvil).toBe(2)
    expect(h.evilHeadroom).toBe(2)
    // slotsUsed = redHandedCount + currentGoodSpecial + evilTwins = 2 + 0 + 0 = 2
    // goodHeadroom = 6 - 2 = 4 (no forced plain villager)
    expect(h.goodHeadroom).toBe(4)
  })

  it('counts evilTwins toward both sides', () => {
    const base = computeRoleHeadroom(10, 3, counts())
    const withTwins = computeRoleHeadroom(10, 3, counts({ evilTwins: 1 }))
    // redHandedCount already includes all evil roles, so currentEvil is constant…
    expect(base.currentEvil).toBe(3)
    expect(withTwins.currentEvil).toBe(3)
    // …but evilTwins consumes one evil-budget slot AND one villager-side slot,
    // so both headrooms drop by exactly 1 compared to the empty lobby.
    expect(base.evilHeadroom - withTwins.evilHeadroom).toBe(1)
    expect(base.goodHeadroom - withTwins.goodHeadroom).toBe(1)
    // Concrete values: evilHeadroom = 3 - 1 = 2; goodHeadroom = 10 - 3 - 0 - 1 = 6
    expect(withTwins.evilHeadroom).toBe(2)
    expect(withTwins.goodHeadroom).toBe(6)
  })
})

describe('computeMaxRoleCounts', () => {
  it('caps villager-side roles at hard caps when there is room', () => {
    const max = computeMaxRoleCounts(12, 3, counts())
    expect(max.detective).toBe(3) // hard cap
    expect(max.guardian).toBe(2) // hard cap
    expect(max.mayor).toBe(1) // hard cap
  })

  it('forbids neutrals below 10 players', () => {
    const max = computeMaxRoleCounts(6, 2, counts())
    expect(max.jester).toBe(0)
  })

  it('allows jester at 10+ players', () => {
    const max = computeMaxRoleCounts(10, 3, counts())
    expect(max.jester).toBe(1)
  })

  it('forbids evil twins below 10 players', () => {
    const max = computeMaxRoleCounts(9, 3, counts())
    expect(max.evilTwins).toBe(0)
  })

  it('allows evil twins at 10+ players', () => {
    const max = computeMaxRoleCounts(10, 3, counts())
    expect(max.evilTwins).toBe(1)
  })

  it('shrinks evil-side max as redHanded slots fill', () => {
    // redHandedCount=2 is the total evil budget. Specials already sum to 2 → no headroom.
    const max = computeMaxRoleCounts(9, 2, counts({ corruptor: 1, inverter: 1 }))
    // existing specials stay at their current value (capped at hard cap),
    // but nothing else can be added since evilHeadroom = 0.
    expect(max.corruptor).toBe(1)
    expect(max.inverter).toBe(1)
    expect(max.doubleAgent).toBe(0)
    expect(max.kamikaze).toBe(0)
  })

  it('handles 3-player edge case', () => {
    const max = computeMaxRoleCounts(3, 1, counts())
    // redHandedCount=1 total evil budget, empty specials → evilHeadroom = 1.
    expect(max.doubleAgent).toBe(1)
    // goodHeadroom = 3 - 1 - 0 - 0 = 2 (no reserved plain villager)
    expect(max.detective).toBe(2)
    // neutrals stay locked below 10 players
    expect(max.jester).toBe(0)
  })
})

describe('autoReduceOverflow', () => {
  it('is a no-op when under the cap', () => {
    const initial = counts({ corruptor: 1 })
    const result = autoReduceOverflow(9, 2, initial)
    expect(result.changed).toBe(false)
    expect(result.counts).toBe(initial)
  })

  it('drops evilTwins first when over the cap', () => {
    // redHandedCount=2 evil budget; specials sum to 3 (corruptor+evilTwins+doubleAgent) → excess=1.
    // Reducer order is evilTwins → inverter → corruptor → kamikaze → infiltrator → doubleAgent,
    // so evilTwins is dropped first and the rest are left alone.
    const result = autoReduceOverflow(
      6,
      2,
      counts({ corruptor: 1, evilTwins: 1, doubleAgent: 1 }),
    )
    expect(result.changed).toBe(true)
    expect(result.counts.evilTwins).toBe(0)
    expect(result.counts.corruptor).toBe(1)
    expect(result.counts.doubleAgent).toBe(1)
  })

  it('reduces specials without touching the redHanded budget', () => {
    // redHandedCount=2 budget, specials = 3 (corruptor+inverter+kamikaze) → excess=1.
    // Reducer order drops inverter first (evilTwins is already 0).
    const result = autoReduceOverflow(
      6,
      2,
      counts({ corruptor: 1, inverter: 1, kamikaze: 1 }),
    )
    expect(result.changed).toBe(true)
    expect(result.counts.inverter).toBe(0)
    expect(result.counts.corruptor).toBe(1)
    expect(result.counts.kamikaze).toBe(1)
    // redHandedCount itself is an argument, not part of counts, so the helper can't mutate it.
  })

  it('does not mutate input counts', () => {
    const input = counts({ corruptor: 1, evilTwins: 1 })
    const snapshot = { ...input }
    autoReduceOverflow(6, 2, input)
    expect(input).toEqual(snapshot)
  })
})

describe('clampRedHandedCount', () => {
  it('floors at 1', () => {
    expect(clampRedHandedCount(6, 0)).toBe(1)
    expect(clampRedHandedCount(6, -3)).toBe(1)
  })
  it('caps at 1/3 of players', () => {
    expect(clampRedHandedCount(6, 5)).toBe(2)
    expect(clampRedHandedCount(9, 9)).toBe(3)
  })
  it('caps at 6 for huge tables', () => {
    expect(clampRedHandedCount(30, 10)).toBe(6)
  })
})
