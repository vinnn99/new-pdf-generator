'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddIsActiveToCompaniesSchema extends Schema {
  up () {
    this.table('companies', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true).index()
    })
  }

  down () {
    this.table('companies', (table) => {
      table.dropColumn('is_active')
    })
  }
}

module.exports = AddIsActiveToCompaniesSchema
