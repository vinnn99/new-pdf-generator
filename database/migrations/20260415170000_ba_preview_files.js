'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class BaPreviewFilesSchema extends Schema {
  up () {
    this.create('ba_preview_files', (table) => {
      table.increments()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('template', 100).notNullable()
      table.string('filename', 191).notNullable()
      table.string('saved_path', 500).notNullable()
      table.string('preview_url', 500).nullable()
      table.datetime('expires_at').notNullable()
      table.string('status', 32).notNullable().defaultTo('active')
      table.datetime('deleted_at').nullable()
      table.timestamps()

      table.index(['company_id'])
      table.index(['user_id'])
      table.index(['template'])
      table.index(['expires_at'])
      table.index(['status'])
      table.index(['company_id', 'expires_at'])
    })
  }

  down () {
    this.drop('ba_preview_files')
  }
}

module.exports = BaPreviewFilesSchema
