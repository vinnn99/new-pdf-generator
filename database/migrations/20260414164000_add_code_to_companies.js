'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddCodeToCompaniesSchema extends Schema {
  up () {
    this.table('companies', (table) => {
      table.string('code', 20).nullable()
    })
  }

  down () {
    this.table('companies', (table) => {
      table.dropColumn('code')
    })
  }
}

module.exports = AddCodeToCompaniesSchema
