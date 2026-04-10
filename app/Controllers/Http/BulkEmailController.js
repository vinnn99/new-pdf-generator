'use strict'

const Env = use('Env')
const Helpers = use('Helpers')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const JobService = require('../../Services/JobService')
const Database = use('Database')
const BaTemplateService = use('App/Services/BaTemplateService')

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
   * Form-data:
   *   - batch_id (wajib): id batch hasil generate bulk BA sebelumnya
   *   - file (.xlsx) dengan kolom:
   *       sentTo (wajib) | mdsName (wajib) | outlet (wajib) | subject | body | cc | bcc
   *   Lookup lampiran berdasarkan metadata batch:
   *     batch_id + template + match_key
   */
  async sendBaPenempatan({ request, response, auth }) {
    const cfg = {
      template: 'ba-penempatan',
      required: ['mdsName', 'outlet'],
      subject: (f, _company, item) => `Berita Acara Penempatan - ${f.mdsName || f.outlet || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Penempatan MDS.',
        f.outlet ? `Outlet: ${f.outlet}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ].filter(Boolean).join('\n')
    }
    return this._sendBaTemplate({ request, response, auth }, cfg)
  }

  /**
   * Generic sender for BA templates with lookup via generation batch metadata.
   * cfg: {
   *   template: 'ba-request-id',
   *   required: ['mdsName', 'area'],
   *   subject: (fields, company, batchItem) => string,
   *   body: (fields, company, batchItem) => string
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

      const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom } = pickSmtpConfig(company)
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({
          status: 'error',
          message: 'Konfigurasi SMTP belum lengkap di perusahaan atau .env'
        })
      }

      const batchId = String(request.input('batch_id') || request.input('batchId') || '').trim()
      if (!batchId) {
        return response.status(422).json({
          status: 'validation_failed',
          message: 'batch_id wajib diisi'
        })
      }

      const batch = await Database.table('generation_batches')
        .where('batch_id', batchId)
        .where('company_id', company.company_id)
        .where('template', cfg.template)
        .first()

      if (!batch) {
        return response.status(404).json({
          status: 'error',
          message: `Batch ${cfg.template} tidak ditemukan untuk company ini`
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

      const batchItems = await Database.table('generation_batch_items')
        .where('batch_id', batchId)
        .where('company_id', company.company_id)
        .where('template', cfg.template)
        .whereNotNull('saved_path')
        .orderBy('updated_at', 'desc')
        .orderBy('id', 'desc')

      const attachmentsByMatchKey = batchItems.reduce((acc, item) => {
        const key = (item.match_key || '').toString()
        if (!key) return acc
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})

      const results = []
      let queuedCount = 0
      let failedCount = 0
      let skippedCount = 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const norm = normalizeRow(row)
        const to = norm.sentto || norm.email

        const fields = BaTemplateService.extractMatchFieldsFromRow(cfg.template, norm)
        const matchKey = BaTemplateService.buildMatchKey(cfg.template, fields)

        // Required check
        const missing = (cfg.required || []).filter((k) => !fields[k])
        if (!to) {
          results.push({ row: i + 1, status: 'skipped', message: 'sentTo/email kosong' })
          appendLog({ row: i + 1, status: 'skipped', reason: 'no_recipient', template: cfg.template, batchId, matchKey })
          skippedCount++
          continue
        }
        if (missing.length) {
          results.push({ row: i + 1, status: 'failed', to, message: `Field wajib kosong: ${missing.join(', ')}` })
          appendLog({ row: i + 1, to, status: 'failed', reason: 'missing_required_fields', missing, template: cfg.template, batchId, matchKey })
          failedCount++
          continue
        }

        const candidates = attachmentsByMatchKey[matchKey] || []
        const batchAttachment = pickLatestBatchAttachment(candidates)
        if (!batchAttachment) {
          results.push({ row: i + 1, status: 'skipped', to, message: `Lampiran ${cfg.template} tidak ditemukan` })
          appendLog({ row: i + 1, to, status: 'skipped', reason: 'no_attachments', template: cfg.template, batchId, matchKey })
          skippedCount++
          continue
        }

        const subject = norm.subject || cfg.subject(fields, company, batchAttachment)
        const body = norm.body || cfg.body(fields, company, batchAttachment)
        const cc = norm.cc ? norm.cc.split(';').map(s => s.trim()).filter(Boolean) : []
        const bcc = norm.bcc ? norm.bcc.split(';').map(s => s.trim()).filter(Boolean) : []

        try {
          await JobService.dispatch('App/Jobs/SendEmailJob', {
            smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, mailFrom,
            to, cc, bcc, subject, text: body,
            attachments: [{ filename: batchAttachment.filename, path: batchAttachment.path }],
            employeeName: fields.mdsName,
            userId: user.id,
            companyId: company.company_id,
            template: cfg.template,
            context: 'bulk-ba'
          }, { attempts: 3, timeout: 120000 })
          results.push({ row: i + 1, status: 'queued', to, attachment: batchAttachment.filename })
          appendLog({
            row: i + 1,
            to,
            status: 'queued',
            template: cfg.template,
            batchId,
            matchKey,
            attachment: batchAttachment.filename,
            letterNo: batchAttachment.letter_no || null,
            candidates: candidates.length
          })
          queuedCount++
        } catch (err) {
          results.push({ row: i + 1, status: 'failed', to, message: err.message })
          appendLog({ row: i + 1, to, status: 'failed', error: err.message, template: cfg.template, batchId, matchKey })
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
        batch_id: batchId,
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
      required: ['mdsName', 'area'],
      subject: (f, _company, item) => `Berita Acara Request ID - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Request ID MDS.',
        f.area ? `Area: ${f.area}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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
      required: ['mdsName', 'region'],
      subject: (f, _company, item) => `Berita Acara HOLD - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara HOLD MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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
      required: ['mdsName', 'region'],
      subject: (f, _company, item) => `Berita Acara Rolling - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Rolling MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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
      required: ['mdsName', 'region'],
      subject: (f, _company, item) => `Berita Acara HOLD Aktif - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara HOLD Aktif Kembali.',
        f.region ? `Wilayah: ${f.region}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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
      required: ['mdsName', 'region'],
      subject: (f, _company, item) => `Berita Acara Takeout - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Toko Takeout MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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
      required: ['mdsName', 'region'],
      subject: (f, _company, item) => `Berita Acara Terminasi - ${f.mdsName || (item && item.letter_no) || ''}`,
      body: (f, company, item) => [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        'Berikut terlampir Berita Acara Terminasi MDS.',
        f.region ? `Wilayah: ${f.region}` : null,
        item && item.letter_no ? `Nomor Surat: ${item.letter_no}` : null,
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

function pickLatestBatchAttachment(items) {
  if (!Array.isArray(items) || items.length === 0) return null

  const candidates = []
  for (const item of items) {
    const filePath = resolveSavedPath(item.saved_path)
    if (!filePath || !fs.existsSync(filePath)) continue

    let mtimeMs = 0
    try {
      mtimeMs = fs.statSync(filePath).mtimeMs || 0
    } catch (e) {
      mtimeMs = 0
    }

    candidates.push({
      ...item,
      path: filePath,
      mtimeMs
    })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if ((b.mtimeMs || 0) !== (a.mtimeMs || 0)) return (b.mtimeMs || 0) - (a.mtimeMs || 0)
    if (Number(b.id || 0) !== Number(a.id || 0)) return Number(b.id || 0) - Number(a.id || 0)
    return String(b.filename || '').localeCompare(String(a.filename || ''), 'en', { sensitivity: 'base' })
  })

  return candidates[0]
}

function resolveSavedPath(savedPath) {
  const raw = String(savedPath || '').trim()
  if (!raw) return ''
  return path.join(process.cwd(), raw)
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
