'use strict'

/**
 * Queue Bootstrap
 * 
 * This file is used to register all jobs available for the queue system
 * Jobs are loaded and registered here for the worker to execute
 */

const Job = use('Job')

// Register jobs
Job.register([
  'App/Jobs/GeneratePdfJob'
])
