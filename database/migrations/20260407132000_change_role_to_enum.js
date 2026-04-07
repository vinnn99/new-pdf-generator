'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class ChangeRoleToEnumSchema extends Schema {
  up () {
    this.table('users', (table) => {
      table.enu('role', ['user', 'admin']).notNullable().defaultTo('user').alter()
    })
  }

  down () {
    this.table('users', (table) => {
      table.string('role', 20).notNullable().defaultTo('user').alter()
    })
  }
}

module.exports = ChangeRoleToEnumSchema
