'use strict'

const nodemailer = require('nodemailer')
const fs = require('fs')
const path = require('path')
const Helpers = use('Helpers')

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
      employeeId = '', employeeName = ''
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
    } catch (err) {
      appendLog({ status: 'failed', to, error: err.message, employeeId, employeeName })
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

module.exports = SendEmailJob
