'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class ExtendRoleEnumSuperadminSchema extends Schema {
  up () {
    this.raw(`ALTER TABLE users MODIFY role ENUM('user','admin','superadmin') NOT NULL DEFAULT 'user'`)
  }

  down () {
    this.raw(`ALTER TABLE users MODIFY role ENUM('user','admin') NOT NULL DEFAULT 'user'`)
  }
}

module.exports = ExtendRoleEnumSuperadminSchema
