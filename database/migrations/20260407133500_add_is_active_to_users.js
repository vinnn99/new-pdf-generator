'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class AddIsActiveToUsersSchema extends Schema {
  up () {
    this.table('users', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true).index()
    })
  }

  down () {
    this.table('users', (table) => {
      table.dropColumn('is_active')
    })
  }
}

module.exports = AddIsActiveToUsersSchema
