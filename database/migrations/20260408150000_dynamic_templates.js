'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class DynamicTemplatesSchema extends Schema {
  up () {
    this.create('dynamic_templates', (table) => {
      table.increments()
      table.string('template_key', 100).notNullable().index()
      table.string('name', 191).notNullable()
      table.integer('company_id').unsigned().nullable().references('company_id').inTable('companies').onDelete('SET NULL').index()
      table.string('source_type', 50).notNullable().defaultTo('pdfmake_json')
      table.text('required_fields').nullable() // JSON array string
      table.text('content_json', 'longtext').notNullable() // JSON object string (docDefinition template)
      table.boolean('is_active').notNullable().defaultTo(true).index()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamps()

      table.unique(['template_key', 'company_id'])
    })
  }

  down () {
    this.drop('dynamic_templates')
  }
}

module.exports = DynamicTemplatesSchema
