'use strict'

const nodemailer = require('nodemailer')
const fs = require('fs')
const path = require('path')
const Helpers = use('Helpers')
const ContactService = use('App/Services/ContactService')
const EmailLogService = use('App/Services/EmailLogService')

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
      userId = null, companyId = null, template = null, context = null, emailLogId = null
    } = data

    ensureLogDir()
    const sentAt = new Date()
    let sendError = null

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
      await persistEmailLogSafe({
        id: emailLogId,
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
      sendError = err
      appendLog({ status: 'failed', to, error: err.message, employeeId, employeeName })
      await persistEmailLogSafe({
        id: emailLogId,
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
    } finally {
      await upsertContactsFromSend({
        userId,
        companyId,
        to,
        cc,
        bcc,
        context,
        sentAt
      })
    }

    if (sendError) {
      throw sendError
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

async function persistEmailLogSafe(entry) {
  try {
    await EmailLogService.finalize(entry)
  } catch (e) {
    console.error('Failed to log email:', e.message)
  }
}

async function upsertContactsFromSend(entry) {
  try {
    await ContactService.upsertFromSend({
      userId: entry.userId,
      companyId: entry.companyId,
      to: entry.to,
      cc: entry.cc,
      bcc: entry.bcc,
      source: ContactService.sourceFromContext(entry.context),
      sentAt: entry.sentAt || new Date()
    })
  } catch (e) {
    console.error('Failed to upsert contacts:', e.message)
  }
}

module.exports = SendEmailJob
