'use strict'

/**
 * Auto-start queue worker when HTTP server boots.
 * Set QUEUE_AUTOSTART=false or NODE_ENV=test to skip.
 */

const { spawn } = require('child_process')
const path = require('path')

const shouldAutoStart = process.env.QUEUE_AUTOSTART !== 'false' && process.env.NODE_ENV !== 'test'

if (shouldAutoStart) {
  const acePath = path.join(__dirname, '..', 'ace')

  console.log('[queue] starting background worker...')

  const worker = spawn(process.execPath, [acePath, 'queue', '--listen'], {
    stdio: 'inherit',
    env: process.env
  })

  const stopWorker = () => {
    if (!worker.killed) {
      worker.kill()
    }
  }

  process.on('exit', stopWorker)
  process.on('SIGINT', stopWorker)
  process.on('SIGTERM', stopWorker)

  worker.on('exit', (code, signal) => {
    console.log(`[queue] worker exited (${signal || code})`)
  })
} else {
  console.log('[queue] auto-start skipped (QUEUE_AUTOSTART=false or NODE_ENV=test)')
}
