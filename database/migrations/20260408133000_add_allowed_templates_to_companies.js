'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddAllowedTemplatesToCompaniesSchema extends Schema {
  up () {
    this.table('companies', (table) => {
      table.text('allowed_templates').nullable()
    })
  }

  down () {
    this.table('companies', (table) => {
      table.dropColumn('allowed_templates')
    })
  }
}

module.exports = AddAllowedTemplatesToCompaniesSchema
