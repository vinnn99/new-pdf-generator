'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddApiKeyToCompaniesSchema extends Schema {
  up () {
    this.table('companies', (table) => {
      table.string('api_key', 191).notNullable().unique()
    })
  }

  down () {
    this.table('companies', (table) => {
      table.dropColumn('api_key')
    })
  }
}

module.exports = AddApiKeyToCompaniesSchema
