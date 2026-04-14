'use strict'

class CompanyCodeService {
  static normalize(value) {
    if (value === undefined || value === null) return ''
    return String(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20)
  }

  static fromName(name) {
    const words = String(name || '')
      .toUpperCase()
      .match(/[A-Z0-9]+/g) || []

    const initials = words.map((word) => word.charAt(0)).join('')
    const normalized = this.normalize(initials)
    return normalized || 'COMP'
  }

  static resolve(code, companyName) {
    const normalizedCode = this.normalize(code)
    if (normalizedCode) return normalizedCode
    return this.fromName(companyName)
  }
}

module.exports = CompanyCodeService
