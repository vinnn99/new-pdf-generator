'use strict'

/**
 * Generate Excel template for bulk payslip generation.
 *
 * Usage:
 *   node scripts/create-bulk-template.js [outputPath]
 *
 * Default output: resources/templates/payslip-bulk-template.xlsx
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const outputArg = process.argv[2]
const defaultPath = path.join('resources', 'templates', 'payslip-bulk-template.xlsx')
const outputPath = outputArg ? path.resolve(outputArg) : path.resolve(defaultPath)

const rows = [
  [
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
    'PPH 21'
  ],
  [
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
    250000
  ]
]

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function main() {
  ensureDir(outputPath)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, outputPath)
  console.log(`Template written to ${outputPath}`)
}

main()
