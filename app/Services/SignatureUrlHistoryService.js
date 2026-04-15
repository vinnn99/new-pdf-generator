'use strict'

const Database = use('Database')

class SignatureUrlHistoryService {
  static async recordFromPayload({ companyId, createdBy = null, payloadData, trx = null, usedAt = new Date() } = {}) {
    const urls = this.extractFromPayload(payloadData)
    return this.recordUrls({ companyId, createdBy, urls, trx, usedAt })
  }

  static async recordUrls({ companyId, createdBy = null, urls = [], trx = null, usedAt = new Date() } = {}) {
    const ownerCompanyId = toPositiveInt(companyId)
    if (!ownerCompanyId) return { upserted: 0, skipped: 0 }

    const candidates = Array.isArray(urls) ? urls : [urls]
    const preparedByNormalized = new Map()
    let skipped = 0

    for (const candidate of candidates) {
      const parsedEntry = toHistoryEntry(candidate)
      if (!parsedEntry.rawUrl) continue

      const normalized = this.normalizeHttpUrl(parsedEntry.rawUrl)
      if (!normalized) {
        skipped += 1
        continue
      }

      if (preparedByNormalized.has(normalized)) {
        const current = preparedByNormalized.get(normalized)
        current.rawUrl = parsedEntry.rawUrl || current.rawUrl
        if (!current.name && parsedEntry.name) current.name = parsedEntry.name
        if (!current.title && parsedEntry.title) current.title = parsedEntry.title
        preparedByNormalized.set(normalized, current)
        continue
      }

      preparedByNormalized.set(normalized, {
        rawUrl: parsedEntry.rawUrl,
        normalizedUrl: normalized,
        name: parsedEntry.name,
        title: parsedEntry.title
      })
    }

    const sanitized = Array.from(preparedByNormalized.values())
    if (!sanitized.length) return { upserted: 0, skipped }

    let upserted = 0
    const runner = async (trxLocal) => {
      for (const item of sanitized) {
        await this._upsertOne({
          trx: trxLocal,
          companyId: ownerCompanyId,
          createdBy,
          rawUrl: item.rawUrl,
          normalizedUrl: item.normalizedUrl,
          name: item.name,
          title: item.title,
          usedAt
        })
        upserted += 1
      }
    }

    if (trx) await runner(trx)
    else await Database.transaction(runner)

    return { upserted, skipped }
  }

  static extractFromPayload(payloadData) {
    if (!payloadData || typeof payloadData !== 'object') return []
    return [
      {
        url: payloadData.signatureLeftUrl,
        name: payloadData.signerLeftName,
        title: payloadData.signerLeftTitle
      },
      {
        url: payloadData.signatureRightUrl,
        name: payloadData.signerRightName,
        title: payloadData.signerRightTitle
      }
    ]
  }

  static normalizeHttpUrl(value) {
    const raw = cleanRawUrl(value)
    if (!raw) return null

    try {
      const parsed = new URL(raw)
      const protocol = String(parsed.protocol || '').toLowerCase()
      if (protocol !== 'http:' && protocol !== 'https:') return null

      parsed.protocol = protocol
      parsed.hostname = String(parsed.hostname || '').toLowerCase()

      if ((protocol === 'http:' && parsed.port === '80') || (protocol === 'https:' && parsed.port === '443')) {
        parsed.port = ''
      }

      parsed.hash = ''
      if (parsed.pathname && parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.replace(/\/+$/g, '')
      }

      if (parsed.searchParams && typeof parsed.searchParams.sort === 'function') {
        parsed.searchParams.sort()
      }

      return parsed.toString()
    } catch (error) {
      return null
    }
  }

  static async _upsertOne({ trx, companyId, createdBy = null, rawUrl, normalizedUrl, name = null, title = null, usedAt = new Date() }) {
    const now = new Date()
    const table = 'company_signature_urls'
    const filter = {
      company_id: companyId,
      url_normalized: normalizedUrl
    }

    const existing = await trx.table(table).where(filter).first()
    if (existing) {
      await trx.table(table)
        .where('id', existing.id)
        .update({
          url: rawUrl,
          name: name || existing.name || null,
          title: title || existing.title || null,
          last_used_at: usedAt,
          use_count: Number(existing.use_count || 0) + 1,
          updated_at: now
        })
      return existing.id
    }

    try {
      const inserted = await trx.table(table).insert({
        company_id: companyId,
        url: rawUrl,
        url_normalized: normalizedUrl,
        name: name || null,
        title: title || null,
        last_used_at: usedAt,
        use_count: 1,
        created_by: toPositiveInt(createdBy),
        created_at: now,
        updated_at: now
      })
      return Array.isArray(inserted) ? inserted[0] : inserted
    } catch (error) {
      if (!isUniqueError(error)) throw error

      const raced = await trx.table(table).where(filter).first()
      if (!raced) throw error

      await trx.table(table)
        .where('id', raced.id)
        .update({
          url: rawUrl,
          name: name || raced.name || null,
          title: title || raced.title || null,
          last_used_at: usedAt,
          use_count: Number(raced.use_count || 0) + 1,
          updated_at: now
        })
      return raced.id
    }
  }
}

function cleanRawUrl(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim().replace(/\s+/g, '')
}

function cleanLabel(value) {
  if (value === undefined || value === null) return null
  const label = String(value).trim()
  return label || null
}

function toHistoryEntry(candidate) {
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return {
      rawUrl: cleanRawUrl(candidate.url),
      name: cleanLabel(candidate.name),
      title: cleanLabel(candidate.title)
    }
  }

  return {
    rawUrl: cleanRawUrl(candidate),
    name: null,
    title: null
  }
}

function toPositiveInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function isUniqueError(error) {
  const message = String((error && error.message) || '').toLowerCase()
  return message.includes('unique') || message.includes('duplicate')
}

module.exports = SignatureUrlHistoryService
