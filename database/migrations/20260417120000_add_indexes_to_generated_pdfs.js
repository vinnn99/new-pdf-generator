'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddIndexesToGeneratedPdfsSchema extends Schema {
  up () {
    this.table('generated_pdfs', (table) => {
      table.index(['created_at', 'id'], 'generated_pdfs_created_at_id_idx')
      table.index(['company_id', 'created_at', 'id'], 'generated_pdfs_company_created_at_id_idx')
      table.index(['user_id', 'created_at', 'id'], 'generated_pdfs_user_created_at_id_idx')
    })
  }

  down () {
    this.table('generated_pdfs', (table) => {
      table.dropIndex(['created_at', 'id'], 'generated_pdfs_created_at_id_idx')
      table.dropIndex(['company_id', 'created_at', 'id'], 'generated_pdfs_company_created_at_id_idx')
      table.dropIndex(['user_id', 'created_at', 'id'], 'generated_pdfs_user_created_at_id_idx')
    })
  }
}

module.exports = AddIndexesToGeneratedPdfsSchema
