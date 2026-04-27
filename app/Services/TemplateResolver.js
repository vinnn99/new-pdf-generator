'use strict'

const Database = use('Database')
const fs = require('fs')
const path = require('path')

const LEGACY_REQUIRED_FIELDS = {
  musik: [
    'nama', 'judul', 'nik', 'address', 'pt',
    'pencipta', 'asNama', 'bankName', 'npwp',
    'imail', 'phone', 'norek'
  ],
  invoice: ['clientName', 'items'],
  thr: ['employeeName', 'position', 'period', 'payoutDate', 'baseSalary'],
  payslip: ['employeeName', 'position', 'period'],
  insentif: ['employeeName', 'position', 'period'],
  'ba-penempatan': ['letterNo', 'mdsName', 'nik', 'placementDate', 'outlet'],
  'ba-request-id': ['letterNo', 'mdsName', 'nik', 'joinDate'],
  'ba-hold': ['letterNo', 'region', 'holdDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
  'ba-rolling': ['letterNo', 'region', 'rollingDate', 'mdsName', 'mdsCode', 'status', 'outletFrom', 'outletTo'],
  'ba-hold-activate': ['letterNo', 'region', 'reactivateDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
  'ba-takeout': ['letterNo', 'region', 'takeoutDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
  'ba-terminated': ['letterNo', 'region', 'terminateDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
  'ba-cancel-join': ['letterNo', 'region', 'cancelJoinDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
}

class TemplateResolver {
  static async resolve(templateKey, { companyId } = {}) {
    if (!templateKey || typeof templateKey !== 'string') return null

    const normalizedCompanyId = toCompanyId(companyId)
    const dynamic = await this._findDynamicTemplate(templateKey, normalizedCompanyId)
    if (dynamic) {
      return {
        source: 'dynamic',
        templateKey,
        requiredFields: dynamic.requiredFields,
        templateRecord: dynamic
      }
    }

    const legacy = this._findLegacyTemplate(templateKey)
    if (!legacy) return null

    return {
      source: 'legacy',
      templateKey,
      requiredFields: LEGACY_REQUIRED_FIELDS[templateKey] || [],
      templateFunction: legacy
    }
  }

  static validateRequiredFields(payloadData, requiredFields) {
    const errors = []
    const list = Array.isArray(requiredFields) ? requiredFields : []
    const data = payloadData && typeof payloadData === 'object' ? payloadData : {}
    for (const fieldPath of list) {
      if (!fieldPath) continue
      const value = getByPath(data, fieldPath)
      if (isMissing(value)) errors.push(`Field data.${fieldPath} is required`)
    }
    return errors
  }

  static renderDynamicDocDefinition(templateRecord, payloadData) {
    const data = payloadData && typeof payloadData === 'object' ? payloadData : {}
    if (!templateRecord || typeof templateRecord !== 'object') {
      throw new Error('Dynamic template record tidak valid')
    }
    const doc = templateRecord.contentObject
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      throw new Error('Dynamic template content_json harus object JSON (docDefinition)')
    }
    const interpolated = deepInterpolate(doc, data)
    return normalizePdfmakeLayout(interpolated)
  }

  static async listDynamicTemplates({ includeInactive = false, companyId } = {}) {
    const query = Database.table('dynamic_templates')
      .select(
        'id',
        'template_key',
        'name',
        'company_id',
        'source_type',
        'is_active',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at'
      )
      .orderBy('template_key', 'asc')
      .orderBy('company_id', 'asc')

    if (!includeInactive) query.where('is_active', true)

    if (companyId === null) {
      query.whereNull('company_id')
    } else if (companyId !== undefined) {
      const cid = toCompanyId(companyId)
      query.where((qb) => {
        qb.where('company_id', cid).orWhereNull('company_id')
      })
    }

    return query
  }

  static async listTemplateKeys({ includeInactive = false, companyId } = {}) {
    const staticKeys = this.listLegacyTemplateKeys()
    const dynamicRows = await this.listDynamicTemplates({ includeInactive, companyId })
    const dynamicKeys = dynamicRows.map((row) => row.template_key).filter(Boolean)
    return uniq(staticKeys.concat(dynamicKeys))
  }

  static listLegacyTemplateKeys() {
    const dir = path.join(process.cwd(), 'resources', 'pdf-templates')
    try {
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .map((f) => path.basename(f, '.js'))
        .sort()
    } catch (e) {
      return []
    }
  }

  static _findLegacyTemplate(templateKey) {
    const filePath = path.join(process.cwd(), 'resources', 'pdf-templates', `${templateKey}.js`)
    if (!fs.existsSync(filePath)) return null
    try {
      const templateFn = require(filePath)
      if (typeof templateFn !== 'function') return null
      return templateFn
    } catch (error) {
      throw new Error(`Template '${templateKey}' not found: ${error.message}`)
    }
  }

  static async _findDynamicTemplate(templateKey, companyId) {
    const query = Database.table('dynamic_templates')
      .where('template_key', templateKey)
      .where('is_active', true)
      .where((qb) => {
        if (companyId) {
          qb.where('company_id', companyId).orWhereNull('company_id')
          return
        }
        qb.whereNull('company_id')
      })
      .orderByRaw('company_id IS NULL ASC')
      .orderBy('id', 'desc')

    const row = await query.first()
    if (!row) return null

    const requiredFields = parseJson(row.required_fields, [])
    const contentObject = parseJson(row.content_json, null)
    if (!contentObject || typeof contentObject !== 'object' || Array.isArray(contentObject)) {
      throw new Error(`Dynamic template '${templateKey}' punya content_json tidak valid`)
    }

    return {
      id: row.id,
      templateKey: row.template_key,
      name: row.name,
      companyId: row.company_id,
      sourceType: row.source_type,
      isActive: !!row.is_active,
      requiredFields: Array.isArray(requiredFields) ? requiredFields : [],
      contentObject
    }
  }
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (e) {
    return fallback
  }
}

function toCompanyId(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function isMissing(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && !value.trim()) return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function getByPath(obj, dottedPath) {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = String(dottedPath).split('.').map((p) => p.trim()).filter(Boolean)
  let cur = obj
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

function deepInterpolate(node, data) {
  if (Array.isArray(node)) return node.map((item) => deepInterpolate(item, data))
  if (node && typeof node === 'object') {
    const out = {}
    for (const key of Object.keys(node)) out[key] = deepInterpolate(node[key], data)
    return out
  }
  if (typeof node !== 'string') return node
  return interpolateString(node, data)
}

function interpolateString(input, data) {
  const exact = input.match(/^{{\s*([^}]+)\s*}}$/)
  if (exact) {
    const value = getByPath(data, exact[1])
    if (value === undefined || value === null) return ''
    return value
  }

  return input.replace(/{{\s*([^}]+)\s*}}/g, (_, keyPath) => {
    const value = getByPath(data, keyPath)
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

function normalizePdfmakeLayout(node) {
  if (Array.isArray(node)) return node.map((item) => normalizePdfmakeLayout(item))
  if (!node || typeof node !== 'object') return node

  const out = {}
  for (const key of Object.keys(node)) {
    out[key] = normalizePdfmakeLayout(node[key])
  }

  // JSON template tidak bisa mengirim function; ubah layout konstan jadi function.
  if (out.table && out.layout && typeof out.layout === 'object' && !Array.isArray(out.layout)) {
    out.layout = coerceLayoutObject(out.layout)
  }

  return out
}

function coerceLayoutObject(layout) {
  const out = { ...layout }
  const fnKeys = [
    'hLineWidth',
    'vLineWidth',
    'hLineColor',
    'vLineColor',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'paddingBottom',
    'fillColor'
  ]

  for (const key of fnKeys) {
    const value = out[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'function') continue
    out[key] = () => value
  }

  return out
}

function uniq(list) {
  return Array.from(new Set(list))
}

module.exports = TemplateResolver
