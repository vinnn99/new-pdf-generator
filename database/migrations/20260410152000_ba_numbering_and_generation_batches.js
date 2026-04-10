'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class BaNumberingAndGenerationBatchesSchema extends Schema {
  up () {
    this.create('company_ba_numbering_settings', (table) => {
      table.increments()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('format_pattern', 255).notNullable().defaultTo('{seq:04}/{templateCode}/{romanMonth}/{year}')
      table.string('timezone', 64).notNullable().defaultTo('Asia/Jakarta')
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamps()

      table.unique(['company_id'])
    })

    this.create('company_ba_numbering_counters', (table) => {
      table.increments()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('template', 100).notNullable()
      table.integer('last_seq').notNullable().defaultTo(0)
      table.timestamps()

      table.unique(['company_id', 'template'])
      table.index(['company_id'])
      table.index(['template'])
    })

    this.create('generation_batches', (table) => {
      table.increments()
      table.string('batch_id', 64).notNullable().unique()
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('template', 100).notNullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('total_rows').notNullable().defaultTo(0)
      table.integer('queued').notNullable().defaultTo(0)
      table.integer('failed').notNullable().defaultTo(0)
      table.string('status', 50).notNullable().defaultTo('created')
      table.timestamps()

      table.index(['company_id'])
      table.index(['template'])
      table.index(['created_by'])
    })

    this.create('generation_batch_items', (table) => {
      table.increments()
      table.string('batch_id', 64).notNullable()
      table.foreign('batch_id').references('batch_id').inTable('generation_batches').onDelete('CASCADE')
      table.integer('company_id').unsigned().notNullable().references('company_id').inTable('companies').onDelete('CASCADE')
      table.string('template', 100).notNullable()
      table.integer('row_no').notNullable()
      table.string('match_key', 255).nullable()
      table.string('letter_no', 191).nullable()
      table.string('filename', 191).nullable()
      table.string('saved_path', 500).nullable()
      table.integer('generated_pdf_id').unsigned().nullable().references('id').inTable('generated_pdfs').onDelete('SET NULL')
      table.string('status', 50).notNullable().defaultTo('queued')
      table.text('error').nullable()
      table.text('row_data').nullable()
      table.timestamps()

      table.index(['batch_id'])
      table.index(['company_id'])
      table.index(['template'])
      table.index(['match_key'])
      table.index(['status'])
    })
  }

  down () {
    this.drop('generation_batch_items')
    this.drop('generation_batches')
    this.drop('company_ba_numbering_counters')
    this.drop('company_ba_numbering_settings')
  }
}

module.exports = BaNumberingAndGenerationBatchesSchema
