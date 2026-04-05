import { describe, it, expect, vi } from 'vitest'

// The setup.ts mocks prisma globally. To test the real prisma singleton module
// we need to bypass the global mock. We test the module logic here.

describe('prisma config', () => {
  it('exports a prisma instance', async () => {
    // The global mock in setup.ts gives us the mocked version
    const { prisma } = await import('../../config/prisma')
    expect(prisma).toBeDefined()
    expect(typeof prisma).toBe('object')
  })

  it('prisma mock has expected model methods', async () => {
    const { prisma } = await import('../../config/prisma')
    expect(prisma.user).toBeDefined()
    expect(typeof prisma.user.findUnique).toBe('function')
    expect(typeof prisma.user.create).toBe('function')
    expect(typeof prisma.user.update).toBe('function')
  })
})
