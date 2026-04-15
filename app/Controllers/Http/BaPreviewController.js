'use strict'

const fs = require('fs')
const Database = use('Database')
const BaPreviewService = use('App/Services/BaPreviewService')

class BaPreviewController {
  async generate ({ request, response, auth, params }) {
    try {
      const actor = await auth.getUser()
      const role = resolveRole(actor)

      if (!isAllowedRole(role)) {
        return response.status(403).json({
          status: 'forbidden',
          message: 'Role tidak diizinkan mengakses preview PDF'
        })
      }

      const template = normalizeTemplateKey(params.template)
      if (!BaPreviewService.supportsTemplate(template)) {
        return validationFailed(response, ['Field template wajib diisi'])
      }

      const body = request.all()
      const payloadData = body && typeof body.data === 'object' && !Array.isArray(body.data)
        ? body.data
        : null

      if (!payloadData) {
        return validationFailed(response, ['Field data wajib diisi (object)'])
      }

      const companyId = resolveCompanyId({ actor, role, body })
      if (!companyId) {
        if (role !== 'superadmin') {
          return response.status(403).json({
            status: 'forbidden',
            message: 'User/Admin harus memiliki company_id untuk preview PDF'
          })
        }
        return validationFailed(response, ['company_id wajib diisi untuk superadmin'])
      }

      const company = await Database.table('companies').where('company_id', companyId).first()
      if (!company) {
        return validationFailed(response, ['Perusahaan tidak ditemukan'])
      }

      const allowed = parseAllowedTemplates(company.allowed_templates)
      if (allowed.length > 0 && !allowed.includes(template)) {
        return response.status(403).json({
          status: 'forbidden',
          message: `Template '${template}' tidak diizinkan untuk company ini`
        })
      }

      const result = await BaPreviewService.generate({
        template,
        data: payloadData,
        company,
        user: actor,
        actorEmail: actor && actor.email ? actor.email : ''
      })

      return response.json({
        status: 'ok',
        message: 'Preview generated',
        data: {
          preview_url: result.previewUrl,
          expires_at: new Date(result.expiresAt).toISOString()
        }
      })
    } catch (error) {
      if (error && error.code === 'VALIDATION_FAILED') {
        return validationFailed(response, error.details || [error.message])
      }

      console.error('[preview.generate] error:', error.message)
      return response.status(500).json({
        status: 'error',
        message: 'Gagal membuat preview PDF',
        error: error.message
      })
    }
  }

  async download ({ params, request, response, auth }) {
    try {
      const actor = await auth.getUser()
      const role = resolveRole(actor)

      if (!isAllowedRole(role)) {
        return response.status(403).json({
          status: 'forbidden',
          message: 'Role tidak diizinkan mengakses preview PDF'
        })
      }

      const previewId = toPositiveInt(params.id)
      if (!previewId) {
        return response.status(400).json({
          status: 'error',
          message: 'preview id tidak valid'
        })
      }

      const preview = await BaPreviewService.getById(previewId)
      if (!preview) {
        return response.status(404).json({
          status: 'error',
          message: 'Preview tidak ditemukan'
        })
      }

      if (!canAccessPreview({ actor, role, preview })) {
        return response.status(403).json({
          status: 'forbidden',
          message: 'Preview di luar scope akses user'
        })
      }

      if (BaPreviewService.isExpired(preview)) {
        if (String(preview.status || '').toLowerCase() === 'active') {
          await BaPreviewService.markExpiredById(preview.id, new Date())
        }
        return response.status(410).json({
          status: 'error',
          message: 'Preview sudah kedaluwarsa'
        })
      }

      const absolutePath = BaPreviewService.resolveAbsolutePath(preview.saved_path)
      if (!fs.existsSync(absolutePath)) {
        await BaPreviewService.markExpiredById(preview.id, new Date())
        return response.status(404).json({
          status: 'error',
          message: 'File preview tidak ditemukan'
        })
      }

      const fileBuffer = fs.readFileSync(absolutePath)
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `inline; filename="${preview.filename}"`)
      response.header('Cache-Control', 'no-store')

      return response.send(fileBuffer)
    } catch (error) {
      console.error('[preview.download] error:', error.message)
      return response.status(500).json({
        status: 'error',
        message: 'Gagal mengunduh preview PDF',
        error: error.message
      })
    }
  }
}

function resolveRole (user) {
  return String((user && user.role) || '').toLowerCase()
}

function isAllowedRole (role) {
  return ['user', 'admin', 'superadmin'].includes(role)
}

function resolveCompanyId ({ actor, role, body }) {
  if (role === 'superadmin') {
    return toPositiveInt(
      body.company_id ||
      body.companyId ||
      (actor && actor.company_id)
    )
  }
  return toPositiveInt(actor && actor.company_id)
}

function toPositiveInt (value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function parseAllowedTemplates (rawValue) {
  if (!rawValue) return []
  if (Array.isArray(rawValue)) return rawValue.map((item) => String(item).toLowerCase())
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.map((item) => String(item).toLowerCase()) : []
  } catch (_) {
    return []
  }
}

function normalizeTemplateKey (template) {
  return String(template || '').trim().toLowerCase()
}

function validationFailed (response, errors) {
  return response.status(422).json({
    status: 'validation_failed',
    message: 'Validation failed',
    errors: Array.isArray(errors) ? errors : [String(errors)]
  })
}

function canAccessPreview ({ actor, role, preview }) {
  if (role === 'superadmin') return true
  if (!actor || !actor.company_id) return false
  return Number(actor.company_id) === Number(preview.company_id)
}

module.exports = BaPreviewController
