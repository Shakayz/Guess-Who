import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env') })

import { buildApp } from './app'
import { env } from './config/env'
import { startLpDecayWorker, scheduleLpDecayJob } from './jobs/lpDecay'

const start = async () => {
  const app = await buildApp()
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`🚀 API running on http://0.0.0.0:${env.PORT}`)

    // Start background jobs
    startLpDecayWorker()
    await scheduleLpDecayJob()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
