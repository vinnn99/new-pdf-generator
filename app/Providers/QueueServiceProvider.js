'use strict'

const { ServiceProvider } = require('@adonisjs/fold')
const JobService = require('../Services/JobService')

class QueueServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('Job', () => JobService)
  }

  boot() {
    // Boot logic here if needed
  }

  async shutdown() {
    // Cleanup logic here if needed
  }
}

module.exports = QueueServiceProvider
