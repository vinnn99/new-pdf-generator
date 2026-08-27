'use strict'

const NumberFormatService = use('App/Services/NumberFormatService')

const TEMPLATE = 'cooperation_agreement'
const DEFAULT_COMPANY_NAME = 'PT. ORIGIN MAGDA INOVASI'
const ROMAN_MONTH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const REQUIRED_FIELDS = Object.freeze([
  'firstPartyName',
  'firstPartyTitle',
  'partnerName',
  'partnerNationality',
  'partnerIdentityNumber',
  'partnerBirthPlace',
  'partnerBirthDate',
  'partnerAddress',
  'partnerPhone',
  'partnerEmail',
  'brand',
  'salary',
  'partnerBankAccountNumber',
  'partnerBankAccountName',
  'partnerBankName',
  'agreementDuration',
  'workHoursPerDay',
  'placementArea',
  'picName',
  'picTitle',
  'picEmail',
  'picAddress'
])

const MONEY_FIELDS = Object.freeze([
  ['salary', 'salary/gaji'],
  ['transportAllowance', 'tunjangan transport'],
  ['mealAllowance', 'tunjangan makan'],
  ['phoneAllowance', 'tunjangan pulsa'],
  ['operationalCostAllowance', 'tunjangan biaya operasional'],
  ['tlAllowance', 'tunjangan TL']
])

class CooperationAgreementService {
  static get TEMPLATE() {
    return TEMPLATE
  }

  static get DEFAULT_COMPANY_NAME() {
    return DEFAULT_COMPANY_NAME
  }

  static requiredFields() {
    return REQUIRED_FIELDS.slice()
  }

  static isTemplate(template) {
    return String(template || '').trim().toLowerCase() === TEMPLATE
  }

  static normalizeData(data = {}) {
    const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    const out = { ...source }

    alias(out, 'companyName', ['namaPerusahaan', 'nama perusahaan', 'company_name'])
    alias(out, 'firstPartyName', ['pihak1Nama', 'pihak 1 nama', 'first_party_name'])
    alias(out, 'firstPartyTitle', ['pihak1Jabatan', 'pihak 1 jabatan', 'first_party_title'])
    alias(out, 'partnerName', ['mitraNama', 'mitra nama', 'partner_name'])
    alias(out, 'partnerNationality', ['mitraWargaNegara', 'mitra warga negara', 'partner_nationality'])
    alias(out, 'partnerIdentityNumber', ['mitraId', 'mitra id', 'ktp', 'sim', 'partner_identity_number'])
    alias(out, 'partnerBirthPlace', ['mitraTempatLahir', 'mitra tempat lahir', 'partner_birth_place'])
    alias(out, 'partnerBirthDate', ['mitraTanggalLahir', 'mitra tanggal lahir', 'partner_birth_date'])
    alias(out, 'partnerAddress', ['mitraAlamat', 'mitra alamat', 'partner_address'])
    alias(out, 'partnerPhone', ['mitraPhone', 'mitra no telp/hp', 'partner_phone'])
    alias(out, 'partnerEmail', ['mitraEmail', 'mitra email', 'partner_email'])
    alias(out, 'brand', ['BRAND'])
    alias(out, 'salary', ['gaji', 'salary/gaji'])
    alias(out, 'transportAllowance', ['tunjanganTransport', 'tunjangan transport'])
    alias(out, 'mealAllowance', ['tunjanganMakan', 'tunjangan makan'])
    alias(out, 'phoneAllowance', ['tunjanganPulsa', 'tunjangan pulsa'])
    alias(out, 'operationalCostAllowance', ['tunjanganBiayaOperasional', 'tunjangan biaya operasional', 'biayaOperasionalAllowance', 'biaya operasional'])
    alias(out, 'tlAllowance', ['tunjanganTl', 'tunjanganTL', 'tunjangan tl', 'tunjangan TL'])
    alias(out, 'partnerBankAccountNumber', ['nomorRekeningMitra', 'nomor rekening mitra'])
    alias(out, 'partnerBankAccountName', ['namaRekeningMitra', 'nama rekening mitra'])
    alias(out, 'partnerBankName', ['namaBankMitra', 'nama bank mitra'])
    alias(out, 'agreementDuration', ['lamaPerjanjian', 'lama perjanjian'])
    alias(out, 'workHoursPerDay', ['jamKerjaPerHari', 'jam kerja per hari'])
    alias(out, 'placementArea', ['wilayahPenempatan', 'wilayah penempatan'])
    alias(out, 'picName', ['namaPic', 'nama pic'])
    alias(out, 'picTitle', ['jabatanPic', 'jabatan pic'])
    alias(out, 'picEmail', ['emailPic', 'email pic'])
    alias(out, 'picAddress', ['alamatPic', 'alamat pic'])
    alias(out, 'logoUrl', ['logo', 'logo url', 'logo_url', 'logoFile', 'logo file', 'logo_file', 'companyLogoUrl', 'company logo url', 'company_logo_url'])
    alias(out, 'logoPath', ['logo path', 'logo_path', 'logoFilePath', 'logo file path', 'logo_file_path', 'companyLogoPath', 'company logo path', 'company_logo_path'])
    alias(out, 'directorSignatureUrl', ['signatureDirectorUrl', 'signature direktur'])
    alias(out, 'partnerSignatureUrl', ['signatureMitraUrl', 'signature mitra'])

    if (!hasValue(out.companyName)) out.companyName = DEFAULT_COMPANY_NAME

    for (const [field, label] of MONEY_FIELDS) {
      if (hasValue(out[field])) out[field] = NumberFormatService.parseInteger(out[field], { fieldName: label })
    }

    if (hasValue(out.agreementDuration)) {
      NumberFormatService.formatNumberWithWords(out.agreementDuration, {
        unit: 'bulan',
        fieldName: 'lama perjanjian'
      })
    }
    if (hasValue(out.workHoursPerDay)) {
      NumberFormatService.formatNumberWithWords(out.workHoursPerDay, {
        unit: 'jam',
        suffix: 'per hari',
        fieldName: 'jam kerja per hari'
      })
    }

    if (out.directorSignatureUrl && !out.signatureLeftUrl) out.signatureLeftUrl = out.directorSignatureUrl
    if (out.partnerSignatureUrl && !out.signatureRightUrl) out.signatureRightUrl = out.partnerSignatureUrl
    if (out.signatureLeftUrl && !out.directorSignatureUrl) out.directorSignatureUrl = out.signatureLeftUrl
    if (out.signatureRightUrl && !out.partnerSignatureUrl) out.partnerSignatureUrl = out.signatureRightUrl

    return out
  }

