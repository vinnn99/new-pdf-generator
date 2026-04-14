'use strict'

const Database = use('Database')
const { validate } = use('Validator')
const uuid = () => Math.random().toString(36).slice(2, 12)
const fs = require('fs')
const path = require('path')
const TemplateResolver = require('../../Services/TemplateResolver')
const CompanyCodeService = use('App/Services/CompanyCodeService')

class AdminCompanyController {
  _listTemplates() {
    const dir = path.join(process.cwd(), 'resources', 'pdf-templates')
    try {
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .map((f) => path.basename(f, '.js'))
    } catch (e) {
      return []
    }
  }

  async templates({ response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    if (role !== 'superadmin') {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya superadmin yang dapat melihat daftar template' })
    }
    const templates = await TemplateResolver.listTemplateKeys({ includeInactive: false })
    return response.json({ status: 'ok', templates })
  }

  async setTemplates({ params, request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    if (role !== 'superadmin') {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya superadmin yang dapat mengatur template company' })
    }
    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })

    const list = request.input('templates') || request.input('allowed_templates')
    const arr = Array.isArray(list) ? list : (typeof list === 'string' ? list.split(',').map(s => s.trim()).filter(Boolean) : [])

    const affected = await Database.table('companies')
      .where('company_id', id)
      .update({ allowed_templates: JSON.stringify(arr), updated_at: new Date() })
    if (!affected) return response.status(404).json({ status: 'error', message: 'Company tidak ditemukan' })

    const updated = await Database.table('companies').where('company_id', id).first()
    return response.json({ status: 'updated', allowed_templates: arr, company: updated })
  }

  async index({ request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat melihat daftar company' })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const query = Database.table('companies')
    if (isAdmin && admin.company_id) query.where('company_id', admin.company_id)

    const results = await query
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: results.data
    })
  }

  async store({ request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat membuat company' })
    }

    // Admin yang sudah terikat ke company tidak boleh membuat company baru
    if (isAdmin) {
      if (admin.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin tidak diizinkan membuat company baru' })
      }
    }

    const payload = request.only(['name', 'code', 'api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'mail_from', 'is_active'])

    const rules = {
      name: 'required',
      api_key: 'required|unique:companies,api_key',
    }

    const validation = await validate(payload, rules)
    if (validation.fails()) {
      return response.status(422).json({ status: 'validation_failed', message: 'Validasi gagal', errors: validation.messages() })
    }

    const now = new Date()
    const defaultAllowedTemplates = await TemplateResolver.listTemplateKeys({
      includeInactive: false,
      companyId: null
    })

    const company = {
      name: payload.name,
      code: CompanyCodeService.resolve(payload.code, payload.name),
      api_key: payload.api_key || uuid(),
      smtp_host: payload.smtp_host || null,
      smtp_port: payload.smtp_port || null,
      smtp_user: payload.smtp_user || null,
      smtp_pass: payload.smtp_pass || null,
      smtp_secure: payload.smtp_secure || false,
      mail_from: payload.mail_from || null,
      is_active: payload.is_active === false ? false : true,
      allowed_templates: JSON.stringify(defaultAllowedTemplates),
      created_at: now,
      updated_at: now
    }

    const inserted = await Database.table('companies').insert(company)
    const companyId = Array.isArray(inserted) ? inserted[0] : inserted
    const created = await Database.table('companies').where('company_id', companyId).first()

    return response.status(201).json({ status: 'created', company: created })
  }

  async update({ params, request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengedit company' })
    }

    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })

    const payload = request.only(['name', 'code', 'api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'mail_from', 'is_active', 'allowed_templates'])

    if (isAdmin && admin.company_id && admin.company_id !== id) {
      return response.status(403).json({ status: 'forbidden', message: 'Tidak boleh mengubah company lain' })
    }

    const existingCompany = await Database.table('companies').where('company_id', id).first()
    if (!existingCompany) return response.status(404).json({ status: 'error', message: 'Company tidak ditemukan' })

    // uniqueness api_key
    if (payload.api_key) {
      const existing = await Database.table('companies').where('api_key', payload.api_key).whereNot('company_id', id).first()
      if (existing) return response.status(422).json({ status: 'validation_failed', message: 'api_key sudah dipakai' })
    }

    const updateData = {}
    const assign = (key, val) => { if (val !== undefined) updateData[key] = val }
    assign('name', payload.name)
    if (payload.code !== undefined) {
      const companyNameForCode = payload.name !== undefined ? payload.name : existingCompany.name
      assign('code', CompanyCodeService.resolve(payload.code, companyNameForCode))
    } else if (!existingCompany.code && payload.name !== undefined) {
      assign('code', CompanyCodeService.resolve(existingCompany.code, payload.name))
    }
    assign('api_key', payload.api_key)
    assign('smtp_host', payload.smtp_host)
    assign('smtp_port', payload.smtp_port)
    assign('smtp_user', payload.smtp_user)
    assign('smtp_pass', payload.smtp_pass)
    assign('smtp_secure', payload.smtp_secure)
    assign('mail_from', payload.mail_from)
    if (payload.allowed_templates !== undefined) {
      assign('allowed_templates', Array.isArray(payload.allowed_templates)
        ? JSON.stringify(payload.allowed_templates)
        : payload.allowed_templates)
    }
    if (payload.is_active !== undefined) assign('is_active', !!payload.is_active)
    updateData.updated_at = new Date()

    const affected = await Database.table('companies').where('company_id', id).update(updateData)
    if (!affected) return response.status(404).json({ status: 'error', message: 'Company tidak ditemukan' })

    const updated = await Database.table('companies').where('company_id', id).first()
    return response.json({ status: 'updated', company: updated })
  }

  async activate({ params, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengaktifkan company' })
    }
    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })

    if (isAdmin && admin.company_id && admin.company_id !== id) {
      return response.status(403).json({ status: 'forbidden', message: 'Tidak boleh mengubah status company lain' })
    }

    const affected = await Database.table('companies').where('company_id', id).update({ is_active: true, updated_at: new Date() })
    if (!affected) return response.status(404).json({ status: 'error', message: 'Company tidak ditemukan' })
    const updated = await Database.table('companies').where('company_id', id).first()
    return response.json({ status: 'activated', company: updated })
  }

  async deactivate({ params, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat menonaktifkan company' })
    }
    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })

    if (isAdmin && admin.company_id && admin.company_id !== id) {
      return response.status(403).json({ status: 'forbidden', message: 'Tidak boleh mengubah status company lain' })
    }

    const affected = await Database.table('companies').where('company_id', id).update({ is_active: false, updated_at: new Date() })
    if (!affected) return response.status(404).json({ status: 'error', message: 'Company tidak ditemukan' })
    const updated = await Database.table('companies').where('company_id', id).first()
    return response.json({ status: 'deactivated', company: updated })
  }
}

module.exports = AdminCompanyController
