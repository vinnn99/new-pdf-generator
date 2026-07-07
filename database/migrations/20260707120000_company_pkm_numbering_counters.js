'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class CompanyPkmNumberingCountersSchema extends Schema {
  up () {
    this.create('company_pkm_numbering_counters', (table) => {
      table.increments()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('template', 100).notNullable()
      table.integer('last_seq').notNullable().defaultTo(0)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamps()

      table.unique(['company_id', 'template'])
      table.index(['company_id'])
      table.index(['template'])
    })
  }

  down () {
    this.drop('company_pkm_numbering_counters')
  }
}

module.exports = CompanyPkmNumberingCountersSchema
