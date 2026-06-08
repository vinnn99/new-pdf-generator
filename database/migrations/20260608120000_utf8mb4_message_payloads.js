'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')
const Config = use('Config')

class Utf8mb4MessagePayloadsSchema extends Schema {
  up () {
    if (!isMysql()) return

    this.raw(`ALTER TABLE jobs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    this.raw(`ALTER TABLE jobs MODIFY payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`)
    this.raw(`ALTER TABLE email_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    this.raw(`ALTER TABLE generated_pdfs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  }

  down () {
    // Charset downgrade is intentionally omitted to avoid corrupting existing 4-byte text.
  }
}

function isMysql () {
  return String(Config.get('database.connection') || '').toLowerCase() === 'mysql'
}

module.exports = Utf8mb4MessagePayloadsSchema
