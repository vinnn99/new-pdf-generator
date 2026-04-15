'use strict'

const BaPreviewService = use('App/Services/BaPreviewService')

const env = String(process.env.NODE_ENV || '').toLowerCase()
const isTestEnv = env === 'test' || env === 'testing'
const shouldAutoStart = process.env.PREVIEW_CLEANUP_AUTOSTART !== 'false' && !isTestEnv

const rawIntervalMinutes = Number(process.env.PREVIEW_CLEANUP_INTERVAL_MINUTES || 5)
const intervalMinutes = Number.isFinite(rawIntervalMinutes) && rawIntervalMinutes >= 1
  ? Math.min(rawIntervalMinutes, 60)
  : 5
const intervalMs = Math.floor(intervalMinutes * 60 * 1000)

if (shouldAutoStart) {
  console.log(`[preview.cleanup] scheduler started (${intervalMinutes} menit)`)
  let running = false

  const tick = async () => {
    if (running) return
    running = true
    try {
      const result = await BaPreviewService.cleanupExpired()
      if (result.scanned > 0) {
        console.log('[preview.cleanup] done:', result)
      }
    } catch (error) {
      console.warn('[preview.cleanup] gagal:', error.message)
    } finally {
      running = false
    }
  }

  setTimeout(() => { tick().catch(() => {}) }, 10 * 1000)
  const timer = setInterval(() => { tick().catch(() => {}) }, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
} else {
  console.log('[preview.cleanup] scheduler skipped (test mode atau PREVIEW_CLEANUP_AUTOSTART=false)')
}
