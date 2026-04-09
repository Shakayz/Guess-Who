import { PrismaClient } from '@prisma/client'
import { childLogger } from './logger'

const log = childLogger('prisma')

declare global {
  var __prisma: PrismaClient | undefined
}

if (!global.__prisma) {
  log.info('initializing prisma client')
}

export const prisma = global.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
