'use strict'

/**
 * Bulk generate PDF jobs from an Excel file.
 *
 * Usage:
 *   node scripts/bulk-generate-excel.js --file payroll.xlsx --api-key YOUR_KEY
 *   node scripts/bulk-generate-excel.js --file payroll.xlsx --api-key YOUR_KEY --endpoint http://localhost:4100/api/v1/generate-pdf --sheet Sheet1
 *
 * Excel columns (case-insensitive):
 *   email*              : email penerima (wajib)
 *   template            : nama template (default: payslip)
 *   callback_url        : URL webhook (opsional)
 *   callback_header     : JSON string header webhook (opsional)
 *   data_json           : JSON string untuk menimpa/menambah data (opsional)
 *
 * Kolom spesifik payslip (opsional, dipakai jika template = payslip):
 *   slipTitle, companyName, employeeName*, employeeId, position*, department,
 *   period*, joinDate, ptkp, targetHK, attendance,
 *   baseSalary, earnings, deductions, note
 *
 * Format header contoh (baris pertama) yang otomatis dipetakan ke earnings/deductions:
 *   employeeID | employeeName | position | departement | ptkp | periode | joinDate | departemen | targetHK | attendance |
 *   Gaji Pokok | Tunjangan makan | Tunjangan Transport | Tunjangan Komunikasi | Tunjangan Jabatan |
 *   BPJS Ketenagakerjaan | PPH 21
 *
 * Nilai numerik di kolom-kolom tunjangan/potongan akan dikonversi ke earnings/deductions otomatis.
 *
 * earnings / deductions bisa berformat:
 *   - JSON array string: [{"label":"Tunjangan Transport","amount":1000000}]
 *   - Atau string: "Tunjangan Transport:1000000; Tunjangan Makan:800000"
 *
 * Keterangan:
 *   - Kolom bertanda * wajib untuk template payslip.
 *   - Jika baseSalary ada tapi earnings belum memuat "Gaji Pokok", akan otomatis ditambahkan.
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const args = process.argv.slice(2)

function parseArgs() {
  const opts = {
    file: null,
    apiKey: null,
    endpoint: 'http://localhost:4100/api/v1/generate-pdf',
    sheet: null,
    dryRun: false,
    defaultCallbackUrl: null,
    defaultCallbackHeader: null
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
      default:
        break
    }
  }

  if (!opts.file) {
    throw new Error('Parameter --file wajib diisi')
  }
  if (!opts.apiKey) {
    throw new Error('Parameter --api-key wajib diisi')
  }
  return opts
}

function parseMoneyList(str) {
  if (!str) return []
  const trimmed = String(str).trim()
  if (!trimmed) return []

  // JSON array
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  // "Label:1000; Label2:2000"
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

function buildPayloadFromRow(row, opts = {}) {
  const lower = Object.keys(row || {}).reduce((acc, key) => {
    const normKey = key ? key.toString().trim().toLowerCase() : ''
    acc[normKey] = row[key]
    return acc
  }, {})

  const template = (lower.template || 'payslip').toString().trim() || 'payslip'

  const email =
    (lower.email ||
      lower['email address'] ||
      lower['email_address'] ||
      lower['emailaddress'] ||
      lower['mail'] ||
      '').toString().trim()

  if (!email) {
    throw new Error('email kosong')
  }

  const payload = { template, email, data: {} }

  const dataJson = lower.data_json ? safeJson(lower.data_json, {}) : {}
  let callback = null
  if (lower.callback_url) {
    callback = { url: String(lower.callback_url).trim() }
    if (lower.callback_header) {
      callback.header = safeJson(lower.callback_header, {})
    }
  }
  if (!callback && opts.defaultCallbackUrl) {
    callback = { url: opts.defaultCallbackUrl }
    if (opts.defaultCallbackHeader) callback.header = opts.defaultCallbackHeader
  }

  if (template === 'payslip') {
    const earnings = parseMoneyList(lower.earnings)
    const deductions = parseMoneyList(lower.deductions)

    // Tambahan mapping kolom spesifik (case-insensitive)
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
    addEarn('Tunjangan Komunikasi', 'yunjangan komunikasi') // handle typo
    addEarn('Tunjangan Jabatan', 'tunjangan jabatan')

    addDed('BPJS Ketenagakerjaan', 'bpjs ketenagakerjaan')
    addDed('PPh21', 'pph 21')
    addDed('PPh21', 'pph21')

    payload.data = {
      companyName: lower.companyname,
      slipTitle: lower.sliptitle,
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
  } else {
    // Generic: rely on data_json or all fields except known
    payload.data = dataJson
    Object.entries(lower).forEach(([k, v]) => {
      if (['email', 'template', 'callback_url', 'callback_header', 'data_json'].includes(k)) return
      if (payload.data[k] === undefined) payload.data[k] = v
    })
  }

  payload.data = { ...payload.data, ...dataJson }
  if (callback) payload.callback = callback

  return payload
}

function safeJson(str, fallback) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
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
  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`)
  }

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
