'use strict'

const { Command } = require('@adonisjs/ace')

class Queue extends Command {
  static get signature() {
    return `
    queue
    { --listen : Listen mode - continuously process jobs }
    `
  }

  static get description() {
    return 'Process queue jobs'
  }

  async handle(args, options) {
    this.info('Queue Worker Started')
    this.info('Listening for jobs...')
    this.info('Press Ctrl+C to stop')

    const Database = use('Database')
    const Config = use('Config')

    const queueConfig = Config.get('queue')
    const jobsTable = queueConfig.database.table || 'jobs'
    const maxAttempts = queueConfig.jobs.maxAttempts || 3
    const timeout = queueConfig.jobs.timeout || 60000

    let isRunning = true

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.info('\n\nShutting down queue worker...')
      isRunning = false
      process.exit(0)
    })

    // Main loop
    while (isRunning) {
      try {
        // Get next job from queue
        const job = await Database
          .table(jobsTable)
          .where('failed_at', null)
          .orderBy('id', 'asc')
          .limit(1)
          .first()

        if (!job) {
          // No jobs available, wait before checking again
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }

        this.info(`Processing job ID: ${job.id}`)

        try {
          const payload = JSON.parse(job.payload)
          const path = require('path')
          const jobFilePath = path.join(process.cwd(), payload.job.replace(/^App\//, 'app/'))
          const jobClass = require(jobFilePath)
          const jobInstance = new jobClass()

          // Execute job with timeout
          const jobPromise = jobInstance.handle(payload.data)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Job timeout')), timeout)
          )

          await Promise.race([jobPromise, timeoutPromise])

          // Job succeeded, remove it
          await Database.table(jobsTable).where('id', job.id).delete()
          this.success(`Job ID ${job.id} completed successfully`)
        } catch (error) {
          this.error(`Job ID ${job.id} failed: ${error.message}`)

          const attempts = job.attempts + 1

          if (attempts >= maxAttempts) {
            // Mark job as failed
            await Database
              .table(jobsTable)
              .where('id', job.id)
              .update({
                failed_at: new Date(),
                attempts: attempts
              })
            this.error(`Job ID ${job.id} marked as failed after ${maxAttempts} attempts`)
          } else {
            // Increment attempts
            await Database
              .table(jobsTable)
              .where('id', job.id)
              .update({ attempts: attempts })
            this.warn(`Job ID ${job.id} will be retried (attempt ${attempts}/${maxAttempts})`)
          }
        }
      } catch (error) {
        this.error(`Queue processor error: ${error.message}`)
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }
}

module.exports = Queue
