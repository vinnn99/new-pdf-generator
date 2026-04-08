'use strict'

const nodemailer = require('nodemailer')
const fs = require('fs')
const path = require('path')
const Helpers = use('Helpers')
const Database = use('Database')

const LOG_DIR = path.join(Helpers.appRoot(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'bulk-email.log')

class SendEmailJob {
  static get key () {
    return 'SendEmailJob'
  }

  async handle (data) {
    const {
      smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
      to, cc = [], bcc = [], subject, text, attachments = [],
      employeeId = '', employeeName = '',
      userId = null, companyId = null, template = null, context = null
    } = data

    ensureLogDir()

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      })

      const validAttachments = attachments.filter((a) => a && a.path && fs.existsSync(a.path))

      await transporter.sendMail({
        from: mailFrom || smtpUser,
        to,
        cc,
        bcc,
        subject,
        text,
        attachments: validAttachments
      })

      appendLog({ status: 'sent', to, attachments: validAttachments.map(a => a.filename), employeeId, employeeName })
      await logEmail({
        status: 'sent',
        to,
        cc,
        bcc,
        subject,
        body: text,
        attachments: validAttachments,
        userId,
        companyId,
        template,
        context,
        error: null
      })
    } catch (err) {
      appendLog({ status: 'failed', to, error: err.message, employeeId, employeeName })
      await logEmail({
        status: 'failed',
        to,
        cc,
        bcc,
        subject,
        body: text,
        attachments,
        userId,
        companyId,
        template,
        context,
        error: err.message
      })
      throw err
    }
  }
}

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch (e) {
    console.error('Failed to create log dir:', e.message)
  }
}

function appendLog(entry) {
  try {
    const ts = new Date().toISOString()
    const line = JSON.stringify({ ts, ...entry }) + '\n'
    fs.appendFileSync(LOG_FILE, line)
  } catch (e) {
    console.error('Failed to write log:', e.message)
  }
}

async function logEmail(entry) {
  try {
    const now = new Date()
    const toStringArray = (arr) => {
      if (!arr) return '[]'
      if (Array.isArray(arr)) return JSON.stringify(arr)
      return JSON.stringify([arr])
    }
    const attachments = (entry.attachments || []).map((a) => {
      if (!a) return null
      if (a.filename) return a.filename
      if (a.path) return path.basename(a.path)
      return String(a)
    }).filter(Boolean)

    await Database.table('email_logs').insert({
      user_id: entry.userId || null,
      company_id: entry.companyId || null,
      template: entry.template || null,
      context: entry.context || null,
      to_email: entry.to,
      cc: toStringArray(entry.cc),
      bcc: toStringArray(entry.bcc),
      subject: entry.subject || null,
      body: entry.body || null,
      attachments: JSON.stringify(attachments),
      status: entry.status || 'sent',
      error: entry.error || null,
      created_at: now,
      updated_at: now
    })
  } catch (e) {
    console.error('Failed to log email:', e.message)
  }
}

module.exports = SendEmailJob
