'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddSmtpToCompaniesSchema extends Schema {
  up () {
    this.table('companies', (table) => {
      table.string('smtp_host', 191).nullable()
      table.integer('smtp_port').nullable()
      table.string('smtp_user', 191).nullable()
      table.string('smtp_pass', 191).nullable()
      table.boolean('smtp_secure').defaultTo(false)
      table.string('mail_from', 191).nullable()
    })
  }

  down () {
    this.table('companies', (table) => {
      table.dropColumn('smtp_host')
      table.dropColumn('smtp_port')
      table.dropColumn('smtp_user')
      table.dropColumn('smtp_pass')
      table.dropColumn('smtp_secure')
      table.dropColumn('mail_from')
    })
  }
}

module.exports = AddSmtpToCompaniesSchema
