'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class ContactsSchema extends Schema {
  up () {
    this.create('contacts', (table) => {
      table.increments()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('company_id').unsigned().nullable().references('company_id').inTable('companies').onDelete('SET NULL')
      table.string('email', 254).notNullable()
      table.string('name', 191).nullable()
      table.string('phone', 50).nullable()
      table.text('notes').nullable()
      table.string('source', 50).notNullable().defaultTo('manual')
      table.datetime('last_sent_at').nullable()
      table.integer('send_count').notNullable().defaultTo(0)
      table.timestamps()

      table.unique(['user_id', 'email'])
      table.index(['company_id'])
      table.index(['user_id'])
      table.index(['email'])
      table.index(['last_sent_at'])
    })
  }

  down () {
    this.drop('contacts')
  }
}

module.exports = ContactsSchema
