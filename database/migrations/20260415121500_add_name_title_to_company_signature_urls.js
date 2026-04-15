'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddNameTitleToCompanySignatureUrlsSchema extends Schema {
  up () {
    this.table('company_signature_urls', (table) => {
      table.string('name', 191).nullable().after('url_normalized')
      table.string('title', 191).nullable().after('name')
    })
  }

  down () {
    this.table('company_signature_urls', (table) => {
      table.dropColumn('title')
      table.dropColumn('name')
    })
  }
}

module.exports = AddNameTitleToCompanySignatureUrlsSchema
