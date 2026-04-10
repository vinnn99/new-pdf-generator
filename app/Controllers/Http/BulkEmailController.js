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
   *       sentTo (wajib) | employeeId | employeeName | slipTitle | template (opsional) | body | cc | bcc
   *   - periode (opsional): contoh "2026-03"; filter berdasarkan segmen periode di nama file.
   *   Attachments dicari di:
   *     public/download/{companyName}/{email_login_user}/
   *   (hanya folder email user yang sedang login yang dipakai)
   *   Format nama file yang dipakai:
   *     [periode].[template].[employeeId].[nama].[kodeUnique].pdf
   *   Jika kandidat > 1 (mis. beda kodeUnique), sistem memilih file terbaru.
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
      const periodPrefix = normalizePeriodPrefix(request.input('periode') || request.input('period'))
      const templateFromRequest = normalizeSlipTemplate(
        request.input('template') ||
        request.input('slipTemplate') ||
        request.input('slip_template')
      )

      ensureLogDir()

      const baseRoot = path.join(Helpers.publicPath(), 'download', sanitize(company.name))
      const loginEmail = (user.email || '').trim()
      if (!loginEmail) {
        return response.status(401).json({ status: 'error', message: 'Email user login kosong' })
      }
      const bases = [{ dir: path.join(baseRoot, sanitize(loginEmail)) }]

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
        const slipTemplate = resolveSlipTemplate(norm, templateFromRequest, slipTitle)
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

        const candidates = findSlipAttachmentCandidates({
          bases,
          periodPrefix,
          slipTemplate,
          employeeId,
          employeeName
        })
        const selectedAttachment = pickNewestAttachment(candidates)
        const selectedAttachments = selectedAttachment
          ? [{ filename: selectedAttachment.filename, path: selectedAttachment.path }]
          : []

        if (selectedAttachments.length === 0) {
          results.push({ row: i + 1, status: 'skipped', to, message: 'Lampiran tidak ditemukan untuk employeeId/name' })
          appendLog({
            row: i + 1,
            to,
            status: 'skipped',
            reason: 'no_attachments',
            employeeId,
            employeeName,
            slipTemplate
          })
          skippedCount++
          continue
        }

        try {
          await JobService.dispatch('App/Jobs/SendEmailJob', {
            smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
            to, cc, bcc, subject: slipTitle, text: body,
            attachments: selectedAttachments,
            employeeId, employeeName,
            userId: user.id,
            companyId: company.company_id,
            template: 'payslip-email',
            context: 'bulk-slip'
          }, { attempts: 3, timeout: 120000 })
          const attachNames = selectedAttachments.map(a => a.filename)
          results.push({ row: i + 1, status: 'queued', to, attachments: attachNames })
          appendLog({
            row: i + 1,
            to,
            status: 'queued',
            attachments: attachNames,
            employeeId,
            employeeName,
            slipTemplate,
            candidates: candidates.length
          })
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

      const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom } = pickSmtpConfig(company)
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({
          status: 'error',
          message: 'Konfigurasi SMTP belum lengkap di perusahaan atau .env'
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
            employeeName: mdsName,
            userId: user.id,
            companyId: company.company_id,
            template: 'ba-penempatan',
            context: 'bulk-ba'
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

  /**
   * Generic sender for BA templates with filename prefix matching.
   * cfg: {
   *   template: 'ba-request-id',
   *   required: ['mdsName', 'area', 'letterNo'],
   *   prefixParts: (fields) => ['ba-request-id', fields.mdsName, fields.area, fields.letterNo],
   *   subject: (fields) => string,
   *   body: (fields, company) => string
   * }
   */
  async _sendBaTemplate({ request, response, auth }, cfg) {
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

      const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom } = pickSmtpConfig(company)
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({
          status: 'error',
          message: 'Konfigurasi SMTP belum lengkap di perusahaan atau .env'
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

      const pick = (norm, keys) => {
        for (const k of keys) {
          if (norm[k] !== undefined && norm[k] !== null && norm[k] !== '') return norm[k]
        }
        return ''
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const norm = normalizeRow(row)
        const to = norm.sentto || norm.email

        const fields = {
          mdsName: pick(norm, ['mdsname', 'mds name', 'nama', 'nama mds']),
          outlet: pick(norm, ['outlet', 'outlet penempatan', 'toko']),
          letterNo: pick(norm, ['letterno', 'letter no', 'letter_no', 'no surat', 'letter number']),
          area: pick(norm, ['area', 'wilayah', 'region']),
          region: pick(norm, ['region', 'wilayah']),
          outletFrom: pick(norm, ['outletfrom', 'outlet from', 'outlet sebelumnya']),
          outletTo: pick(norm, ['outletto', 'outlet to', 'outlet penempatan']),
        }

        // Required check
        const missing = (cfg.required || []).filter((k) => !fields[k])
        if (!to) {
          results.push({ row: i + 1, status: 'skipped', message: 'sentTo/email kosong' })
          skippedCount++
          continue
        }
        if (missing.length) {
          results.push({ row: i + 1, status: 'failed', to, message: `Field wajib kosong: ${missing.join(', ')}` })
          failedCount++
          continue
        }

        const expectedPrefix = cfg.prefixParts(fields).map(safeName).join('.')
        const expectedPrefixLower = `${expectedPrefix}.`.toLowerCase()

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
          results.push({ row: i + 1, status: 'skipped', to, message: `Lampiran ${cfg.template} tidak ditemukan` })
          skippedCount++
          continue
        }

        const subject = norm.subject || cfg.subject(fields, company)
        const body = norm.body || cfg.body(fields, company)
        const cc = norm.cc ? norm.cc.split(';').map(s => s.trim()).filter(Boolean) : []
        const bcc = norm.bcc ? norm.bcc.split(';').map(s => s.trim()).filter(Boolean) : []
        const firstAttachment = attachments[0]

        try {
          await JobService.dispatch('App/Jobs/SendEmailJob', {
            smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
            to, cc, bcc, subject, text: body,
            attachments: [firstAttachment],
            employeeName: fields.mdsName,
            userId: user.id,
            companyId: company.company_id,
            template: cfg.template,
            context: 'bulk-ba'
          }, { attempts: 3, timeout: 120000 })
          results.push({ row: i + 1, status: 'queued', to, attachment: firstAttachment.filename })
          queuedCount++
        } catch (err) {
          results.push({ row: i + 1, status: 'failed', to, message: err.message })
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
      console.error(`BulkEmail ${cfg.template} error:`, error.message)
      appendLog({ status: 'fatal', template: cfg.template, error: error.message })
      return response.status(500).json({
        status: 'error',
        message: 'Gagal memproses permintaan',
        error: error.message
      })
    }
  }

  async sendBaRequestId({ request, response, auth }) {
    const cfg = {
      template: 'ba-request-id',
      required: ['mdsName', 'area', 'letterNo'],
      prefixParts: (f) => ['ba-request-id', f.mdsName, f.area, f.letterNo],
      subject: (f) => `Berita Acara Request ID - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Request ID MDS.',
        f.area ? `Area: ${f.area}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  async sendBaHold({ request, response, auth }) {
    const cfg = {
      template: 'ba-hold',
      required: ['mdsName', 'region', 'letterNo'],
      prefixParts: (f) => ['ba-hold', f.mdsName, f.region, f.letterNo],
      subject: (f) => `Berita Acara HOLD - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara HOLD MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  async sendBaRolling({ request, response, auth }) {
    const cfg = {
      template: 'ba-rolling',
      required: ['mdsName', 'region', 'letterNo'],
      prefixParts: (f) => ['ba-rolling', f.mdsName, f.region, f.letterNo],
      subject: (f) => `Berita Acara Rolling - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Rolling MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  async sendBaHoldActivate({ request, response, auth }) {
    const cfg = {
      template: 'ba-hold-activate',
      required: ['mdsName', 'region', 'letterNo'],
      prefixParts: (f) => ['ba-hold-activate', f.mdsName, f.region, f.letterNo],
      subject: (f) => `Berita Acara HOLD Aktif - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara HOLD Aktif Kembali.',
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  async sendBaTakeout({ request, response, auth }) {
    const cfg = {
      template: 'ba-takeout',
      required: ['mdsName', 'region', 'letterNo'],
      prefixParts: (f) => ['ba-takeout', f.mdsName, f.region, f.letterNo],
      subject: (f) => `Berita Acara Takeout - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Toko Takeout MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  async sendBaTerminated({ request, response, auth }) {
    const cfg = {
      template: 'ba-terminated',
      required: ['mdsName', 'region', 'letterNo'],
      prefixParts: (f) => ['ba-terminated', f.mdsName, f.region, f.letterNo],
      subject: (f) => `Berita Acara Terminasi - ${f.mdsName || f.letterNo || ''}`,
      body: (f, company) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Terminasi MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }
}

function findSlipAttachmentCandidates({ bases, periodPrefix, slipTemplate, employeeId, employeeName }) {
  const targetId = normalizeSlipSegment(employeeId).toLowerCase()
  if (!targetId) return []

  const targetName = normalizeSlipSegment(employeeName).toLowerCase()
  const candidates = []

  for (const base of bases) {
    const dir = base.dir
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir)
    for (const filename of files) {
      const parsed = parseSlipAttachmentFilename(filename)
      if (!parsed) continue

      const periodOk = !periodPrefix || parsed.period.startsWith(periodPrefix)
      const templateOk = !slipTemplate || parsed.template === slipTemplate
      const idOk = parsed.employeeId === targetId
      const nameOk = !targetName || parsed.employeeName === targetName
      if (!periodOk || !templateOk || !idOk || !nameOk) continue

      candidates.push(buildAttachmentCandidate(filename, path.join(dir, filename), 'new-format'))
    }
  }

  if (candidates.length > 0) return candidates
  return findLegacySlipAttachmentCandidates({ bases, periodPrefix, employeeId, employeeName })
}

function findLegacySlipAttachmentCandidates({ bases, periodPrefix, employeeId, employeeName }) {
  const targetId = (employeeId || '').toString().trim().toLowerCase()
  const targetName = normalizeLegacyName(employeeName)
  const candidates = []

  if (!targetId) return candidates

  for (const base of bases) {
    const dir = base.dir
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir)
    for (const filename of files) {
      const lower = filename.toLowerCase()
      if (!lower.endsWith('.pdf')) continue
      const periodOk = !periodPrefix || lower.startsWith(periodPrefix)
      const hasId = lower.includes(targetId)
      const hasName = !targetName || lower.includes(targetName)
      if (!periodOk || !hasId || !hasName) continue

      candidates.push(buildAttachmentCandidate(filename, path.join(dir, filename), 'legacy'))
    }
  }

  return candidates
}

function buildAttachmentCandidate(filename, filePath, source) {
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs || 0
  } catch (e) {
    mtimeMs = 0
  }

  return {
    filename,
    path: filePath,
    source,
    mtimeMs
  }
}

function pickNewestAttachment(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const sorted = candidates.slice().sort((a, b) => {
    if ((b.mtimeMs || 0) !== (a.mtimeMs || 0)) {
      return (b.mtimeMs || 0) - (a.mtimeMs || 0)
    }

    const byName = String(b.filename || '').localeCompare(String(a.filename || ''), 'en', { sensitivity: 'base' })
    if (byName !== 0) return byName

    return String(b.path || '').localeCompare(String(a.path || ''), 'en', { sensitivity: 'base' })
  })

  return sorted[0]
}

function parseSlipAttachmentFilename(filename) {
  if (!filename || typeof filename !== 'string') return null
  if (!filename.toLowerCase().endsWith('.pdf')) return null

  const base = filename.slice(0, -4)
  const parts = base.split('.')
  if (parts.length < 5) return null

  const [period, template, employeeId, employeeName, ...uniqueParts] = parts
  if (!period || !template || !employeeId || !employeeName || uniqueParts.length === 0) return null

  return {
    period: period.toLowerCase(),
    template: template.toLowerCase(),
    employeeId: employeeId.toLowerCase(),
    employeeName: employeeName.toLowerCase()
  }
}

function normalizePeriodPrefix(val) {
  return normalizeSlipSegment((val || '').toString().trim().replace(/\//g, '-')).toLowerCase()
}

function resolveSlipTemplate(norm, requestTemplate, slipTitle) {
  const rowTemplate = normalizeSlipTemplate(
    norm.template ||
    norm.sliptemplate ||
    norm.slip_template ||
    norm.sliptype ||
    norm.slip_type
  )
  if (rowTemplate) return rowTemplate

  if (requestTemplate) return requestTemplate

  const inferred = inferSlipTemplateFromTitle(slipTitle)
  return inferred || 'payslip'
}

function inferSlipTemplateFromTitle(title) {
  const lower = (title || '').toString().trim().toLowerCase()
  if (!lower) return ''
  if (lower.includes('insentif')) return 'insentif'
  if (lower.includes('thr')) return 'thr'
  if (lower.includes('payslip') || lower.includes('slip')) return 'payslip'
  return ''
}

function normalizeSlipTemplate(template) {
  const normalized = normalizeSlipSegment(template).toLowerCase()
  if (['payslip', 'insentif', 'thr'].includes(normalized)) return normalized
  return ''
}

function normalizeSlipSegment(str) {
  return (str || '').toString()
    .trim()
    .replace(/\//g, '-')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\./g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeLegacyName(str) {
  return (str || '').toString()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/gi, '')
    .toLowerCase()
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

function safeName(str) {
  return (str || '').toString()
    .replace(/\//g, '-')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
}

function truthy(val) {
  if (val === true || val === false) return val
  const str = String(val || '').toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(str)
}

function pickSmtpConfig(company) {
  const envHost = Env.get('SMTP_HOST')
  const envPort = Env.get('SMTP_PORT')
  const envUser = Env.get('SMTP_USER')
  const envPass = Env.get('SMTP_PASS')
  const envSecure = Env.get('SMTP_SECURE', 'false')
  const envFrom = Env.get('MAIL_FROM') || envUser

  const companyComplete = company &&
    company.smtp_host &&
    company.smtp_port &&
    company.smtp_user &&
    company.smtp_pass

  const useCompany = !!companyComplete

  const smtpHost = useCompany ? company.smtp_host : envHost
  const smtpPort = useCompany ? company.smtp_port : envPort
  const smtpUser = useCompany ? company.smtp_user : envUser
  const smtpPass = useCompany ? company.smtp_pass : envPass
  const smtpSecure = useCompany
    ? truthy(company.smtp_secure)
    : truthy(envSecure)
  const mailFrom = useCompany
    ? (company.mail_from || company.smtp_user)
    : (envFrom || envUser)

  return { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom }
}

module.exports = BulkEmailController
