'use strict'

const Env = use('Env')
const Helpers = use('Helpers')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const JobService = require('../../Services/JobService')
const Database = use('Database')

const LOG_DIR = path.join(Helpers.appRoot(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'bulk-email.log')

class BulkEmailController {
  /**
   * POST /api/v1/send-slip-emails
   * Multipart form-data:
   *   - file: .xlsx file with columns (case-insensitive):
   *       sentTo (wajib) | employeeId | employeeName | slipTitle | body | cc | bcc
   *   - periode (opsional): contoh "2026-03"; hanya file lampiran yang nama filenya berawalan nilai ini yang akan dipakai.
   *   Attachments dicari di:
   *     public/download/{companyName}/{email_user_company}/
   *   (setiap email milik perusahaan akan dipakai sebagai subfolder lampiran)
   *   File dipilih jika nama file mengandung employeeId (case-insensitive).
   */
  async sendSlips({ request, response, auth }) {
    try {
      const user = await auth.getUser()
      if (!user || !user.company_id) {
        return response.status(401).json({ status: 'error', message: 'User belum terhubung ke perusahaan' })
      }
      const company = await Database.table('companies').where('company_id', user.company_id).first()
      if (!company) {
        return response.status(401).json({ status: 'error', message: 'Perusahaan user tidak ditemukan' })
      }
      const companyUsers = await Database.table('users')
        .where('company_id', company.company_id)
        .select('email')

      const smtpHost = Env.get('SMTP_HOST')
      const smtpPort = Env.get('SMTP_PORT')
      const smtpUser = Env.get('SMTP_USER')
      const smtpPass = Env.get('SMTP_PASS')
      const smtpSecure = Env.get('SMTP_SECURE', 'false') === 'true'
      const mailFrom = Env.get('MAIL_FROM') || smtpUser

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({
          status: 'error',
          message: 'Konfigurasi SMTP tidak lengkap di .env'
        })
      }

      const upload = request.file('file', {
        extnames: ['xls', 'xlsx'],
        size: '5mb'
      })

      if (!upload) {
        return response.status(422).json({ status: 'error', message: 'File .xlsx wajib diunggah (field name: file)' })
      }

      const tmpPath = path.join(Helpers.tmpPath(), `${Date.now()}-${upload.clientName}`)
      await upload.move(path.dirname(tmpPath), { name: path.basename(tmpPath) })

      const workbook = XLSX.readFile(tmpPath)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const periodPrefix = (request.input('periode') || request.input('period') || '').toString().trim().toLowerCase()

      ensureLogDir()

      const baseRoot = path.join(Helpers.publicPath(), 'download', sanitize(company.name))
      const bases = companyUsers
        .map((u) => (u.email || '').trim())
        .filter(Boolean)
        .map((email) => ({ dir: path.join(baseRoot, sanitize(email)) }))

      const results = []
      let queuedCount = 0
      let failedCount = 0
      let skippedCount = 0
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const norm = normalizeRow(row)
        const to = norm.sentto || norm.email
        const employeeId = (norm.employeeid || '').toString().trim()
        const employeeName = norm.employeename || ''
        const companyName = norm.companyname || ''
        const slipTitle = norm.sliptitle || 'Slip Gaji'
        const body =
          norm.body ||
          [
            `Yth. ${employeeName || employeeId},`,
            '',
            `Terlampir slip ${slipTitle.toLowerCase()} Anda. Mohon periksa detailnya; jika ada pertanyaan, silakan hubungi HR/Payroll.`,
            '',
            companyName ? `${companyName} • Departemen HR/Payroll` : 'Departemen HR/Payroll',
            '',
            'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
          ].join('\n')
        const cc = norm.cc ? norm.cc.split(';').map(s => s.trim()).filter(Boolean) : []
        const bcc = norm.bcc ? norm.bcc.split(';').map(s => s.trim()).filter(Boolean) : []

        if (!to) {
          results.push({ row: i + 1, status: 'skipped', message: 'sentTo/email kosong' })
          appendLog({ row: i + 1, status: 'skipped', reason: 'no_recipient', employeeId, employeeName })
          skippedCount++
          continue
        }
        if (!employeeId) {
          results.push({ row: i + 1, status: 'failed', message: 'employeeId kosong' })
          failedCount++
          continue
        }

        const normalizeName = (str) => (str || '').toString()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_-]/gi, '')
          .toLowerCase()

        const attachments = []
        for (const base of bases) {
          const dir = base.dir
          if (!fs.existsSync(dir)) continue
          const files = fs.readdirSync(dir)
          const targetId = employeeId.toLowerCase()
          const targetName = normalizeName(employeeName)
          const match = files.find((f) => {
            const lower = f.toLowerCase()
            const periodOk = !periodPrefix || lower.startsWith(periodPrefix)
            const hasId = lower.includes(targetId)
            const hasName = targetName ? lower.includes(targetName) : true
            return periodOk && hasId && hasName
          })
          if (match) {
            attachments.push({
              filename: match,
              path: path.join(dir, match)
            })
          }
        }

        // Batasi 3 lampiran max
        const limitedAttachments = attachments.slice(0, 3)

        if (limitedAttachments.length === 0) {
          results.push({ row: i + 1, status: 'skipped', to, message: 'Lampiran tidak ditemukan untuk employeeId/name' })
          appendLog({ row: i + 1, to, status: 'skipped', reason: 'no_attachments', employeeId, employeeName })
          skippedCount++
          continue
        }

        try {
          await JobService.dispatch('App/Jobs/SendEmailJob', {
            smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
            to, cc, bcc, subject: slipTitle, text: body,
            attachments: limitedAttachments,
            employeeId, employeeName
          }, { attempts: 3, timeout: 120000 })
          const attachNames = limitedAttachments.map(a => a.filename)
          results.push({ row: i + 1, status: 'queued', to, attachments: attachNames })
          appendLog({ row: i + 1, to, status: 'queued', attachments: attachNames, employeeId, employeeName })
          queuedCount++
        } catch (err) {
          results.push({ row: i + 1, status: 'failed', to, message: err.message })
          appendLog({ row: i + 1, to, status: 'failed', error: err.message, employeeId, employeeName })
          failedCount++
        }
      }

      try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }

      const sent = queuedCount
      const failed = failedCount
      const skipped = skippedCount
      return response.json({
        status: 'ok',
        total: results.length,
        queued: sent,
        failed,
        skipped,
        results
      })
    } catch (error) {
      console.error('BulkEmail error:', error.message)
      appendLog({ status: 'fatal', error: error.message })
      return response.status(500).json({
        status: 'error',
        message: 'Gagal memproses permintaan',
        error: error.message
      })
    }
  }

  /**
   * POST /api/v1/send-ba-penempatan-emails
   * Multipart form-data:
   *   - file: .xlsx dengan kolom (case-insensitive):
   *       sentTo (wajib) | mdsName (wajib) | outlet (wajib) | letterNo (wajib) | subject | body | cc | bcc
   *   Lampiran dicari di:
   *     public/download/{companyName}/{email_user_company}/
   *   dengan pola nama file:
   *     ba-penempatan.[mdsName].[outlet].[letterNo].[unique].pdf
   *   (karakter "/" di letterNo otomatis diganti "-"; spasi jadi "_"; karakter ilegal jadi "_")
   */
  async sendBaPenempatan({ request, response, auth }) {
    try {
      const user = await auth.getUser()
      if (!user || !user.company_id) {
        return response.status(401).json({ status: 'error', message: 'User belum terhubung ke perusahaan' })
      }
      const company = await Database.table('companies').where('company_id', user.company_id).first()
      if (!company) {
        return response.status(401).json({ status: 'error', message: 'Perusahaan user tidak ditemukan' })
      }
      const companyUsers = await Database.table('users')
        .where('company_id', company.company_id)
        .select('email')

      const smtpHost = Env.get('SMTP_HOST')
      const smtpPort = Env.get('SMTP_PORT')
      const smtpUser = Env.get('SMTP_USER')
      const smtpPass = Env.get('SMTP_PASS')
      const smtpSecure = Env.get('SMTP_SECURE', 'false') === 'true'
      const mailFrom = Env.get('MAIL_FROM') || smtpUser

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({
          status: 'error',
          message: 'Konfigurasi SMTP tidak lengkap di .env'
        })
      }

      const upload = request.file('file', {
        extnames: ['xls', 'xlsx'],
        size: '5mb'
      })

      if (!upload) {
        return response.status(422).json({ status: 'error', message: 'File .xlsx wajib diunggah (field name: file)' })
      }

      const tmpPath = path.join(Helpers.tmpPath(), `${Date.now()}-${upload.clientName}`)
      await upload.move(path.dirname(tmpPath), { name: path.basename(tmpPath) })

      const workbook = XLSX.readFile(tmpPath)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      ensureLogDir()

      const baseRoot = path.join(Helpers.publicPath(), 'download', sanitize(company.name))
      const bases = companyUsers
        .map((u) => (u.email || '').trim())
        .filter(Boolean)
        .map((email) => ({ dir: path.join(baseRoot, sanitize(email)) }))

      const results = []
      let queuedCount = 0
      let failedCount = 0
      let skippedCount = 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const norm = normalizeRow(row)
        const to = norm.sentto || norm.email
        const mdsName = norm.mdsname || norm.nama || ''
        const outlet = norm.outlet || ''
        const letterNo = norm.letterno || norm.letter_no || ''
        const subject = norm.subject || `Berita Acara Penempatan - ${mdsName || outlet || letterNo}`
        const body =
          norm.body ||
          [
            `Yth. ${mdsName || 'Bapak/Ibu'},`,
            '',
            'Berikut terlampir Berita Acara Penempatan MDS.',
            outlet ? `Outlet: ${outlet}` : null,
            letterNo ? `Nomor Surat: ${letterNo}` : null,
            '',
            company.name ? `${company.name}` : '',
            'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
          ].filter(Boolean).join('\n')
        const cc = norm.cc ? norm.cc.split(';').map(s => s.trim()).filter(Boolean) : []
        const bcc = norm.bcc ? norm.bcc.split(';').map(s => s.trim()).filter(Boolean) : []

        if (!to) {
          results.push({ row: i + 1, status: 'skipped', message: 'sentTo/email kosong' })
          appendLog({ row: i + 1, status: 'skipped', reason: 'no_recipient', mdsName, outlet, letterNo })
          skippedCount++
          continue
        }
        if (!mdsName || !outlet || !letterNo) {
          results.push({ row: i + 1, status: 'failed', to, message: 'mdsName/outlet/letterNo wajib' })
          failedCount++
          continue
        }

        const safeName = (str) => (str || '').toString()
          .replace(/\//g, '-')
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
          .replace(/\s+/g, '_')

        const expectedPrefix = `ba-penempatan.${safeName(mdsName)}.${safeName(outlet)}.${safeName(letterNo)}.`
        const expectedPrefixLower = expectedPrefix.toLowerCase()

        const attachments = []
        for (const base of bases) {
          const dir = base.dir
          if (!fs.existsSync(dir)) continue
          const files = fs.readdirSync(dir)
          const match = files.find((f) => {
            const lower = f.toLowerCase()
            return lower.startsWith(expectedPrefixLower) && lower.endsWith('.pdf')
          })
          if (match) {
            attachments.push({
              filename: match,
              path: path.join(dir, match)
            })
          }
        }

        if (attachments.length === 0) {
          results.push({ row: i + 1, status: 'skipped', to, message: 'Lampiran ba-penempatan tidak ditemukan' })
          appendLog({ row: i + 1, to, status: 'skipped', reason: 'no_attachments', mdsName, outlet, letterNo })
          skippedCount++
          continue
        }

        const firstAttachment = attachments[0] // hanya satu lampiran per email

        try {
          await JobService.dispatch('App/Jobs/SendEmailJob', {
            smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
            to, cc, bcc, subject, text: body,
            attachments: [firstAttachment],
            employeeName: mdsName
          }, { attempts: 3, timeout: 120000 })
          results.push({ row: i + 1, status: 'queued', to, attachment: firstAttachment.filename })
          appendLog({ row: i + 1, to, status: 'queued', attachment: firstAttachment.filename, mdsName, outlet, letterNo })
          queuedCount++
        } catch (err) {
          results.push({ row: i + 1, status: 'failed', to, message: err.message })
          appendLog({ row: i + 1, to, status: 'failed', error: err.message, mdsName, outlet, letterNo })
          failedCount++
        }
      }

      try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }

      return response.json({
        status: 'ok',
        total: results.length,
        queued: queuedCount,
        failed: failedCount,
        skipped: skippedCount,
        results
      })
    } catch (error) {
      console.error('BulkEmail ba-penempatan error:', error.message)
      appendLog({ status: 'fatal', error: error.message })
      return response.status(500).json({
        status: 'error',
        message: 'Gagal memproses permintaan',
        error: error.message
      })
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

function normalizeRow(row) {
  return Object.keys(row || {}).reduce((acc, key) => {
    const normKey = key ? key.toString().trim().toLowerCase() : ''
    acc[normKey] = row[key]
    return acc
  }, {})
}

function sanitize(str) {
  return (str || 'unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

module.exports = BulkEmailController
