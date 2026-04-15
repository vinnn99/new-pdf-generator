'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class CompanySignatureUrlsSchema extends Schema {
  up () {
    this.create('company_signature_urls', (table) => {
      table.increments()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('url', 2000).notNullable()
      table.string('url_normalized', 512).notNullable()
      table.datetime('last_used_at').notNullable()
      table.integer('use_count').notNullable().defaultTo(1)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamps()

      table.unique(['company_id', 'url_normalized'])
      table.index(['company_id'])
      table.index(['last_used_at'])
      table.index(['company_id', 'last_used_at'])
    })
  }

  down () {
    this.drop('company_signature_urls')
  }
}

module.exports = CompanySignatureUrlsSchema
