'use strict'

const path = require('path')
const Database = use('Database')

class EmailLogService {
  static async createQueued(entry = {}) {
    return this._createWithStatus(entry, entry.status || 'queued', entry.error || null)
  }

  static async createSkipped(entry = {}) {
    return this._createWithStatus(entry, 'skipped', entry.error || 'Skipped before enqueue')
  }

  static async createFailed(entry = {}) {
    return this._createWithStatus(entry, 'failed', entry.error || 'Failed before enqueue')
  }

  static async _createWithStatus(entry = {}, status, error) {
    const payload = this._buildPayload({
      ...entry,
      status,
      error
    })
    const now = new Date()
    const inserted = await this._withRetry(() => Database.table('email_logs').insert({
      ...payload,
      created_at: now,
      updated_at: now
    }))
    return Array.isArray(inserted) ? inserted[0] : inserted
  }

  static async markDispatchFailed({ id, error } = {}) {
    if (!id) return
    await this._withRetry(() => Database.table('email_logs')
      .where('id', id)
      .update({
        status: 'failed',
        error: error || 'Job dispatch failed',
        updated_at: new Date()
      }))
  }

  static async finalize(entry = {}) {
    const id = entry.id || entry.emailLogId || null
    const payload = this._buildPayload(entry)

    if (id) {
      const updated = await this._withRetry(() => Database.table('email_logs')
        .where('id', id)
        .update({
          ...payload,
          updated_at: new Date()
        }))

      if (Number(updated || 0) > 0) return id
    }

    const now = new Date()
    const inserted = await this._withRetry(() => Database.table('email_logs').insert({
      ...payload,
      created_at: now,
      updated_at: now
    }))
    return Array.isArray(inserted) ? inserted[0] : inserted
  }

  static _buildPayload(entry = {}) {
    const attachments = this._attachmentNames(entry.attachments || [])

    return {
      user_id: entry.userId || null,
      company_id: entry.companyId || null,
      template: entry.template || null,
      context: entry.context || null,
      to_email: String(entry.to || '').trim(),
      cc: this._toJsonArray(entry.cc),
      bcc: this._toJsonArray(entry.bcc),
      subject: entry.subject || null,
      body: entry.body || entry.text || null,
      attachments: JSON.stringify(attachments),
      status: entry.status || 'sent',
      error: entry.error || null
    }
  }

  static _toJsonArray(value) {
    if (!value) return '[]'
    if (Array.isArray(value)) return JSON.stringify(value)
    return JSON.stringify([value])
  }

  static _attachmentNames(list = []) {
    return list
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') return item
        if (item.filename) return item.filename
        if (item.path) return path.basename(item.path)
        return String(item)
      })
      .filter(Boolean)
  }

  static async _withRetry(fn, attempts = 3) {
    let lastError = null

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (i < attempts - 1) {
          await sleep(80 * (i + 1))
        }
      }
    }

    throw lastError
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = EmailLogService
