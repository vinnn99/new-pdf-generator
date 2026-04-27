'use strict'

const PdfPrinter = require('pdfmake')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const Env = use('Env')
const Database = use('Database')
const TemplateResolver = use('App/Services/TemplateResolver')
const BaTemplateService = use('App/Services/BaTemplateService')
const CompanyCodeService = use('App/Services/CompanyCodeService')
const SlipPayloadNormalizer = use('App/Services/SlipPayloadNormalizer')

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000
const ROMAN_MONTH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const fontsDir = path.join(__dirname, '../Fonts')
const printer = new PdfPrinter({
  Roboto: {
    normal: path.join(fontsDir, 'Roboto_Condensed-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto_Condensed-Bold.ttf'),
    italics: path.join(fontsDir, 'Roboto_Condensed-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto_Condensed-BoldItalic.ttf')
  }
})

class BaPreviewService {
  static get PREVIEW_TTL_MS () {
    return PREVIEW_TTL_MS
  }

  static supportsTemplate (template) {
    const normalized = normalizeTemplateKey(template)
    return !!normalized
  }

  static buildPreviewLetterNo ({ companyCode, template, now = new Date() } = {}) {
    const normalizedTemplate = BaTemplateService.normalizeTemplate(template)
    const templateCode = BaTemplateService.getTemplateCode(normalizedTemplate)
    const resolvedCompanyCode = CompanyCodeService.resolve(companyCode, null)
    const year = String(now.getFullYear())
    const month = Math.min(Math.max(now.getMonth() + 1, 1), 12)
    const romanMonth = ROMAN_MONTH[month - 1]
    return `PREVIEW/${resolvedCompanyCode}/${templateCode}/${romanMonth}/${year}`
  }

  static async generate ({ template, data, company, user, actorEmail = '' } = {}) {
    const normalizedTemplate = normalizeTemplateKey(template)
    if (!this.supportsTemplate(normalizedTemplate)) {
      const err = new Error('Template preview tidak valid')
      err.code = 'VALIDATION_FAILED'
      err.details = ['Field template wajib diisi']
      throw err
    }

    if (!company || !company.company_id) {
      const err = new Error('Company tidak valid untuk preview BA')
      err.code = 'VALIDATION_FAILED'
      err.details = ['Company tidak valid untuk preview BA']
      throw err
    }

    const sourceData = data && typeof data === 'object' ? { ...data } : {}
    const payloadData = SlipPayloadNormalizer.normalize({
      template: normalizedTemplate,
      data: sourceData
    })
    payloadData.companyName = payloadData.companyName || company.name
    if (BaTemplateService.isBaTemplate(normalizedTemplate)) {
      payloadData.letterNo = this.buildPreviewLetterNo({
        companyCode: company.code || company.name,
        template: normalizedTemplate
      })
    }

    const resolvedTemplate = await TemplateResolver.resolve(normalizedTemplate, {
      companyId: company.company_id
    })
    if (!resolvedTemplate) {
      const err = new Error(`Template '${normalizedTemplate}' tidak ditemukan`)
      err.code = 'VALIDATION_FAILED'
      err.details = [`Template '${normalizedTemplate}' tidak ditemukan`]
      throw err
    }

    const validationErrors = TemplateResolver.validateRequiredFields(
      payloadData,
      resolvedTemplate.requiredFields
    )
    if (validationErrors.length > 0) {
      const err = new Error('Validation failed')
      err.code = 'VALIDATION_FAILED'
      err.details = validationErrors
      throw err
    }

    await enrichSignatureImages(payloadData)
    const docDefinition = this._renderDocDefinition(resolvedTemplate, payloadData)
    const pdfBuffer = await this._createPdfBuffer(docDefinition)

    const companyFolder = sanitizeSegment(company.name || `company_${company.company_id}`)
    const emailFolder = sanitizeSegment(actorEmail || (user && user.email) || `user_${user ? user.id : 'system'}`)
    const previewDir = path.join(process.cwd(), 'public', 'preview', companyFolder, emailFolder)
    fs.mkdirSync(previewDir, { recursive: true })

    const filename = buildPreviewFilename(normalizedTemplate, payloadData)
    const filePath = path.join(previewDir, filename)
    fs.writeFileSync(filePath, pdfBuffer)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS)
    const savedRelativePath = path.join('public', 'preview', companyFolder, emailFolder, filename)

    const inserted = await Database.table('ba_preview_files').insert({
      company_id: company.company_id,
      user_id: user && user.id ? user.id : null,
      template: normalizedTemplate,
      filename,
      saved_path: savedRelativePath,
      preview_url: null,
      expires_at: expiresAt,
      status: 'active',
      deleted_at: null,
      created_at: now,
      updated_at: now
    })
    const previewId = Array.isArray(inserted) ? inserted[0] : inserted
    const previewUrl = `${resolveBaseUrl()}/api/v1/preview/file/${previewId}`

    await Database.table('ba_preview_files')
      .where('id', previewId)
      .update({
        preview_url: previewUrl,
        updated_at: new Date()
      })

