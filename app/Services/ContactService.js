'use strict'

const Database = use('Database')

class ContactService {
  static normalizeEmail(value) {
    if (value === undefined || value === null) return ''
    return String(value).trim().toLowerCase()
  }

  static isValidEmail(value) {
    const email = this.normalizeEmail(value)
    if (!email) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  static sourceFromContext(context) {
    const ctx = String(context || '').toLowerCase()
    if (ctx.startsWith('bulk')) return 'auto-bulk'
    return 'auto-single'
  }

  static extractEmails(inputs) {
    const bucket = []

    const pushValue = (value) => {
      if (value === undefined || value === null) return
      if (Array.isArray(value)) {
        value.forEach(pushValue)
        return
      }

      const raw = String(value)
      raw
        .split(/[;,]/g)
        .map((part) => this.normalizeEmail(part))
        .filter(Boolean)
        .forEach((part) => bucket.push(part))
    }

    pushValue(inputs)
    return [...new Set(bucket)]
  }

  static async upsertFromSend({ userId, companyId = null, to, cc = [], bcc = [], source = 'auto-single', sentAt = new Date() }) {
    const ownerId = Number(userId)
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      return { upserted: 0, skipped: 0 }
    }

    const recipients = this.extractEmails([to, cc, bcc])
    let upserted = 0
    let skipped = 0

    for (const recipient of recipients) {
      const email = this.normalizeEmail(recipient)
      if (!this.isValidEmail(email)) {
        skipped += 1
        continue
      }

      const existing = await Database.table('contacts')
        .where('user_id', ownerId)
        .where('email', email)
        .first()

      if (existing) {
        await Database.table('contacts')
          .where('id', existing.id)
          .update({
            company_id: existing.company_id || companyId || null,
            source: source || existing.source || 'auto-single',
            last_sent_at: sentAt,
            send_count: Number(existing.send_count || 0) + 1,
            updated_at: new Date()
          })
      } else {
        await Database.table('contacts').insert({
          user_id: ownerId,
          company_id: companyId || null,
          email,
          name: null,
          phone: null,
          notes: null,
          source: source || 'auto-single',
          last_sent_at: sentAt,
          send_count: 1,
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      upserted += 1
    }

    return { upserted, skipped }
  }
}

module.exports = ContactService
