'use strict'

const SMALL = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas'
]

class NumberFormatService {
  static parseInteger(value, { fieldName = 'nilai', allowZero = true } = {}) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`${fieldName} wajib diisi`)
    }

    let number
    if (typeof value === 'number') {
      number = value
    } else {
      const raw = String(value).trim()
      if (!raw) throw new Error(`${fieldName} wajib diisi`)
      if (/^-/.test(raw)) throw new Error(`${fieldName} tidak boleh negatif`)

      let cleaned = raw
        .replace(/rp\.?/gi, '')
        .replace(/rupiah/gi, '')
        .replace(/\s+/g, '')

      if (!cleaned) throw new Error(`${fieldName} wajib diisi`)
      if (/[^0-9.,]/.test(cleaned)) {
        throw new Error(`${fieldName} hanya boleh berisi angka`)
      }

      if (hasDecimalPart(cleaned)) {
        throw new Error(`${fieldName} harus bilangan bulat tanpa desimal`)
      }

      cleaned = cleaned.replace(/[.,]/g, '')
      if (!/^\d+$/.test(cleaned)) {
        throw new Error(`${fieldName} hanya boleh berisi angka`)
      }

      number = Number(cleaned)
    }

    if (!Number.isFinite(number)) throw new Error(`${fieldName} tidak valid`)
    if (!Number.isInteger(number)) throw new Error(`${fieldName} harus bilangan bulat tanpa desimal`)
    if (!allowZero && number <= 0) throw new Error(`${fieldName} harus lebih dari 0`)
    if (number < 0) throw new Error(`${fieldName} tidak boleh negatif`)
    if (!Number.isSafeInteger(number)) throw new Error(`${fieldName} terlalu besar`)
    return number
  }

  static formatThousands(value) {
    const number = this.parseInteger(value, { fieldName: 'nilai' })
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  static toWords(value) {
    const number = this.parseInteger(value, { fieldName: 'nilai' })
    return integerToWords(number)
  }

  static toWordsTitle(value) {
    return capitalizeFirst(this.toWords(value))
  }

  static formatRupiahWithWords(value, fieldName = 'nilai uang') {
    const number = this.parseInteger(value, { fieldName })
    return `Rp. ${this.formatThousands(number)} (${this.toWordsTitle(number)} rupiah)`
  }

  static formatNumberWithWords(value, { unit = '', suffix = '', fieldName = 'nilai' } = {}) {
    const number = extractLeadingInteger(value, fieldName)
    const parts = [`${number}`, `(${this.toWords(number)})`]
    if (unit) parts.push(unit)
    if (suffix) parts.push(suffix)
    return parts.join(' ')
  }
}

function hasDecimalPart(value) {
  const str = String(value || '')
  if (/,\d{1,2}$/.test(str)) return true
  if (/\.\d{1,2}$/.test(str) && !/\.\d{3}$/.test(str)) return true
  return false
}

function extractLeadingInteger(value, fieldName) {
  if (typeof value === 'number') {
    return NumberFormatService.parseInteger(value, { fieldName, allowZero: false })
  }
  const raw = String(value === undefined || value === null ? '' : value).trim()
  const match = raw.match(/\d+/)
  if (!match) throw new Error(`${fieldName} wajib berisi angka`)
  return NumberFormatService.parseInteger(match[0], { fieldName, allowZero: false })
}

function integerToWords(number) {
  const n = Number(number)
  if (n < 12) return SMALL[n]
  if (n < 20) return `${integerToWords(n - 10)} belas`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const rest = n % 10
    return rest ? `${integerToWords(tens)} puluh ${integerToWords(rest)}` : `${integerToWords(tens)} puluh`
  }
  if (n < 200) {
    const rest = n - 100
    return rest ? `seratus ${integerToWords(rest)}` : 'seratus'
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    return rest ? `${integerToWords(hundreds)} ratus ${integerToWords(rest)}` : `${integerToWords(hundreds)} ratus`
  }
  if (n < 2000) {
    const rest = n - 1000
    return rest ? `seribu ${integerToWords(rest)}` : 'seribu'
  }

  const scales = [
    { value: 1000000000000, label: 'triliun' },
    { value: 1000000000, label: 'miliar' },
    { value: 1000000, label: 'juta' },
    { value: 1000, label: 'ribu' }
  ]

  for (const scale of scales) {
    if (n >= scale.value) {
      const major = Math.floor(n / scale.value)
      const rest = n % scale.value
      const majorWords = `${integerToWords(major)} ${scale.label}`
      return rest ? `${majorWords} ${integerToWords(rest)}` : majorWords
    }
  }

  return String(n)
}

function capitalizeFirst(value) {
  const str = String(value || '').trim()
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = NumberFormatService
