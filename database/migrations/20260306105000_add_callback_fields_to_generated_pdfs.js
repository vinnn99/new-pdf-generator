'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddCallbackFieldsToGeneratedPdfsSchema extends Schema {
  up () {
    this.table('generated_pdfs', (table) => {
      table.integer('callback_status').nullable()
      table.text('callback_response').nullable()
      table.text('callback_error').nullable()
    })
  }

  down () {
    this.table('generated_pdfs', (table) => {
      table.dropColumn('callback_status')
      table.dropColumn('callback_response')
      table.dropColumn('callback_error')
    })
  }
}

module.exports = AddCallbackFieldsToGeneratedPdfsSchema
