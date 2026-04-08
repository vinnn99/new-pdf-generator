'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class EmailLogsSchema extends Schema {
  up () {
    this.create('email_logs', (table) => {
      table.increments()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL')
      table.string('template', 100).nullable()
      table.string('context', 100).nullable()
      table.string('to_email', 254).notNullable()
      table.text('cc').nullable()
      table.text('bcc').nullable()
      table.string('subject', 255).nullable()
      table.text('body').nullable()
      table.text('attachments').nullable() // JSON array string
      table.string('status', 50).notNullable()
      table.text('error').nullable()
      table.timestamps()
    })
  }

  down () {
    this.drop('email_logs')
  }
}

module.exports = EmailLogsSchema
