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

      await Database
        .table(jobsTable)
        .insert({
          queue: queue,
          payload: JSON.stringify(payload),
          attempts: 0,
          created_at: new Date(),
          updated_at: new Date()
        })

      console.log(`Job dispatched: ${jobPath}`)
    } catch (error) {
      console.error(`Job dispatch failed: ${error.message}`)
      throw error
    }
  }
}

module.exports = JobService
