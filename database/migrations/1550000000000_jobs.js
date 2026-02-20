'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class JobsTableSchema extends Schema {
  up() {
    this.create('jobs', (table) => {
      table.increments('id')
      table.string('queue').index()
      table.text('payload').notNullable()
      table.integer('attempts').defaultTo(0)
      table.text('failed_at').nullable()
      table.timestamps()
    })
  }

  down() {
    this.drop('jobs')
  }
}

module.exports = JobsTableSchema
