const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
type LogLevel = typeof LOG_LEVELS[number]

const currentLevel: LogLevel = __DEV__ ? 'debug' : 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(currentLevel)
}

function formatMsg(level: LogLevel, module: string, msg: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`
  return { prefix, msg, data }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('debug')) { const f = formatMsg('debug', module, msg, data); console.debug(f.prefix, f.msg, f.data || '') }
    },
    info: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('info')) { const f = formatMsg('info', module, msg, data); console.info(f.prefix, f.msg, f.data || '') }
    },
    warn: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('warn')) { const f = formatMsg('warn', module, msg, data); console.warn(f.prefix, f.msg, f.data || '') }
    },
    error: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('error')) { const f = formatMsg('error', module, msg, data); console.error(f.prefix, f.msg, f.data || '') }
    },
  }
}
