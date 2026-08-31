'use strict'

const Database = use('Database')
const CooperationAgreementService = use('App/Services/CooperationAgreementService')

const DEFAULT_TIMEZONE = 'Asia/Jakarta'
const ROMAN_MONTH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

class CooperationAgreementLetterNoService {
  static get DEFAULT_TIMEZONE() {
    return DEFAULT_TIMEZONE
  }

  static async nextLetterNo({ companyId, createdBy = null, trx = null, template = CooperationAgreementService.TEMPLATE } = {}) {
    if (!companyId) throw new Error('companyId wajib diisi untuk generate nomor PKM')

    const requestedTemplate = String(template || CooperationAgreementService.TEMPLATE).trim().toLowerCase()
    const isExel = requestedTemplate === CooperationAgreementService.EXEL_TEMPLATE

    const run = async (trxLocal) => {
      const now = new Date()
      const company = await trxLocal.table('companies').where('company_id', companyId).first()
      if (!company) throw new Error('Company tidak ditemukan')

      const counterFilter = { company_id: companyId, template: requestedTemplate }
      let counterRow = await trxLocal.table('company_pkm_numbering_counters').where(counterFilter).forUpdate().first()
      if (!counterRow) {
        try {
          await trxLocal.table('company_pkm_numbering_counters').insert({
            company_id: companyId,
            template: requestedTemplate,
            last_seq: 0,
            created_by: createdBy || null,
            created_at: now,
            updated_at: now
          })
        } catch (error) {
          if (!isUniqueError(error)) throw error
        }
        counterRow = await trxLocal.table('company_pkm_numbering_counters').where(counterFilter).forUpdate().first()
      }
      if (!counterRow) throw new Error('Counter PKM tidak dapat diinisialisasi')

      const currentSeq = Number(counterRow.last_seq) || 0
      const nextSeq = currentSeq + 1
      await trxLocal.table('company_pkm_numbering_counters').where(counterFilter).update({
        last_seq: nextSeq,
        updated_at: now
      })

      const dateParts = getDateParts(DEFAULT_TIMEZONE)
      const officeCode = isExel ? 'HRD-EIS' : 'HRD-OMI'
      return {
        letterNo: `${nextSeq}/${officeCode}/PKM/${dateParts.romanMonth}/${dateParts.year}`,
        seq: nextSeq,
        template: requestedTemplate,
        timezone: DEFAULT_TIMEZONE,
        officeCode
      }
    }

    if (trx) return run(trx)
    return Database.transaction(run)
  }
}

function getDateParts(timezone) {
  const now = new Date()
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  })
  const parts = dtf.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')
  const month = parts.find((p) => p.type === 'month')
  const monthNumber = Number(month && month.value) || 1

  return {
    year: year ? year.value : String(now.getFullYear()),
    romanMonth: ROMAN_MONTH[Math.min(Math.max(monthNumber, 1), 12) - 1]
  }
}

function isUniqueError(error) {
  const msg = String((error && error.message) || '').toLowerCase()
  return msg.includes('unique') || msg.includes('duplicate')
}

module.exports = CooperationAgreementLetterNoService
