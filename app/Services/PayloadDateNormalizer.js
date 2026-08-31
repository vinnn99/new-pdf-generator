'use strict'

const ExcelDateService = require('./ExcelDateService')

const DATE_FIELDS_BY_TEMPLATE = Object.freeze({
  payslip: ['joinDate'],
  insentif: ['joinDate'],
  thr: ['joinDate', 'payoutDate'],
  event_weekly_payslip: ['joinDate'],
  'ba-penempatan': ['birthDate', 'placementDate', 'letterDate'],
  'ba-request-id': ['birthDate', 'joinDate', 'letterDate'],
  'ba-hold': ['holdDate', 'letterDate'],
  'ba-rolling': ['rollingDate', 'letterDate'],
  'ba-hold-activate': ['reactivateDate', 'letterDate'],
  'ba-takeout': ['takeoutDate', 'letterDate'],
  'ba-terminated': ['terminateDate', 'letterDate'],
  'ba-cancel-join': ['cancelJoinDate', 'letterDate'],
  'ba-resign': ['birthDate', 'effectiveResignDate', 'letterDate'],
  cooperation_agreement: ['letterDate', 'partnerBirthDate'],
  exel_cooperation_agreement: ['letterDate', 'partnerBirthDate']
})

class PayloadDateNormalizer {
  static normalize({ template, data } = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data

    const normalizedTemplate = String(template || '').trim().toLowerCase()
    const fields = DATE_FIELDS_BY_TEMPLATE[normalizedTemplate] || []
    if (!fields.length) return { ...data }

    const out = { ...data }
    for (const field of fields) {
      if (out[field] === undefined || out[field] === null || out[field] === '') continue
      out[field] = ExcelDateService.parse(out[field])
    }

    return out
  }
}

module.exports = PayloadDateNormalizer
