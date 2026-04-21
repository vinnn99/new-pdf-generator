'use strict'

/**
 * Generate Excel template(s) for bulk generation.
 *
 * Usage:
 *   node scripts/create-bulk-template.js
 *   node scripts/create-bulk-template.js --template ba-penempatan
 *   node scripts/create-bulk-template.js --all
 *   node scripts/create-bulk-template.js --all --output-dir resources/templates
 *   node scripts/create-bulk-template.js [outputPath]
 *
 * Default output: resources/templates/payslip-bulk-template.xlsx
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const TEMPLATE_DEFINITIONS = {
  payslip: {
    filename: 'payslip-bulk-template.xlsx',
    headers: [
      'employeeID',
      'employeeName',
      'position',
      'departement',
      'ptkp',
      'periode',
      'joinDate',
      'targetHK',
      'attendance',
      'Gaji Pokok',
      'Tunjangan makan',
      'Tunjangan Transport',
      'Tunjangan Komunikasi',
      'Tunjangan Jabatan',
      'BPJS Ketenagakerjaan',
      'PPH 21',
      'email'
    ],
    sample: [
      'EMP-001',
      'Budi Santoso',
      'Software Engineer',
      'IT',
      'TK0',
      'Maret 2026',
      '2024-08-01',
      '22',
      '21/22',
      12000000,
      800000,
      1000000,
      800000,
      800000,
      300000,
      250000,
      'user@example.com'
    ]
  },
  'ba-penempatan': {
    filename: 'ba-penempatan-bulk-template.xlsx',
    headers: [
      'mdsName',
      'nik',
      'birthDate',
      'placementDate',
      'status',
      'category',
      'outlet',
      'region',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'SANTI',
      '1505046404980001',
      '1998-04-24',
      '2026-04-01',
      'STAY',
      'BIR',
      'GLOBAL CAFE',
      'SMS',
      'Alasan penempatan',
      'Jakarta',
      '2026-03-30',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-request-id': {
    filename: 'ba-request-id-bulk-template.xlsx',
    headers: [
      'area',
      'mdsName',
      'nik',
      'birthDate',
      'joinDate',
      'status',
      'stores',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'JTU',
      'MUHAMAD MUZAENI',
      '3328091505990007',
      '1999-05-15',
      '2026-04-09',
      'MOBILE',
      'TOKO A;TOKO B',
      'REQUEST ID MDS',
      'Jakarta',
      '2026-04-09',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-hold': {
    filename: 'ba-hold-bulk-template.xlsx',
    headers: [
      'region',
      'holdDate',
      'mdsName',
      'mdsCode',
      'status',
      'outlet',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'JTU',
      '2026-04-01',
      'INTAN DESMA SYAWALIA',
      'MDSUJTU207',
      'STAY',
      'Tk Harry & Sons@ *Obp',
      'Izin jaga suami',
      'Jakarta',
      '2026-04-06',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-rolling': {
    filename: 'ba-rolling-bulk-template.xlsx',
    headers: [
      'region',
      'rollingDate',
      'mdsName',
      'mdsCode',
      'status',
      'outletFrom',
      'outletTo',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'JTU',
      '2026-04-07',
      'NUZULUL NINA QURANI',
      'MDSUJTU255',
      'STAY',
      'DJ TEDDY GAB',
      'MAK SUTINAH*OBP',
      'Permintaan rolling outlet',
      'Jakarta',
      '2026-04-06',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-hold-activate': {
    filename: 'ba-hold-activate-bulk-template.xlsx',
    headers: [
      'region',
      'reactivateDate',
      'mdsName',
      'mdsCode',
      'status',
      'outlet',
      'holdReason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'JTU',
      '2026-04-06',
      'INTAN DESMA SYAWALIA',
      'MDSUJTU207',
      'STAY',
      'Tk Harry & Sons@ *Obp',
      'Sudah selesai hold',
      'Jakarta',
      '2026-04-06',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-takeout': {
    filename: 'ba-takeout-bulk-template.xlsx',
    headers: [
      'region',
      'takeoutDate',
      'mdsName',
      'mdsCode',
      'status',
      'outlet',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'JTS',
      '2026-02-12',
      'BEASTRICE ARUM SEKARWANGI',
      'MDSUJTS262',
      'STAY',
      'KIOS MERAH*OBP',
      'Toko takeout',
      'Jakarta',
      '2026-03-12',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-terminated': {
    filename: 'ba-terminated-bulk-template.xlsx',
    headers: [
      'region',
      'terminateDate',
      'mdsName',
      'mdsCode',
      'status',
      'outlet',
      'reasons',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'LPB',
      '2026-04-01',
      'REVINKA NOOR ALQAMARIAH',
      'MDSULPB182',
      'STAY',
      'TOKO POM SIMBAL',
      'Alasan 1;Alasan 2',
      'Jakarta',
      '2026-03-31',
      'Adi Anto',
      'Team Leader TEMA Agency',
      'Rizqi Arumdhita',
      'Project Manager Tema Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  },
  'ba-cancel-join': {
    filename: 'ba-cancel-join-bulk-template.xlsx',
    headers: [
      'region',
      'cancelJoinDate',
      'mdsName',
      'mdsCode',
      'status',
      'outlet',
      'reason',
      'location',
      'letterDate',
      'signerLeftName',
      'signerLeftTitle',
      'signerRightName',
      'signerRightTitle',
      'signatureLeftUrl',
      'signatureRightUrl',
      'email',
      'callback_url',
      'callback_header'
    ],
    sample: [
      'SMS',
      '2026-04-17',
      'VINALIA',
      'MDSHSMS114',
      'MOBILE',
      'CAFE SAYANGAN DAN ANA BEERHOUSE',
      'Tidak dapat mengikuti instruksi TL dan ketentuan kerja MDS',
      'Jakarta',
      '2026-04-17',
      'Adi Anto Gustuti',
      'Team Leader TEMA Agency',
      'Nuryah',
      'PIC TEMA Agency',
      'https://example.com/signature-left.png',
      'https://example.com/signature-right.png',
      'user@example.com',
      'https://example.com/callback',
      '{"x-api-key":"demo"}'
    ]
  }
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function buildRows(templateKey) {
  const def = TEMPLATE_DEFINITIONS[templateKey]
  if (!def) {
    throw new Error(`Template '${templateKey}' tidak dikenali`)
  }
  return [def.headers, def.sample]
}

function writeWorkbook(rows, outputPath) {
  ensureDir(outputPath)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, outputPath)
  console.log(`Template written to ${outputPath}`)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  let template = 'payslip'
  let all = false
  let outputDir = path.resolve(path.join('resources', 'templates'))
  let outputPath = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--all') {
      all = true
      continue
    }
    if (arg === '--template' && args[i + 1]) {
      template = String(args[i + 1]).trim().toLowerCase()
      i++
      continue
    }
    if (arg.startsWith('--template=')) {
      template = arg.split('=')[1].trim().toLowerCase()
      continue
    }
    if (arg === '--output-dir' && args[i + 1]) {
      outputDir = path.resolve(args[i + 1])
      i++
      continue
    }
    if (arg.startsWith('--output-dir=')) {
      outputDir = path.resolve(arg.split('=')[1].trim())
      continue
    }
    // Backward compatibility: positional output path
    if (!arg.startsWith('--') && !outputPath) {
      outputPath = path.resolve(arg)
    }
  }

  return { template, all, outputDir, outputPath }
}

function main() {
  const { template, all, outputDir, outputPath } = parseArgs(process.argv)

  if (all) {
    Object.keys(TEMPLATE_DEFINITIONS).forEach((key) => {
      const rows = buildRows(key)
      const target = path.join(outputDir, TEMPLATE_DEFINITIONS[key].filename)
      writeWorkbook(rows, target)
    })
    return
  }

  const rows = buildRows(template)
  const target = outputPath || path.join(outputDir, TEMPLATE_DEFINITIONS[template].filename)
  writeWorkbook(rows, target)
}

main()
