import {
  ZERO_SPECIAL_COUNTS,
  autoReduceOverflow,
  clampImposterCount,
  computeMaxRoleCounts,
  computeRoleHeadroom,
  getDefaultImposterCount,
  isNeutralUnlocked,
  maxImpostersFor,
  minPlayersFor,
  type SpecialRoleCounts,
} from './specialRoleMath'

const counts = (overrides: Partial<SpecialRoleCounts> = {}): SpecialRoleCounts => ({
  ...ZERO_SPECIAL_COUNTS,
  ...overrides,
})

describe('getDefaultImposterCount', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 2],
    [7, 2],
    [8, 3],
    [11, 3],
    [12, 4],
    [20, 4],
  ])('player count %i → %i imposters', (players, expected) => {
    expect(getDefaultImposterCount(players)).toBe(expected)
  })
})

describe('maxImpostersFor', () => {
  it('caps at 1/3 of players', () => {
    expect(maxImpostersFor(3)).toBe(1)
    expect(maxImpostersFor(6)).toBe(2)
    expect(maxImpostersFor(9)).toBe(3)
    expect(maxImpostersFor(10)).toBe(3)
    expect(maxImpostersFor(12)).toBe(4)
  })

  it('never exceeds 6 even for huge tables', () => {
    expect(maxImpostersFor(30)).toBe(6)
    expect(maxImpostersFor(99)).toBe(6)
  })

  it('always returns at least 1', () => {
    expect(maxImpostersFor(2)).toBe(1)
    expect(maxImpostersFor(1)).toBe(1)
  })
})

describe('minPlayersFor', () => {
  it('returns 3 for normal mode', () => {
    expect(minPlayersFor('normal')).toBe(3)
  })
  it('returns 5 for special mode', () => {
    expect(minPlayersFor('special')).toBe(5)
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

describe('computeRoleHeadroom', () => {
  it('reports remaining slots for an empty special-role lobby', () => {
    const h = computeRoleHeadroom(6, 2, counts())
    // 6 players, evilCap=2, currentEvil=2 → evilHeadroom=0
    expect(h.currentEvil).toBe(2)
    expect(h.evilHeadroom).toBe(0)
    // goodHeadroom = players - currentEvil - currentGoodSpecial - evilTwins - 1
    //              = 6 - 2 - 0 - 0 - 1 = 3
    expect(h.goodHeadroom).toBe(3)
  })

  it('counts evilTwins toward both sides', () => {
    const h = computeRoleHeadroom(10, 3, counts({ evilTwins: 1 }))
    // currentEvil = 3 + 1 = 4, evilCap=3 → evilHeadroom=0
    expect(h.currentEvil).toBe(4)
    expect(h.evilHeadroom).toBe(0)
    // slotsUsed = 4 + 0 + 1 = 5; goodHeadroom = 10 - 5 - 1 = 4
    expect(h.goodHeadroom).toBe(4)
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

  it('shrinks evil-side max as imposter slots fill', () => {
    // 9 players → evilCap=3. With imposterCount=2 and corruptor=1, headroom is 0.
    const max = computeMaxRoleCounts(9, 2, counts({ corruptor: 1 }))
    // current corruptor + 0 headroom = 1 → max corruptor stays at 1
    expect(max.corruptor).toBe(1)
    // can't add another inverter since headroom is 0
    expect(max.inverter).toBe(0)
  })

  it('handles 3-player edge case', () => {
    const max = computeMaxRoleCounts(3, 1, counts())
    // evilCap=1, currentEvil=1 → no evil headroom
    expect(max.doubleAgent).toBe(0)
    // goodHeadroom = 3 - 1 - 0 - 0 - 1 = 1
    expect(max.detective).toBe(1)
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
    // 6 players, cap=2. imposter=2, corruptor=1, evilTwins=1 → excess=2
    const result = autoReduceOverflow(6, 2, counts({ corruptor: 1, evilTwins: 1 }))
    expect(result.changed).toBe(true)
    expect(result.counts.evilTwins).toBe(0)
    expect(result.counts.corruptor).toBe(0)
  })

  it('preserves the baseline imposter count', () => {
    const result = autoReduceOverflow(6, 3, counts({ corruptor: 1 }))
    // cap=2, imposterCount=3 → already over by itself; helper does NOT touch imposterCount
    // It can still trim the corruptor (excess = 3+1-2 = 2; reduces corruptor by 1 → still 1 short)
    expect(result.counts.corruptor).toBe(0)
  })

  it('does not mutate input counts', () => {
    const input = counts({ corruptor: 1, evilTwins: 1 })
    const snapshot = { ...input }
    autoReduceOverflow(6, 2, input)
    expect(input).toEqual(snapshot)
  })
})

describe('clampImposterCount', () => {
  it('floors at 1', () => {
    expect(clampImposterCount(6, 0)).toBe(1)
    expect(clampImposterCount(6, -3)).toBe(1)
  })
  it('caps at 1/3 of players', () => {
    expect(clampImposterCount(6, 5)).toBe(2)
    expect(clampImposterCount(9, 9)).toBe(3)
  })
  it('caps at 6 for huge tables', () => {
    expect(clampImposterCount(30, 10)).toBe(6)
  })
})
