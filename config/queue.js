'use strict'

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use('Env')

/** @type {import('@adonisjs/ignitor/src/Helpers')} */
const Helpers = use('Helpers')

module.exports = {
  /*
  |--------------------------------------------------------------------------
  | Default Queue Driver
  |--------------------------------------------------------------------------
  |
  | Queue driver to be used for managing jobs. You can configure multiple
  | drivers and switch between them as needed.
  |
  */
  driver: Env.get('QUEUE_DRIVER', 'database'),

  /*
  |--------------------------------------------------------------------------
  | Database Driver
  |--------------------------------------------------------------------------
  |
  | When using database driver, jobs are stored in a database table.
  | This allows you to use the same database for your application and jobs.
  |
  */
  database: {
    table: 'jobs',
    connection: Env.get('DB_CONNECTION', 'mysql')
  },

  /*
  |--------------------------------------------------------------------------
  | Redis Driver
  |--------------------------------------------------------------------------
  |
  | When using redis driver, jobs are stored in redis.
  | Make sure to have redis installed and running.
  |
  */
  redis: {
    connectionName: 'default'
  },

  /*
  |--------------------------------------------------------------------------
  | Job Settings
  |--------------------------------------------------------------------------
  |
  | Configure how jobs are processed and handled.
  |
  */
  jobs: {
    // Maximum number of attempts for a failed job
    maxAttempts: 3,
    // Timeout for job processing in milliseconds
    timeout: 60000
  }
}