    return {
      previewId,
      previewUrl,
      expiresAt,
      filename,
      savedPath: savedRelativePath
    }
  }

  static async getById (id) {
    return Database.table('ba_preview_files').where('id', id).first()
  }

  static isExpired (row, now = new Date()) {
    if (!row) return true
    if (String(row.status || '').toLowerCase() !== 'active') return true
    const expiresAt = new Date(row.expires_at)
    if (Number.isNaN(expiresAt.getTime())) return true
    return expiresAt.getTime() <= now.getTime()
  }

  static async markExpiredById (id, now = new Date()) {
    await Database.table('ba_preview_files')
      .where('id', id)
      .update({
        status: 'expired',
        deleted_at: now,
        updated_at: now
      })
  }

  static resolveAbsolutePath (savedPath) {
    const normalized = path.normalize(String(savedPath || ''))
    if (path.isAbsolute(normalized)) return normalized
    return path.join(process.cwd(), normalized)
  }

  static async cleanupExpired ({ now = new Date() } = {}) {
    const rows = await Database.table('ba_preview_files')
      .where('status', 'active')
      .where('expires_at', '<=', now)
      .select('id', 'saved_path')

    let fileDeleted = 0
    let fileMissing = 0
    let markedExpired = 0
    let errors = 0

    for (const row of rows) {
      const absolutePath = this.resolveAbsolutePath(row.saved_path)

      try {
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath)
          fileDeleted += 1
        } else {
          fileMissing += 1
        }

        await this.markExpiredById(row.id, now)
        markedExpired += 1
      } catch (error) {
        errors += 1
        console.warn(`[preview.cleanup] gagal cleanup preview id=${row.id}: ${error.message}`)
      }
    }

    return {
      scanned: rows.length,
      markedExpired,
      fileDeleted,
      fileMissing,
      errors
    }
  }

  static _renderDocDefinition (resolvedTemplate, payloadData) {
    if (resolvedTemplate.source === 'dynamic') {
      return TemplateResolver.renderDynamicDocDefinition(
        resolvedTemplate.templateRecord,
        payloadData
      )
    }

    const templateFunction = resolvedTemplate.templateFunction
    if (typeof templateFunction !== 'function') {
      throw new Error(`Template '${resolvedTemplate.templateKey}' tidak valid`)
    }
    return templateFunction(payloadData)
  }

  static _createPdfBuffer (docDefinition) {
    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition)
      const chunks = []
      pdfDoc.on('data', (chunk) => chunks.push(chunk))
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', (error) => reject(error))
      pdfDoc.end()
    })
  }
}

function buildPreviewFilename (template, payloadData) {
  const uniqueId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const safe = (value, fallback) => {
    const cleaned = sanitizeSegment(value)
    return cleaned || fallback
  }

  const templateLabel = safe(template, 'template')
  const subject = safe(
    payloadData && (
      payloadData.mdsName ||
      payloadData.employeeName ||
      payloadData.clientName ||
      payloadData.nama
    ),
    'preview'
  )
  const marker = safe(
    payloadData && (
      payloadData.letterNo
        ? String(payloadData.letterNo).replace(/\//g, '-')
        : payloadData.period || payloadData.periode || payloadData.position
    ),
    'sample'
  )

  return `preview.${templateLabel}.${subject}.${marker}.${uniqueId}.pdf`
}

function normalizeTemplateKey (template) {
  return String(template || '').trim().toLowerCase()
}

function sanitizeSegment (value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveBaseUrl () {
  const appUrl = Env.get('APP_URL')
  if (appUrl) return String(appUrl).replace(/\/+$/g, '')
  return `http://localhost:${Env.get('PORT', 3334)}`
}

async function enrichSignatureImages (payloadData) {
  if (!payloadData || typeof payloadData !== 'object') return

  const { signatureLeftUrl, signatureRightUrl } = payloadData
  if (isHttpUrl(signatureLeftUrl)) {
    try {
      payloadData.signatureLeftImage = await fetchImageAsDataUrl(signatureLeftUrl)
    } catch (error) {
      console.warn('[preview.signature] gagal fetch signatureLeftUrl:', error.message)
    }
  }

  if (isHttpUrl(signatureRightUrl)) {
    try {
      payloadData.signatureRightImage = await fetchImageAsDataUrl(signatureRightUrl)
    } catch (error) {
      console.warn('[preview.signature] gagal fetch signatureRightUrl:', error.message)
    }
  }
}

function isHttpUrl (value) {
  try {
    const parsed = new URL(String(value || ''))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (_) {
    return false
  }
}

function fetchImageAsDataUrl (url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirected = new URL(res.headers.location, url).href
        res.resume()
        return resolve(fetchImageAsDataUrl(redirected))
      }

      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`status ${res.statusCode}`))
      }

      const contentType = res.headers['content-type'] || 'image/png'
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        if (buffer.length > 1.5 * 1024 * 1024) {
          return reject(new Error('file too large'))
        }
        resolve(`data:${contentType};base64,${buffer.toString('base64')}`)
      })
    })

    req.on('error', reject)
  })
}

module.exports = BaPreviewService
