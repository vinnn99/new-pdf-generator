'use strict'

const Helpers = use('Helpers')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const Database = use('Database')
const JobService = require('../../Services/JobService')
const ExcelDateService = require('../../Services/ExcelDateService')
const BaTemplateService = use('App/Services/BaTemplateService')
const BaLetterNoService = use('App/Services/BaLetterNoService')
const CooperationAgreementService = use('App/Services/CooperationAgreementService')
const CooperationAgreementLetterNoService = use('App/Services/CooperationAgreementLetterNoService')

class BulkPdfController {
  async payslipFromExcel(ctx) {
    return this._handleExcel(ctx, 'payslip')
  }

  async insentifFromExcel(ctx) {
    return this._handleExcel(ctx, 'insentif')
  }

  async thrFromExcel(ctx) {
    return this._handleExcel(ctx, 'thr')
  }

  async baPenempatanFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-penempatan')
  }

  async baRequestIdFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-request-id')
  }

  async baHoldFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-hold')
  }

  async baRollingFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-rolling')
  }

  async baHoldActivateFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-hold-activate')
  }

  async baTakeoutFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-takeout')
  }

  async baTerminatedFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-terminated')
  }

  async baCancelJoinFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-cancel-join')
  }

  async baResignFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-resign')
  }

  async cooperationAgreementFromExcel(ctx) {
    return this._handleExcel(ctx, CooperationAgreementService.TEMPLATE)
  }

  /**
   * mode: payslip | insentif | thr
   */
  async _handleExcel({ request, response, auth }, mode) {
    const user = await auth.getUser()
    if (!user || !user.company_id) {
      return response.status(401).json({ status: 'error', message: 'User belum terhubung ke perusahaan' })
    }
    const company = await Database.table('companies').where('company_id', user.company_id).first()
    if (!company) {
      return response.status(401).json({ status: 'error', message: 'Perusahaan user tidak ditemukan' })
    }

    const upload = request.file('file', {
      extnames: ['xls', 'xlsx'],
      size: '10mb'
    })

    if (!upload) {
      return response.status(422).json({ status: 'error', message: 'File .xlsx wajib diunggah (field name: file)' })
    }

    const tmpPath = path.join(Helpers.tmpPath(), `${Date.now()}-${upload.clientName}`)
    await upload.move(path.dirname(tmpPath), { name: path.basename(tmpPath) })

    const opts = {
      sheet: request.input('sheet'),
      dryRun: toBool(request.input('dryRun') || request.input('dry_run')),
      defaultCallbackUrl: request.input('callback_url') || request.input('defaultCallbackUrl'),
      defaultCallbackHeader: safeJson(request.input('callback_header') || request.input('defaultCallbackHeader'), {}),
      defaultCompany: request.input('company') || request.input('company_name') || company.name,
      defaultSlipTitle: request.input('slip_title') || request.input('slipTitle') || defaultSlipTitleForMode(mode),
      defaultNote: request.input('note')
    }

    try {
      const workbook = XLSX.readFile(tmpPath)
      const sheetName = opts.sheet || workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      if (!sheet) {
        return response.status(422).json({ status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` })
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (!rows.length) {
        return response.json({ status: 'ok', message: 'Sheet kosong', total: 0 })
      }

      const isBaMode = BaTemplateService.isBaTemplate(mode)
      const isCooperationAgreementMode = CooperationAgreementService.isTemplate(mode)
      const isLetteredBatchMode = isBaMode || isCooperationAgreementMode
      const batchId = isLetteredBatchMode && !opts.dryRun ? createBatchId() : null

      const results = []
      let queued = 0
      let failed = 0

      // Cek allowed_templates untuk company user login
      const allowed = company.allowed_templates ? (() => {
        try { return JSON.parse(company.allowed_templates) } catch (e) { return [] }
      })() : []
      if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(mode)) {
        return response.status(403).json({
          status: 'forbidden',
          message: `Template '${mode}' tidak diizinkan untuk company ini`
        })
      }

      if (batchId) {
        await Database.table('generation_batches').insert({
          batch_id: batchId,
          company_id: company.company_id,
          template: mode,
          created_by: user.id,
          total_rows: rows.length,
          queued: 0,
          failed: 0,
          status: 'processing',
          created_at: new Date(),
          updated_at: new Date()
        })
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        let batchItemId = null
        let payload = null
        try {
          const lower = normalizeRow(row)
          // Untuk semua mode bulk (payslip, insentif, thr, ba-penempatan): abaikan kolom email di Excel, selalu gunakan email user yang login.
          const forceLoginEmail = true
          const email = forceLoginEmail
            ? (user.email || '').toLowerCase()
            : (extractEmail(lower) || (user.email || '')).toLowerCase()
          if (!email) throw new Error('email kosong (tidak ada di kolom dan akun login tanpa email)')

          payload = buildPayloadForMode(lower, mode, opts)
          if (isSlipMode(mode)) {
            // Dipakai GeneratePdfJob untuk format nama file baru slip bulk.
            payload.filenameTemplate = mode
          }

          if (isLetteredBatchMode) {
            payload.data = payload.data || {}
            // Tambahan: URL tanda tangan kiri/kanan (opsional)
            const sigLeft = lower.signaturelefturl || lower['signature_left_url'] || lower['signature left url']
            const sigRight = lower.signaturerighturl || lower['signature_right_url'] || lower['signature right url']
            if (sigLeft) payload.data.signatureLeftUrl = sigLeft
            if (sigRight) payload.data.signatureRightUrl = sigRight

            const matchKey = buildBatchMatchKey(mode, lower, payload.data)
            const requiredMatchFields = getRequiredBatchMatchFields(mode)
            if (!matchKey && requiredMatchFields.length > 0) {
              throw new Error(`Kolom kunci pencarian lampiran kosong: ${requiredMatchFields.join(', ')}`)
            }

            if (opts.dryRun) {
              payload.data.letterNo = '[AUTO_GENERATED_ON_EXECUTION]'
            } else {
              const numbering = isBaMode
                ? await BaLetterNoService.nextLetterNo({
                  companyId: company.company_id,
                  template: mode,
                  createdBy: user.id
                })
                : await CooperationAgreementLetterNoService.nextLetterNo({
                  companyId: company.company_id,
                  createdBy: user.id
                })
              payload.data.letterNo = numbering.letterNo

              const insertedBatchItem = await Database.table('generation_batch_items').insert({
                batch_id: batchId,
                company_id: company.company_id,
                template: mode,
                row_no: i + 1,
                match_key: matchKey || null,
                letter_no: numbering.letterNo,
                status: 'queued',
                row_data: JSON.stringify(row || {}),
                created_at: new Date(),
                updated_at: new Date()
              })

              batchItemId = Array.isArray(insertedBatchItem) ? insertedBatchItem[0] : insertedBatchItem
              payload.batchId = batchId
              payload.batchItemId = batchItemId
              payload.matchKey = matchKey || null
            }
          }

          payload.companyName = company.name
          payload.companyId = company.company_id
          payload.userId = user.id
          payload.email = email

          if (opts.dryRun) {
            results.push({ row: i + 1, email, status: 'dry-run', payload })
            queued++
            continue
          }

          await JobService.dispatch('App/Jobs/GeneratePdfJob', payload, {
            attempts: 3,
            timeout: 120000
          })

          results.push({
            row: i + 1,
            email,
            status: 'queued',
            ...(isLetteredBatchMode ? { letterNo: payload && payload.data ? payload.data.letterNo : null } : {})
          })
          queued++
        } catch (err) {
          failed++

          if (batchId) {
            const now = new Date()
            if (batchItemId) {
              await Database.table('generation_batch_items')
                .where('id', batchItemId)
                .update({
                  status: 'failed',
                  error: err.message,
                  updated_at: now
                })
            } else {
              const lower = normalizeRow(row)
              const matchKey = buildBatchMatchKey(mode, lower, payload && payload.data)
              await Database.table('generation_batch_items').insert({
                batch_id: batchId,
                company_id: company.company_id,
                template: mode,
                row_no: i + 1,
                match_key: matchKey || null,
                letter_no: payload && payload.data ? payload.data.letterNo || null : null,
                status: 'failed',
                error: err.message,
                row_data: JSON.stringify(row || {}),
                created_at: now,
                updated_at: now
              })
            }
          }

          results.push({ row: i + 1, status: 'failed', message: err.message, rowData: row })
        }
      }

      if (batchId) {
        await Database.table('generation_batches')
          .where('batch_id', batchId)
          .update({
            queued,
            failed,
            status: failed > 0 ? 'completed_with_errors' : 'completed',
            updated_at: new Date()
          })
      }

      return response.json({
        status: 'ok',
        mode,
        total: rows.length,
        queued,
        failed,
        batch_id: batchId,
        dryRun: opts.dryRun,
        sheet: sheetName,
        results
      })
    } catch (error) {
      console.error('[BulkPdf] error:', error.message)
      return response.status(500).json({
        status: 'error',
        message: 'Gagal memproses file',
        error: error.message
      })
    } finally {
      try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }
    }
  }
}

function defaultSlipTitleForMode(mode) {
  if (mode === 'insentif') return 'Payslip Insentif'
  if (mode === 'thr') return 'Payslip THR'
  return 'Payslip'
}

function toBool(val) {
  if (val === true || val === false) return val
  const str = String(val || '').toLowerCase()
  return str === 'true' || str === '1' || str === 'yes' || str === 'y'
}

function safeJson(str, fallback) {
  try { return JSON.parse(str) } catch (e) { return fallback }
}

function normalizeRow(row) {
  return Object.keys(row || {}).reduce((acc, key) => {
    const normKey = key ? key.toString().trim().toLowerCase() : ''
    acc[normKey] = row[key]
    return acc
  }, {})
}

function extractEmail(lower) {
  // Ambil email dari beberapa alias kolom; jika kosong baru fallback ke email user login
  const pick = (keys) => {
    for (const k of keys) {
      if (lower[k] === undefined || lower[k] === null) continue
      const val = lower[k].toString().trim()
      if (val) return val
    }
    return ''
  }

  const email = pick([
    'email',
    'email address',
    'email_address',
    'emailaddress',
    'mail',
    // variasi yang sering dipakai user
    'email penerima',
    'email_user_company',
    'email user company',
    'email_user',
    'email user',
    'user_email',
    'user email',
    'sentto', // reuse kolom sheet pengiriman email
    'to'
  ])

  return email.toLowerCase()
}

function parseMoneyList(str) {
  if (!str) return []
  const trimmed = String(str).trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    return safeJson(trimmed, [])
  }

  return trimmed
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [label, amount] = part.split(':')
      return { label: (label || '').trim(), amount: toNumber(amount) }
    })
}

function toNumber(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

/**
 * Parse tanggal dari Excel tanpa menggeser zona waktu.
 * Mendukung:
 *  - Serial number Excel (date code)
 *  - Objek Date
 *  - String dengan pemisah / atau -
 * Mengembalikan string ISO pendek (YYYY-MM-DD) atau '' jika tidak valid.
 */
function parseExcelDate(val) {
  return ExcelDateService.parse(val)
}

function buildPayloadForMode(lower, mode, opts) {
  if (mode === 'insentif') return buildInsentifPayload(lower, opts)
  if (mode === 'thr') return buildThrPayload(lower, opts)
  if (mode === CooperationAgreementService.TEMPLATE) return buildCooperationAgreementPayload(lower, opts)
  if (mode === 'ba-penempatan') return buildBaPenempatanPayload(lower, opts)
  if (mode === 'ba-request-id') return buildBaRequestIdPayload(lower, opts)
  if (mode === 'ba-hold') return buildBaHoldPayload(lower, opts)
  if (mode === 'ba-rolling') return buildBaRollingPayload(lower, opts)
  if (mode === 'ba-hold-activate') return buildBaHoldActivatePayload(lower, opts)
  if (mode === 'ba-takeout') return buildBaTakeoutPayload(lower, opts)
  if (mode === 'ba-terminated') return buildBaTerminatedPayload(lower, opts)
  if (mode === 'ba-cancel-join') return buildBaCancelJoinPayload(lower, opts)
  if (mode === 'ba-resign') return buildBaResignPayload(lower, opts)
  return buildPayslipPayload(lower, opts)
}

function basePayload(lower, opts) {
  const dataJson = lower.data_json ? safeJson(lower.data_json, {}) : {}
  const payload = { template: 'payslip', data: {}, callback: undefined }

  let callback = null
  if (lower.callback_url) {
    callback = { url: String(lower.callback_url).trim() }
    if (lower.callback_header) callback.header = safeJson(lower.callback_header, {})
  } else if (opts.defaultCallbackUrl) {
    callback = { url: opts.defaultCallbackUrl }
    if (opts.defaultCallbackHeader) callback.header = opts.defaultCallbackHeader
  }

  if (callback) payload.callback = callback
  payload.data = { ...dataJson }

  return payload
}

function buildPayslipPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  const joinDate = parseSlipJoinDate(lower)

  const earnings = parseMoneyList(lower.earnings)
  const deductions = parseMoneyList(lower.deductions)

  const addEarn = (label, key) => {
    if (lower[key] !== undefined && lower[key] !== '') {
      earnings.push({ label, amount: toNumber(lower[key]) })
    }
  }
  const addDed = (label, key) => {
    if (lower[key] !== undefined && lower[key] !== '') {
      deductions.push({ label, amount: toNumber(lower[key]) })
    }
  }

  addEarn('Gaji Pokok', 'gaji pokok')
  addEarn('Tunjangan Makan', 'tunjangan makan')
  addEarn('Tunjangan Transport', 'tunjangan transport')
  addEarn('Tunjangan Komunikasi', 'tunjangan komunikasi')
  addEarn('Tunjangan Komunikasi', 'yunjangan komunikasi') // handle typo umum
  addEarn('Tunjangan Jabatan', 'tunjangan jabatan')
  addEarn('Tunjangan BPJS Ketenagakerjaan', 'tunjangan bpjs ketenagakerjaan')

  addDed('BPJS Ketenagakerjaan', 'bpjs ketenagakerjaan')
  addDed('PPh21', 'pph 21')
  addDed('PPh21', 'pph21')

  payload.template = (lower.template || 'payslip').toString().trim() || 'payslip'

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    slipTitle: lower.sliptitle || opts.defaultSlipTitle,
    employeeName: lower.employeename,
    employeeId: lower.employeeid,
    position: lower.position,
    department: lower.department || lower.departement || lower.departemen,
    period: lower.period || lower.periode,
    joinDate,
    ptkp: lower.ptkp,
    targetHK: lower.targethk,
    attendance: lower.attendance,
    baseSalary: toNumber(lower.basesalary || lower['gaji pokok']),
    earnings,
    deductions,
    note: lower.note
  }

  return payload
}

function buildInsentifPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  const joinDate = parseSlipJoinDate(lower)

  const earnings = []
  const deductions = []

  const addEarn = (label, key) => {
    if (lower[key] !== undefined && lower[key] !== '') {
      earnings.push({ label, amount: toNumber(lower[key]) })
    }
  }
  const addDed = (label, key) => {
    if (lower[key] !== undefined && lower[key] !== '') {
      deductions.push({ label, amount: toNumber(lower[key]) })
    }
  }

  addEarn('INSENTIF SAMPLING', 'insentif sampling')
  addEarn('INSENTIF SELLOUT', 'insentif sellout')
  addEarn('INSENTIF SELLOUT', 'insentif  sellout')
  addEarn('INSENTIF KERAJINAN', 'insentif kerajinan')
  addEarn('INSENTIF TL', 'insentif tl')

  earnings.push(...parseMoneyList(lower.earnings))
  deductions.push(...parseMoneyList(lower.deductions))

  addDed('PPh21', 'pph21')
  addDed('PPh21', 'pph 21')

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    slipTitle: lower.sliptitle || opts.defaultSlipTitle,
    employeeName: lower.employeename,
    employeeId: lower.employeeid,
    position: lower.position,
    department: lower.department || lower.departement || lower.departemen,
    period: lower.period || lower.periode,
    joinDate,
    ptkp: lower.ptkp,
    targetHK: lower.targethk,
    attendance: lower.attendance,
    earnings,
    deductions,
    note: lower.note
  }

  return payload
}

function buildThrPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  const joinDate = parseSlipJoinDate(lower)

  const earnings = []
  if (lower.thr !== undefined && lower.thr !== '') {
    earnings.push({ label: 'THR', amount: toNumber(lower.thr) })
  }
  earnings.push(...parseMoneyList(lower.earnings))

  const deductions = parseMoneyList(lower.deductions)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    slipTitle: lower.sliptitle || opts.defaultSlipTitle,
    employeeName: lower.employeename,
    employeeId: lower.employeeid,
    position: lower.position,
    department: lower.department || lower.departement || lower.departemen,
    period: lower.period || lower.periode,
    joinDate,
    ptkp: lower.ptkp,
    targetHK: lower.targethk,
    attendance: lower.attendance,
    earnings,
    deductions,
    note: lower.note || opts.defaultNote || 'Biaya Admin jika Beda Bank ( TEMA BCA )'
  }

  return payload
}

function buildBaPenempatanPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-penempatan'

  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    nik: pick(['nik']),
    birthDate: parseExcelDate(pick(['birthdate', 'birth date', 'tanggal lahir', 'tgl lahir'])),
    placementDate: parseExcelDate(pick(['placementdate', 'placement date', 'tanggal penempatan', 'tgl penempatan'])),
    status: pick(['status']),
    category: pick(['category', 'kategori']),
    outlet: pick(['outlet']),
    reason: pick(['reason', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['mdsName', 'placementDate', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) {
    throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)
  }

  return payload
}

function buildBaRequestIdPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-request-id'

  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    area: pick(['area', 'wilayah', 'region']),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    nik: pick(['nik']),
    birthDate: parseExcelDate(pick(['birthdate', 'birth date', 'tanggal lahir', 'tgl lahir'])),
    joinDate: parseExcelDate(pick(['joindate', 'join date', 'tanggal masuk', 'tgl masuk'])),
    status: pick(['status']),
    stores: pick(['stores', 'store', 'toko', 'outlet']),
    reason: pick(['reason', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['area', 'mdsName', 'nik', 'joinDate']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaHoldPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-hold'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    holdDate: parseExcelDate(pick(['holddate', 'hold date', 'tanggal hold', 'tgl hold'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outlet: pick(['outlet', 'outlet penempatan', 'toko']),
    reason: pick(['reason', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'holdDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaRollingPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-rolling'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    rollingDate: parseExcelDate(pick(['rollingdate', 'rolling date', 'tanggal rolling', 'tgl rolling'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outletFrom: pick(['outletfrom', 'outlet from', 'outlet sebelumnya', 'toko sebelumnya']),
    outletTo: pick(['outletto', 'outlet to', 'outlet penempatan', 'toko penempatan']),
    reason: pick(['reason', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'rollingDate', 'mdsName', 'mdsCode', 'status', 'outletFrom', 'outletTo']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaHoldActivatePayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-hold-activate'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    reactivateDate: parseExcelDate(pick(['reactivatedate', 'reactivate date', 'tanggal aktif', 'tgl aktif', 'aktif kembali'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outlet: pick(['outlet', 'outlet penempatan', 'toko']),
    holdReason: pick(['holdreason', 'hold reason', 'alasan hold']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'reactivateDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaTakeoutPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-takeout'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    takeoutDate: parseExcelDate(pick(['takeoutdate', 'takeout date', 'tanggal takeout', 'tgl takeout', 'tanggal toko takeout'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outlet: pick(['outlet', 'outlet penempatan', 'toko']),
    reason: pick(['reason', 'alasan', 'alasan takeout']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'takeoutDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaTerminatedPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-terminated'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    terminateDate: parseExcelDate(pick(['terminatedate', 'terminate date', 'termination date', 'tanggal terminasi', 'tgl terminasi'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outlet: pick(['outlet', 'outlet penempatan', 'toko']),
    reasons: parseList(pick(['reasons', 'reason', 'alasan terminasi', 'alasan'])),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'terminateDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaCancelJoinPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-cancel-join'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah']),
    cancelJoinDate: parseExcelDate(pick(['canceljoindate', 'cancel join date', 'batal join date', 'tanggal batal join', 'tgl batal join'])),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    status: pick(['status']),
    outlet: pick(['outlet', 'outlet penempatan', 'toko']),
    reason: pick(['reason', 'alasan batal join', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'cancelJoinDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildBaResignPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = 'ba-resign'
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: lower.companyname || opts.defaultCompany,
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    region: pick(['region', 'wilayah', 'area']),
    mdsName: pick(['mdsname', 'mds name', 'nama mds']),
    mdsCode: pick(['mdscode', 'mds code', 'code mds', 'kode mds']),
    nik: pick(['nik']),
    birthDate: parseExcelDate(pick(['birthdate', 'birth date', 'date of birth', 'tanggal lahir', 'tgl lahir'])),
    effectiveResignDate: parseExcelDate(pick(['effectiveresigndate', 'effective resign date', 'resign date', 'tanggal efektif resign', 'tgl efektif resign'])),
    status: pick(['status']),
    mdsCategory: pick(['mdscategory', 'mds category', 'kategori mds', 'category', 'kategori']),
    outletFrom: pick(['outletfrom', 'outlet from', 'dari outlet', 'outlet']),
    resignReason: pick(['resignreason', 'resign reason', 'alasan resign', 'reason', 'alasan']),
    location: pick(['location', 'lokasi']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    signerLeftName: pick(['signerleftname', 'signer left name', 'penandatangan kiri']),
    signerLeftTitle: pick(['signerlefttitle', 'signer left title', 'jabatan kiri']),
    signerRightName: pick(['signerrightname', 'signer right name', 'penandatangan kanan']),
    signerRightTitle: pick(['signerrighttitle', 'signer right title', 'jabatan kanan']),
  }

  const required = ['region', 'mdsName', 'mdsCode', 'nik', 'effectiveResignDate', 'status', 'mdsCategory', 'outletFrom']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function buildCooperationAgreementPayload(lower, opts) {
  const payload = basePayload(lower, opts)
  payload.template = CooperationAgreementService.TEMPLATE
  const pick = (keys) => pickFromLower(lower, keys)

  payload.data = {
    ...payload.data,
    companyName: pick(['companyname', 'company name', 'company_name', 'namaperusahaan', 'nama perusahaan']) || CooperationAgreementService.DEFAULT_COMPANY_NAME,
    logoUrl: pick(['logourl', 'logo url', 'logo_url', 'logofile', 'logo file', 'logo_file', 'companylogourl', 'company logo url', 'company_logo_url']),
    logoPath: pick(['logopath', 'logo path', 'logo_path', 'logofilepath', 'logo file path', 'logo_file_path', 'companylogopath', 'company logo path', 'company_logo_path']),
    letterNo: pick(['letterno', 'letter no', 'no surat', 'letter_number', 'letter number']),
    letterDate: parseExcelDate(pick(['letterdate', 'letter date', 'tanggal surat'])),
    location: pick(['location', 'lokasi']),
    firstPartyName: pick(['firstpartyname', 'first party name', 'first_party_name', 'pihak1nama', 'pihak 1 nama']),
    firstPartyTitle: pick(['firstpartytitle', 'first party title', 'first_party_title', 'pihak1jabatan', 'pihak 1 jabatan']),
    partnerName: pick(['partnername', 'partner name', 'partner_name', 'mitranama', 'mitra nama']),
    partnerNationality: pick(['partnernationality', 'partner nationality', 'partner_nationality', 'mitrawarganegara', 'mitra warga negara']),
    partnerIdentityNumber: pick(['partneridentitynumber', 'partner identity number', 'partner_identity_number', 'mitraid', 'mitra id', 'mitra id/ktp/sim', 'ktp', 'sim']),
    partnerBirthPlace: pick(['partnerbirthplace', 'partner birth place', 'partner_birth_place', 'mitratempatlahir', 'mitra tempat lahir']),
    partnerBirthDate: parseExcelDate(pick(['partnerbirthdate', 'partner birth date', 'partner_birth_date', 'mitratanggallahir', 'mitra tanggal lahir', 'tanggal lahir'])),
    partnerAddress: pick(['partneraddress', 'partner address', 'partner_address', 'mitraalamat', 'mitra alamat', 'alamat mitra']),
    partnerPhone: pick(['partnerphone', 'partner phone', 'partner_phone', 'mitraphone', 'mitra phone', 'mitra no telp/hp', 'no telp', 'no hp']),
    partnerEmail: pick(['partneremail', 'partner email', 'partner_email', 'mitraemail', 'mitra email']),
    brand: pick(['brand']),
    salary: pick(['salary', 'salary/gaji', 'gaji']),
    transportAllowance: pick(['transportallowance', 'transport allowance', 'transport_allowance', 'tunjangantransport', 'tunjangan transport']),
    mealAllowance: pick(['mealallowance', 'meal allowance', 'meal_allowance', 'tunjanganmakan', 'tunjangan makan']),
    phoneAllowance: pick(['phoneallowance', 'phone allowance', 'phone_allowance', 'tunjanganpulsa', 'tunjangan pulsa']),
    partnerBankAccountNumber: pick(['partnerbankaccountnumber', 'partner bank account number', 'partner_bank_account_number', 'nomorrekeningmitra', 'nomor rekening mitra']),
    partnerBankAccountName: pick(['partnerbankaccountname', 'partner bank account name', 'partner_bank_account_name', 'namarekeningmitra', 'nama rekening mitra']),
    partnerBankName: pick(['partnerbankname', 'partner bank name', 'partner_bank_name', 'namabankmitra', 'nama bank mitra']),
    agreementDuration: pick(['agreementduration', 'agreement duration', 'agreement_duration', 'lamaperjanjian', 'lama perjanjian']),
    workHoursPerDay: pick(['workhoursperday', 'work hours per day', 'work_hours_per_day', 'jamkerjaperhari', 'jam kerja per hari']),
    placementArea: pick(['placementarea', 'placement area', 'placement_area', 'wilayahpenempatan', 'wilayah penempatan']),
    picName: pick(['picname', 'pic name', 'pic_name', 'namapic', 'nama pic']),
    picTitle: pick(['pictitle', 'pic title', 'pic_title', 'jabatanpic', 'jabatan pic']),
    picEmail: pick(['picemail', 'pic email', 'pic_email', 'emailpic', 'email pic']),
    picAddress: pick(['picaddress', 'pic address', 'pic_address', 'alamatpic', 'alamat pic']),
    directorSignatureUrl: pick(['directorsignatureurl', 'director signature url', 'director_signature_url', 'signaturedirectorurl', 'signature director url', 'signature direktur', 'signaturelefturl', 'signature_left_url', 'signature left url']),
    partnerSignatureUrl: pick(['partnersignatureurl', 'partner signature url', 'partner_signature_url', 'signaturemitraurl', 'signature mitra url', 'signature mitra', 'signaturerighturl', 'signature_right_url', 'signature right url'])
  }

  payload.data = CooperationAgreementService.normalizeData(payload.data)
  const errors = CooperationAgreementService.validateData(payload.data)
  if (errors.length) {
    throw new Error(errors.join('; '))
  }

  return payload
}

function buildBatchMatchKey(mode, lower, payloadData) {
  if (BaTemplateService.isBaTemplate(mode)) {
    const fields = BaTemplateService.extractMatchFieldsFromRow(mode, lower)
    return BaTemplateService.buildMatchKey(mode, fields)
  }

  if (CooperationAgreementService.isTemplate(mode)) {
    const data = payloadData && typeof payloadData === 'object'
      ? payloadData
      : {
          partnerName: pickFromLower(lower, ['partnername', 'partner name', 'partner_name', 'mitranama', 'mitra nama']),
          partnerEmail: pickFromLower(lower, ['partneremail', 'partner email', 'partner_email', 'mitraemail', 'mitra email']),
          partnerIdentityNumber: pickFromLower(lower, ['partneridentitynumber', 'partner identity number', 'partner_identity_number', 'mitraid', 'mitra id', 'ktp', 'sim'])
        }
    return CooperationAgreementService.buildMatchKey(data)
  }

  return ''
}

function getRequiredBatchMatchFields(mode) {
  if (BaTemplateService.isBaTemplate(mode)) return BaTemplateService.getRequiredMatchFields(mode)
  if (CooperationAgreementService.isTemplate(mode)) return ['partnerName', 'partnerEmail/partnerIdentityNumber']
  return []
}

function pickFromLower(lower, keys) {
  for (const k of keys) {
    if (lower[k] === undefined || lower[k] === null) continue
    if (typeof lower[k] === 'string' && lower[k].trim() === '') continue
    return lower[k]
  }
  return undefined
}

function parseSlipJoinDate(lower) {
  return parseExcelDate(pickFromLower(lower, ['joindate', 'join date', 'join_date', 'tanggal masuk', 'tgl masuk']))
}

function isSlipMode(mode) {
  return mode === 'payslip' || mode === 'insentif' || mode === 'thr'
}

function createBatchId() {
  return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function parseList(val) {
  if (!val && val !== 0) return []
  if (Array.isArray(val)) return val.filter(Boolean).map((v) => String(v).trim()).filter(Boolean)
  const str = String(val).trim()
  if (!str) return []
  return str.split(/\r?\n|;|,|•|-/).map((s) => s.trim()).filter(Boolean)
}

module.exports = BulkPdfController
