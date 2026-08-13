'use strict'

const ExcelDateService = require('./ExcelDateService')

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

class SlipPeriodService {
  static normalize(value) {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined

    const parsed = parseExcelSerialPeriod(value)
    if (parsed) return formatMonthYear(parsed)

    return value
  }
}

function parseExcelSerialPeriod(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1 }
  }

  let serial = null
  if (typeof value === 'number') {
    serial = value
  } else if (typeof value === 'string') {
    const str = value.trim()
    if (/^\d{5}(\.\d+)?$/.test(str)) serial = Number(str)
  }

  if (serial === null || !isLikelyPayrollExcelSerial(serial)) return null

  const ymd = ExcelDateService.parse(serial)
  const match = String(ymd || '').match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!match) return null

  return { year: Number(match[1]), month: Number(match[2]) }
}

function isLikelyPayrollExcelSerial(value) {
  return Number.isFinite(value) && value >= 20000 && value <= 60000
}

function formatMonthYear({ year, month }) {
  const monthName = MONTHS_ID[Number(month) - 1]
  if (!year || !monthName) return ''
  return `${monthName} ${year}`
}

module.exports = SlipPeriodService