  static validateData(data = {}) {
    const errors = []
    const normalized = data && typeof data === 'object' && !Array.isArray(data) ? data : {}

    for (const field of REQUIRED_FIELDS) {
      if (!hasValue(normalized[field])) errors.push(`Field data.${field} is required`)
    }

    for (const [field, label] of MONEY_FIELDS) {
      if (!hasValue(normalized[field])) continue
      try {
        NumberFormatService.parseInteger(normalized[field], { fieldName: label })
      } catch (error) {
        errors.push(error.message)
      }
    }

    for (const [field, label, unit, suffix] of [
      ['agreementDuration', 'lama perjanjian', 'bulan', ''],
      ['workHoursPerDay', 'jam kerja per hari', 'jam', 'per hari']
    ]) {
      if (!hasValue(normalized[field])) continue
      try {
        NumberFormatService.formatNumberWithWords(normalized[field], { fieldName: label, unit, suffix })
      } catch (error) {
        errors.push(error.message)
      }
    }

    return errors
  }

  static buildPreviewLetterNo(now = new Date()) {
    const parts = getDateParts(now)
    return `PREVIEW/HRD-OMI/PKM/${parts.romanMonth}/${parts.year}`
  }

  static buildMatchKey(payloadData) {
    const data = payloadData || {}
    const parts = [
      data.partnerName,
      data.partnerEmail || data.partnerIdentityNumber
    ].map(normalizeSegment)
    return parts.some((part) => !part) ? '' : parts.join('|')
  }
}

function alias(target, canonical, aliases) {
  if (hasValue(target[canonical])) return
  for (const key of aliases) {
    if (hasValue(target[key])) {
      target[canonical] = target[key]
      return
    }
  }
}

function hasValue(value) {
  return !(value === undefined || value === null || (typeof value === 'string' && !value.trim()))
}

function normalizeSegment(value) {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\./g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getDateParts(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const monthNumber = date.getMonth() + 1
  return {
    year: String(date.getFullYear()),
    romanMonth: ROMAN_MONTH[Math.min(Math.max(monthNumber, 1), 12) - 1]
  }
}

module.exports = CooperationAgreementService
