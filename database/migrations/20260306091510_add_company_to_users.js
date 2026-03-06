'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddCompanyToUsersSchema extends Schema {
  up () {
    this.table('users', (table) => {
      table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL').index()
    })
  }

  down () {
    this.table('users', (table) => {
      table.dropForeign('company_id')
      table.dropColumn('company_id')
    })
  }
}

module.exports = AddCompanyToUsersSchema
