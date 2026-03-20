'use strict'

/**
 * Bulk generate payslip insentif from Excel.
 *
 * Usage:
 *   node scripts/bulk-insentif-excel.js --file payroll.xlsx --api-key YOUR_KEY
 *   node scripts/bulk-insentif-excel.js --file payroll.xlsx --api-key YOUR_KEY --endpoint http://localhost:4100/api/v1/generate-pdf --callback-url http://localhost:4100/dummy-cb
 *
 * Minimal required columns (case-insensitive):
 *   email, employeeName, position, period/periode
 *
 * Optional columns:
 *   employeeId, department/departement/departemen, joinDate, ptkp, targetHK, attendance, note
 *
 * Earnings columns (any that are present will be added):
 *   INSENTIF SAMPLING, INSENTIF SELLOUT, INSENTIF KERAJINAN, INSENTIF TL
 *   Or a free-form `earnings` column (string "Label:amount; Label2:amount2" or JSON array)
 *
 * Deductions columns:
 *   PPh21, PPH 21, PPH21
 *   Or a free-form `deductions` column (string/JSON as above)
 *
 * Defaults (can be overridden by CLI flags):
 *   companyName: from --company (otherwise empty)
 *   slipTitle:  from --slip-title (default "Payslip Insentif")
 *   callback:   from --callback-url / --callback-header if not provided per-row
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const args = process.argv.slice(2)

function safeJson(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

function parseArgs() {
  const opts = {
    file: null,
    apiKey: null,
    endpoint: 'http://localhost:4100/api/v1/generate-pdf',
    sheet: null,
    dryRun: false,
    defaultCallbackUrl: null,
    defaultCallbackHeader: null,
    defaultCompany: '',
    defaultSlipTitle: 'Payslip Insentif'
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    switch (a) {
      case '--file':
      case '-f':
        opts.file = args[++i]
        break
      case '--api-key':
      case '--apiKey':
        opts.apiKey = args[++i]
        break
      case '--endpoint':
      case '-e':
        opts.endpoint = args[++i]
        break
      case '--sheet':
        opts.sheet = args[++i]
        break
      case '--dry-run':
        opts.dryRun = true
        break
      case '--callback-url':
        opts.defaultCallbackUrl = args[++i]
        break
      case '--callback-header':
        opts.defaultCallbackHeader = safeJson(args[++i], {})
        break
      case '--company':
        opts.defaultCompany = args[++i]
        break
      case '--slip-title':
        opts.defaultSlipTitle = args[++i]
        break
      default:
        break
    }
  }

  if (!opts.file) throw new Error('Parameter --file wajib diisi')
  if (!opts.apiKey) throw new Error('Parameter --api-key wajib diisi')
  return opts
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
      return { label: (label || '').trim(), amount: Number(amount) || 0 }
    })
}

function toNumber(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function normalizeRow(row) {
  return Object.keys(row || {}).reduce((acc, key) => {
    const normKey = key ? key.toString().trim().toLowerCase() : ''
    acc[normKey] = row[key]
    return acc
  }, {})
}

function buildPayloadFromRow(row, opts) {
  const lower = normalizeRow(row)

  const email = (lower.email || '').toString().trim()
  if (!email) throw new Error('email kosong')

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

  // free-form earnings/deductions columns
  earnings.push(...parseMoneyList(lower.earnings))
  deductions.push(...parseMoneyList(lower.deductions))

  addDed('PPh21', 'pph21')
  addDed('PPh21', 'pph 21')

  const payload = {
    template: 'payslip',
    email,
    data: {
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
  }

  const dataJson = lower.data_json ? safeJson(lower.data_json, {}) : {}
  payload.data = { ...payload.data, ...dataJson }

  let callback = null
  if (lower.callback_url) {
    callback = { url: String(lower.callback_url).trim() }
    if (lower.callback_header) callback.header = safeJson(lower.callback_header, {})
  } else if (opts.defaultCallbackUrl) {
    callback = { url: opts.defaultCallbackUrl }
    if (opts.defaultCallbackHeader) callback.header = opts.defaultCallbackHeader
  }
  if (callback) payload.callback = callback

  return payload
}

async function sendRequest(endpoint, apiKey, payload) {
  const url = new URL(endpoint)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    throw new Error(`fetch failed: ${err.message}`)
  }

  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }

  if (!res.ok) {
    let message = json && json.message ? json.message : text
    if (json && json.errors) {
      const errs = Array.isArray(json.errors) ? json.errors.join('; ') : JSON.stringify(json.errors)
      message += ` | errors: ${errs}`
    }
    throw new Error(`HTTP ${res.status} - ${message}`)
  }

  return json || text
}

async function main() {
  const opts = parseArgs()
  const filePath = path.resolve(opts.file)
  if (!fs.existsSync(filePath)) throw new Error(`File tidak ditemukan: ${filePath}`)

  const wb = XLSX.readFile(filePath)
  const sheetName = opts.sheet || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" tidak ditemukan`)

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows.length) {
    console.log('Sheet kosong, tidak ada data.')
    return
  }

  console.log(`Processing ${rows.length} rows from ${sheetName}...`)
  console.log(`Endpoint: ${opts.endpoint}`)

  let success = 0
  let failed = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const payload = buildPayloadFromRow(row, opts)
      if (opts.dryRun) {
        console.log(`[dry-run] row ${i + 1}:`, JSON.stringify(payload))
        success++
        continue
      }
      const resp = await sendRequest(opts.endpoint, opts.apiKey, payload)
      console.log(`Row ${i + 1} OK ->`, resp && resp.status ? resp.status : 'sent')
      success++
    } catch (err) {
      console.error(`Row ${i + 1} FAILED -> ${err.message}`)
      console.error('  Row data:', JSON.stringify(row, null, 2))
      failed++
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
