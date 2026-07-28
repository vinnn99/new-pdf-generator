'use strict'

const XLSX = require('xlsx')

class ExcelDateService {
  static parse(value) {
    if (value === undefined || value === null) return undefined
    if (value === '') return undefined

    if (typeof value === 'number') {
      return parseSerial(value)
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return toYmd(value.getFullYear(), value.getMonth() + 1, value.getDate())
    }

    const str = String(value).trim()
    if (!str) return undefined

    let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (match) return toYmd(Number(match[1]), Number(match[2]), Number(match[3]))

    match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
    if (match) {
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
      return toYmd(year, Number(match[2]), Number(match[1]))
    }

    if (/^\d{5}(\.\d+)?$/.test(str)) {
      return parseSerial(Number(str)) || str
    }

    return str
  }
}

function parseSerial(value) {
  if (!Number.isFinite(value) || value <= 0) return undefined

  const parsed = XLSX.SSF && XLSX.SSF.parse_date_code
    ? XLSX.SSF.parse_date_code(value)
    : null

  if (parsed && parsed.y && parsed.m && parsed.d) {
    return toYmd(parsed.y, parsed.m, parsed.d)
  }

  return undefined
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toYmd(year, month, day) {
  if (!year || !month || !day) return ''
  return `${year}-${pad2(month)}-${pad2(day)}`
}

module.exports = ExcelDateService
