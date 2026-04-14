'use strict'

const Database = use('Database')
const BaTemplateService = use('App/Services/BaTemplateService')
const CompanyCodeService = use('App/Services/CompanyCodeService')

const DEFAULT_PATTERN = '{seq}/{CompanyCode}/{templateCode}/{romanMonth}/{Year}'
const LEGACY_DEFAULT_PATTERNS = [
  '{seq:04}/{templateCode}/{romanMonth}/{year}',
  '{seq:04}/{templateCode}/{romanMonth}/{Year}'
]
const DEFAULT_TIMEZONE = 'Asia/Jakarta'
const ROMAN_MONTH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

class BaLetterNoService {
  static get DEFAULT_PATTERN() {
    return DEFAULT_PATTERN
  }

  static get DEFAULT_TIMEZONE() {
    return DEFAULT_TIMEZONE
  }

  static async nextLetterNo({ companyId, template, createdBy = null, trx = null } = {}) {
    const normalizedTemplate = BaTemplateService.normalizeTemplate(template)
    if (!companyId) throw new Error('companyId wajib diisi untuk generate letterNo BA')
    if (!BaTemplateService.isBaTemplate(normalizedTemplate)) {
      throw new Error(`Template '${template}' bukan template BA`)
    }

    const run = async (trxLocal) => {
      const now = new Date()
      await this._ensureSetting(trxLocal, companyId, createdBy, now)
      const company = await trxLocal.table('companies').where('company_id', companyId).first()
      if (!company) throw new Error('Company tidak ditemukan')

      const storedCompanyCode = CompanyCodeService.normalize(company.code)
      const companyCode = CompanyCodeService.resolve(storedCompanyCode, company.name)
      if (!storedCompanyCode || storedCompanyCode !== companyCode) {
        await trxLocal.table('companies')
          .where('company_id', companyId)
          .update({
            code: companyCode,
            updated_at: now
          })
      }

      const counterFilter = { company_id: companyId, template: normalizedTemplate }
      let counterRow = await trxLocal.table('company_ba_numbering_counters').where(counterFilter).forUpdate().first()
      if (!counterRow) {
        try {
          await trxLocal.table('company_ba_numbering_counters').insert({
            company_id: companyId,
            template: normalizedTemplate,
            last_seq: 0,
            created_at: now,
            updated_at: now
          })
        } catch (error) {
          if (!isUniqueError(error)) throw error
        }
        counterRow = await trxLocal.table('company_ba_numbering_counters').where(counterFilter).forUpdate().first()
      }
      if (!counterRow) throw new Error('Counter BA tidak dapat diinisialisasi')

      const currentSeq = Number(counterRow && counterRow.last_seq) || 0
      const nextSeq = currentSeq + 1
      await trxLocal.table('company_ba_numbering_counters').where(counterFilter).update({
        last_seq: nextSeq,
        updated_at: now
      })

      const seq = nextSeq

      const setting = await trxLocal.table('company_ba_numbering_settings').where('company_id', companyId).first()
      let pattern = (setting && setting.format_pattern) || DEFAULT_PATTERN
      if (isLegacyDefaultPattern(pattern)) {
        pattern = DEFAULT_PATTERN
        const updatePayload = {
          format_pattern: DEFAULT_PATTERN,
          updated_at: now
        }
        if (createdBy) updatePayload.updated_by = createdBy
        await trxLocal.table('company_ba_numbering_settings')
          .where('company_id', companyId)
          .update(updatePayload)
      }
      const timezone = DEFAULT_TIMEZONE

      const dateParts = getDateParts(timezone)
      const templateCode = BaTemplateService.getTemplateCode(normalizedTemplate)
      const letterNo = renderPattern(pattern, {
        seq,
        year: dateParts.year,
        month: dateParts.month,
        romanMonth: dateParts.romanMonth,
        companyCode,
        templateCode,
        template: normalizedTemplate
      })

      return {
        letterNo,
        seq,
        template: normalizedTemplate,
        templateCode,
        pattern,
        timezone
      }
    }

    if (trx) return run(trx)
    return Database.transaction(run)
  }

  static async _ensureSetting(trx, companyId, createdBy, now) {
    const existing = await trx.table('company_ba_numbering_settings').where('company_id', companyId).first()
    if (existing) return existing

    try {
      await trx.table('company_ba_numbering_settings').insert({
        company_id: companyId,
        format_pattern: DEFAULT_PATTERN,
        timezone: DEFAULT_TIMEZONE,
        created_by: createdBy || null,
        updated_by: createdBy || null,
        created_at: now,
        updated_at: now
      })
    } catch (error) {
      if (!isUniqueError(error)) throw error
    }

    return trx.table('company_ba_numbering_settings').where('company_id', companyId).first()
  }
}

function renderPattern(pattern, context) {
  const tmpl = String(pattern || DEFAULT_PATTERN)

  const seqRendered = tmpl.replace(/\{seq(?::(\d+))?\}/gi, (_, widthRaw) => {
    const width = Number(widthRaw) || 0
    const raw = String(context.seq || 0)
    return width > 0 ? raw.padStart(width, '0') : raw
  })

  return seqRendered
    .replace(/\{CompanyCode\}/gi, String(context.companyCode || 'COMP'))
    .replace(/\{templateCode\}/gi, String(context.templateCode || 'BA'))
    .replace(/\{template\}/gi, String(context.template || 'ba'))
    .replace(/\{romanMonth\}/gi, String(context.romanMonth || 'I'))
    .replace(/\{year\}/gi, String(context.year || '1970'))
    .replace(/\{month\}/gi, String(context.month || '01'))
}

function getDateParts(timezone) {
  const tz = timezone || DEFAULT_TIMEZONE
  const now = new Date()
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit'
  })
  const parts = dtf.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')
  const month = parts.find((p) => p.type === 'month')
  const monthNumber = Number(month && month.value) || 1

  return {
    year: year ? year.value : String(now.getFullYear()),
    month: String(monthNumber).padStart(2, '0'),
    romanMonth: ROMAN_MONTH[Math.min(Math.max(monthNumber, 1), 12) - 1]
  }
}

function isUniqueError(error) {
  const msg = String((error && error.message) || '').toLowerCase()
  return msg.includes('unique') || msg.includes('duplicate')
}

function isLegacyDefaultPattern(pattern) {
  const normalized = String(pattern || '').trim().toLowerCase()
  return LEGACY_DEFAULT_PATTERNS.some((item) => normalized === item.toLowerCase())
}

module.exports = BaLetterNoService
