'use strict'

const Helpers = use('Helpers')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const Database = use('Database')
const JobService = require('../../Services/JobService')

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

  async baTerminatedFromExcel(ctx) {
    return this._handleExcel(ctx, 'ba-terminated')
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

      const results = []
      let queued = 0
      let failed = 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          const lower = normalizeRow(row)
          // Untuk semua mode bulk (payslip, insentif, thr, ba-penempatan): abaikan kolom email di Excel, selalu gunakan email user yang login.
          const forceLoginEmail = true
          const email = forceLoginEmail
            ? (user.email || '').toLowerCase()
            : (extractEmail(lower) || (user.email || '')).toLowerCase()
          if (!email) throw new Error('email kosong (tidak ada di kolom dan akun login tanpa email)')

          const payload = buildPayloadForMode(lower, mode, opts)
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

          results.push({ row: i + 1, email, status: 'queued' })
          queued++
        } catch (err) {
          failed++
          results.push({ row: i + 1, status: 'failed', message: err.message, rowData: row })
        }
      }

      return response.json({
        status: 'ok',
        mode,
        total: rows.length,
        queued,
        failed,
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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toYmd(y, m, d) {
  if (!y || !m || !d) return ''
  return `${y}-${pad2(m)}-${pad2(d)}`
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
  if (val === undefined || val === null || val === '') return ''

  // Excel date code (number of days since 1900-01-00)
  if (typeof val === 'number') {
    const parsed = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(val) : null
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return toYmd(parsed.y, parsed.m, parsed.d)
    }
  }

  // JS Date object
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return toYmd(val.getFullYear(), val.getMonth() + 1, val.getDate())
  }

  // String formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY (fallback)
  const str = String(val).trim()
  if (!str) return ''

  let m
  // 2026-04-07 or 2026/04/07
  m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return toYmd(Number(m[1]), Number(m[2]), Number(m[3]))

  // 07-04-2026 or 07/04/2026 (as used di Indonesia: dd-mm-yyyy)
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (m) {
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
    return toYmd(year, Number(m[2]), Number(m[1]))
  }

  return str // fallback; template akan render apa adanya
}

function buildPayloadForMode(lower, mode, opts) {
  if (mode === 'insentif') return buildInsentifPayload(lower, opts)
  if (mode === 'thr') return buildThrPayload(lower, opts)
  if (mode === 'ba-penempatan') return buildBaPenempatanPayload(lower, opts)
  if (mode === 'ba-request-id') return buildBaRequestIdPayload(lower, opts)
  if (mode === 'ba-hold') return buildBaHoldPayload(lower, opts)
  if (mode === 'ba-rolling') return buildBaRollingPayload(lower, opts)
  if (mode === 'ba-hold-activate') return buildBaHoldActivatePayload(lower, opts)
  if (mode === 'ba-terminated') return buildBaTerminatedPayload(lower, opts)
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
    joinDate: lower.joindate,
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
    joinDate: lower.joindate,
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
    joinDate: lower.joindate,
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

  const required = ['letterNo', 'mdsName', 'placementDate', 'outlet']
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

  const required = ['letterNo', 'mdsName', 'nik', 'joinDate']
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

  const required = ['letterNo', 'region', 'holdDate', 'mdsName', 'mdsCode', 'status', 'outlet']
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

  const required = ['letterNo', 'region', 'rollingDate', 'mdsName', 'mdsCode', 'status', 'outletFrom', 'outletTo']
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

  const required = ['letterNo', 'region', 'reactivateDate', 'mdsName', 'mdsCode', 'status', 'outlet']
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

  const required = ['letterNo', 'region', 'terminateDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  const missing = required.filter((k) => !payload.data[k])
  if (missing.length) throw new Error(`Kolom wajib kosong: ${missing.join(', ')}`)

  return payload
}

function pickFromLower(lower, keys) {
  for (const k of keys) {
    if (lower[k] !== undefined && lower[k] !== null && lower[k] !== '') return lower[k]
  }
  return ''
}

function parseList(val) {
  if (!val && val !== 0) return []
  if (Array.isArray(val)) return val.filter(Boolean).map((v) => String(v).trim()).filter(Boolean)
  const str = String(val).trim()
  if (!str) return []
  return str.split(/\r?\n|;|,|•|-/).map((s) => s.trim()).filter(Boolean)
}

module.exports = BulkPdfController
