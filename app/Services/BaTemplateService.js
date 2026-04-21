'use strict'

const TEMPLATE_CODES = Object.freeze({
  'ba-penempatan': 'BAP',
  'ba-request-id': 'BARI',
  'ba-hold': 'BAH',
  'ba-rolling': 'BAR',
  'ba-hold-activate': 'BAHA',
  'ba-takeout': 'BAT',
  'ba-terminated': 'BATR',
  'ba-cancel-join': 'BABJ'
})

const MATCH_KEY_FIELDS = Object.freeze({
  'ba-penempatan': ['mdsName', 'outlet'],
  'ba-request-id': ['mdsName', 'area'],
  'ba-hold': ['mdsName', 'region'],
  'ba-rolling': ['mdsName', 'region'],
  'ba-hold-activate': ['mdsName', 'region'],
  'ba-takeout': ['mdsName', 'region'],
  'ba-terminated': ['mdsName', 'region'],
  'ba-cancel-join': ['mdsName', 'region']
})

class BaTemplateService {
  static normalizeTemplate(template) {
    return String(template || '').trim().toLowerCase()
  }

  static isBaTemplate(template) {
    return this.normalizeTemplate(template).startsWith('ba-')
  }

  static getTemplateCode(template) {
    const normalized = this.normalizeTemplate(template)
    return TEMPLATE_CODES[normalized] || 'BA'
  }

  static getSupportedTemplates() {
    return Object.keys(TEMPLATE_CODES)
  }

  static getRequiredMatchFields(template) {
    const normalized = this.normalizeTemplate(template)
    return MATCH_KEY_FIELDS[normalized] ? MATCH_KEY_FIELDS[normalized].slice() : []
  }

  static buildMatchKey(template, values) {
    const fields = this.getRequiredMatchFields(template)
    if (fields.length === 0) return ''
    const parts = fields.map((field) => this.normalizeKeySegment(values && values[field]))
    if (parts.some((part) => !part)) return ''
    return parts.join('|')
  }

  static buildMatchKeyFromPayloadData(template, payloadData) {
    if (!payloadData || typeof payloadData !== 'object') return ''

    const normalized = this.normalizeTemplate(template)
    const values = {
      mdsName: payloadData.mdsName,
      outlet: payloadData.outlet,
      area: payloadData.area,
      region: payloadData.region
    }

    if (normalized === 'ba-request-id' && !values.area && payloadData.region) {
      values.area = payloadData.region
    }
    if (normalized !== 'ba-request-id' && !values.region && payloadData.area) {
      values.region = payloadData.area
    }

    return this.buildMatchKey(normalized, values)
  }

  static extractMatchFieldsFromRow(template, normalizedRow) {
    const row = normalizedRow || {}
    const normalized = this.normalizeTemplate(template)

    const pick = (keys) => {
      for (const key of keys) {
        const value = row[key]
        if (value === undefined || value === null) continue
        if (typeof value === 'string' && value.trim() === '') continue
        return value
      }
      return ''
    }

    const fields = {
      mdsName: pick(['mdsname', 'mds name', 'nama', 'nama mds']),
      outlet: pick(['outlet', 'outlet penempatan', 'toko']),
      area: pick(['area', 'wilayah', 'region']),
      region: pick(['region', 'wilayah', 'area'])
    }

    if (normalized === 'ba-request-id') {
      fields.region = fields.area
    } else {
      fields.area = fields.region
    }

    return fields
  }

  static normalizeKeySegment(value) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\./g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
  }
}

module.exports = BaTemplateService

