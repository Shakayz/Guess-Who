import {
  EVIL_OFFLINE_ROLES,
  IMPOSTER_OFFLINE_ROLES,
  NEUTRAL_OFFLINE_ROLES,
  OFFLINE_ROLE_REGISTRY,
  PAIR_OFFLINE_ROLES,
  REVENANT_POST_DEATH_ROUNDS,
  VILLAGER_OFFLINE_ROLES,
  isEvilOfflineRole,
  type OfflineRole,
} from './roleConfig'

describe('OFFLINE_ROLE_REGISTRY', () => {
  it('contains an entry for every role key', () => {
    const roles: OfflineRole[] = [
      'villager',
      'imposter',
      'detective',
      'doubleAgent',
      'guardian',
      'mayor',
      'judge',
      'revenant',
      'infiltrator',
      'jester',
      'kamikaze',
      'corruptor',
      'inverter',
      'twinVillager',
      'twinImposter',
    ]
    for (const role of roles) {
      expect(OFFLINE_ROLE_REGISTRY[role]).toBeDefined()
      expect(OFFLINE_ROLE_REGISTRY[role].key).toBe(role)
    }
  })

  it('each registry entry has all required i18n keys and visual tokens', () => {
    for (const [key, def] of Object.entries(OFFLINE_ROLE_REGISTRY)) {
      expect(def.key).toBe(key)
      expect(def.team).toMatch(/^(villager|imposter|pair|neutral)$/)
      expect(typeof def.iconEmoji).toBe('string')
      expect(def.iconEmoji.length).toBeGreaterThan(0)
      expect(typeof def.colorToken).toBe('string')
      expect(def.i18nLabelKey.startsWith('offline.')).toBe(true)
      expect(def.i18nDescKey.startsWith('offline.')).toBe(true)
      expect(def.i18nInstructionKey.startsWith('offline.')).toBe(true)
    }
  })

  it('assigns expected teams for each role', () => {
    expect(OFFLINE_ROLE_REGISTRY.villager.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.imposter.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.detective.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.guardian.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.mayor.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.judge.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.revenant.team).toBe('villager')
    expect(OFFLINE_ROLE_REGISTRY.doubleAgent.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.infiltrator.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.kamikaze.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.corruptor.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.inverter.team).toBe('imposter')
    expect(OFFLINE_ROLE_REGISTRY.jester.team).toBe('neutral')
    expect(OFFLINE_ROLE_REGISTRY.twinVillager.team).toBe('pair')
    expect(OFFLINE_ROLE_REGISTRY.twinImposter.team).toBe('pair')
  })

  it('twins share a visual color token', () => {
    expect(OFFLINE_ROLE_REGISTRY.twinVillager.colorToken).toBe(
      OFFLINE_ROLE_REGISTRY.twinImposter.colorToken,
    )
  })

  it('assigns unique i18n label keys per role', () => {
    const labels = Object.values(OFFLINE_ROLE_REGISTRY).map((r) => r.i18nLabelKey)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('isEvilOfflineRole', () => {
  it.each([
    ['imposter', true],
    ['doubleAgent', true],
    ['infiltrator', true],
    ['kamikaze', true],
    ['corruptor', true],
    ['inverter', true],
    ['twinImposter', true],
    ['villager', false],
    ['detective', false],
    ['guardian', false],
    ['mayor', false],
    ['judge', false],
    ['revenant', false],
    ['twinVillager', false],
    ['jester', false],
  ] as const)('marks %s as evil=%s', (role, expected) => {
    expect(isEvilOfflineRole(role)).toBe(expected)
  })
})

describe('team groupings', () => {
  it('VILLAGER_OFFLINE_ROLES contains only villager-team roles', () => {
    for (const role of VILLAGER_OFFLINE_ROLES) {
      expect(OFFLINE_ROLE_REGISTRY[role].team).toBe('villager')
    }
  })

  it('IMPOSTER_OFFLINE_ROLES contains only imposter-team roles', () => {
    for (const role of IMPOSTER_OFFLINE_ROLES) {
      expect(OFFLINE_ROLE_REGISTRY[role].team).toBe('imposter')
    }
  })

  it('NEUTRAL_OFFLINE_ROLES contains only neutral-team roles', () => {
    for (const role of NEUTRAL_OFFLINE_ROLES) {
      expect(OFFLINE_ROLE_REGISTRY[role].team).toBe('neutral')
    }
  })

  it('PAIR_OFFLINE_ROLES contains only pair-team roles', () => {
    for (const role of PAIR_OFFLINE_ROLES) {
      expect(OFFLINE_ROLE_REGISTRY[role].team).toBe('pair')
    }
  })

  it('EVIL_OFFLINE_ROLES matches isEvilOfflineRole for every role', () => {
    const roles: OfflineRole[] = Object.keys(OFFLINE_ROLE_REGISTRY) as OfflineRole[]
    for (const role of roles) {
      const inEvilList = EVIL_OFFLINE_ROLES.includes(role)
      expect(isEvilOfflineRole(role)).toBe(inEvilList)
    }
  })

  it('special-role groups are disjoint (no role in two buckets)', () => {
    const all = [
      ...VILLAGER_OFFLINE_ROLES,
      ...IMPOSTER_OFFLINE_ROLES,
      ...NEUTRAL_OFFLINE_ROLES,
      ...PAIR_OFFLINE_ROLES,
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('special-role groups cover all non-base (non-villager/imposter) roles', () => {
    const grouped = new Set<OfflineRole>([
      ...VILLAGER_OFFLINE_ROLES,
      ...IMPOSTER_OFFLINE_ROLES,
      ...NEUTRAL_OFFLINE_ROLES,
      ...PAIR_OFFLINE_ROLES,
    ])
    const base: OfflineRole[] = ['villager', 'imposter']
    const expected = (Object.keys(OFFLINE_ROLE_REGISTRY) as OfflineRole[]).filter(
      (r) => !base.includes(r),
    )
    for (const role of expected) {
      expect(grouped.has(role)).toBe(true)
    }
  })
})

describe('REVENANT_POST_DEATH_ROUNDS', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(REVENANT_POST_DEATH_ROUNDS)).toBe(true)
    expect(REVENANT_POST_DEATH_ROUNDS).toBeGreaterThan(0)
  })
})
