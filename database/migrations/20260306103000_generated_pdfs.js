'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class GeneratedPdfsSchema extends Schema {
  up () {
    this.create('generated_pdfs', (table) => {
      table.increments()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL')
      table.string('template', 100).notNullable()
      table.string('filename', 191).notNullable()
      table.string('download_url', 500).notNullable()
      table.string('saved_path', 500).notNullable()
      table.string('email', 254).notNullable()
      table.string('company_name', 191).notNullable()
      table.json('data').nullable()
      table.timestamps()
    })
  }

  down () {
    this.drop('generated_pdfs')
  }
}

module.exports = GeneratedPdfsSchema
