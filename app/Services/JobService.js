'use strict'

const Database = use('Database')
const Config = use('Config')

class JobService {
  /**
   * Dispatch a job to the queue
   * 
   * @param {String} jobPath - Path to the job class (e.g., 'App/Jobs/GeneratePdfJob')
   * @param {Object} data - Data to pass to the job
   * @param {Object} options - Job options (attempts, timeout, etc.)
   * @returns {Promise<Object>} Job record
   */
  static async dispatch(jobPath, data, options = {}) {
    try {
      const { attempts = 1, timeout = 60000 } = options
      const queueConfig = Config.get('queue')
      const jobsTable = queueConfig.database.table || 'jobs'
      const queue = queueConfig.queue || 'default'

      const payload = {
        job: jobPath,
        data: data,
        attempts: 0
      }
      const payloadJson = stringifyPayload(payload)

      await Database
        .table(jobsTable)
        .insert({
          queue: queue,
          payload: payloadJson,
          attempts: 0,
          created_at: new Date(),
          updated_at: new Date()
        })

      console.log(`Job dispatched: ${jobPath}`)
    } catch (error) {
      const safeMessage = formatDispatchError(error)
      console.error(`Job dispatch failed: ${safeMessage}`)

      const dispatchError = new Error(`Job dispatch failed: ${safeMessage}`)
      dispatchError.code = error && error.code
      throw dispatchError
    }
  }
}

function stringifyPayload(payload) {
  return JSON.stringify(payload).replace(/[\u007f-\uffff]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

function formatDispatchError(error) {
  if (!error) return 'Unknown error'

  const code = error.code || error.errno || ''
  const raw = String(error.sqlMessage || error.message || 'Unknown error')
  let message = raw

  if (code) {
    const marker = `${code}:`
    const index = message.indexOf(marker)
    if (index >= 0) {
      message = message.slice(index + marker.length).trim()
    }
  }

  if (message === raw) {
    const sqlSeparator = message.lastIndexOf(' - ')
    if (sqlSeparator >= 0) {
      message = message.slice(sqlSeparator + 3).trim()
    }
  }

  message = redactSecrets(message)
  return code ? `${code}: ${message}` : message
}

function redactSecrets(message) {
  return String(message || '')
    .replace(/("smtpPass"\s*:\s*")([^"]*)(")/gi, '$1[REDACTED]$3')
    .replace(/("smtp_pass"\s*:\s*")([^"]*)(")/gi, '$1[REDACTED]$3')
    .replace(/("password"\s*:\s*")([^"]*)(")/gi, '$1[REDACTED]$3')
    .slice(0, 500)
}

module.exports = JobService
