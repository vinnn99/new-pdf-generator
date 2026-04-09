'use strict'

const Database = use('Database')

class AdminTemplateController {
  async index({ request, response, auth }) {
    const actor = auth.user
    const role = actor && String(actor.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat melihat template dinamis' })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const includeInactive = toBool(request.input('include_inactive') || request.input('includeInactive'))

    const query = Database.from('dynamic_templates as dt')
      .leftJoin('companies as c', 'dt.company_id', 'c.company_id')
      .select(
        'dt.id',
        'dt.template_key',
        'dt.name',
        'dt.company_id',
        'c.name as company_name',
        'dt.source_type',
        'dt.required_fields',
        'dt.is_active',
        'dt.created_by',
        'dt.updated_by',
        'dt.created_at',
        'dt.updated_at'
      )

    if (!includeInactive) query.where('dt.is_active', true)

    if (isAdmin) {
      if (!actor.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      }
      query.where((qb) => {
        qb.where('dt.company_id', actor.company_id).orWhereNull('dt.company_id')
      })
    } else {
      const companyIdInput = request.input('company_id')
      if (companyIdInput === 'null') {
        query.whereNull('dt.company_id')
      } else if (companyIdInput !== undefined && companyIdInput !== null && String(companyIdInput) !== '') {
        const cid = Number(companyIdInput)
        if (!cid) return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })
        query.where('dt.company_id', cid)
      }
    }

    const results = await query
      .orderBy('dt.created_at', 'desc')
      .paginate(page, perPage)

    const data = (results.data || []).map((row) => ({
      id: row.id,
      template_key: row.template_key,
      name: row.name,
      company_id: row.company_id,
      company_name: row.company_name,
      source_type: row.source_type,
      required_fields: safeJson(row.required_fields, []),
      is_active: !!row.is_active,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data
    })
  }

  async store({ request, response, auth }) {
    const actor = auth.user
    const role = actor && String(actor.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat membuat template dinamis' })
    }

    const payload = request.only([
      'template_key',
      'name',
      'content',
      'content_json',
      'required_fields',
      'company_id',
      'source_type',
      'is_active'
    ])

    const templateKey = String(payload.template_key || '').trim().toLowerCase()
    const name = String(payload.name || '').trim()
    if (!templateKey) return response.status(422).json({ status: 'validation_failed', message: 'template_key wajib diisi' })
    if (!/^[a-z0-9-]{2,100}$/.test(templateKey)) {
      return response.status(422).json({ status: 'validation_failed', message: 'template_key hanya boleh huruf kecil, angka, dan tanda - (2-100 karakter)' })
    }
    if (!name) return response.status(422).json({ status: 'validation_failed', message: 'name wajib diisi' })

    const sourceType = String(payload.source_type || 'pdfmake_json').toLowerCase()
    if (sourceType !== 'pdfmake_json') {
      return response.status(422).json({ status: 'validation_failed', message: "source_type hanya mendukung 'pdfmake_json'" })
    }

    const contentObject = parseContentInput(payload.content, payload.content_json)
    if (!contentObject.ok) {
      return response.status(422).json({ status: 'validation_failed', message: contentObject.message })
    }

    const requiredFields = parseRequiredFields(payload.required_fields)
    if (!requiredFields.ok) {
      return response.status(422).json({ status: 'validation_failed', message: requiredFields.message })
    }

    let companyId = null
    if (isAdmin) {
      if (!actor.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      }
      companyId = actor.company_id
    } else {
      companyId = normalizeCompanyId(payload.company_id)
      if (payload.company_id !== undefined && payload.company_id !== null && payload.company_id !== '' && !companyId) {
        return response.status(422).json({ status: 'validation_failed', message: 'company_id tidak valid' })
      }
    }

    if (companyId) {
      const company = await Database.table('companies').where('company_id', companyId).first()
      if (!company) return response.status(400).json({ status: 'error', message: 'Perusahaan tidak ditemukan' })
    }

    const existing = await findByKeyAndCompany(templateKey, companyId)
    if (existing) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'template_key sudah dipakai untuk scope company tersebut'
      })
    }

    const now = new Date()
    const inserted = await Database.table('dynamic_templates').insert({
      template_key: templateKey,
      name,
      company_id: companyId,
      source_type: sourceType,
      required_fields: JSON.stringify(requiredFields.value),
      content_json: JSON.stringify(contentObject.value),
      is_active: payload.is_active === undefined ? true : !!payload.is_active,
      created_by: actor.id,
      updated_by: actor.id,
      created_at: now,
      updated_at: now
    })

    const id = Array.isArray(inserted) ? inserted[0] : inserted
    const created = await Database.table('dynamic_templates').where('id', id).first()

    return response.status(201).json({
      status: 'created',
      template: formatTemplateRow(created)
    })
  }

  async update({ params, request, response, auth }) {
    const actor = auth.user
    const role = actor && String(actor.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengubah template dinamis' })
    }

    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'id template tidak valid' })

    const existing = await Database.table('dynamic_templates').where('id', id).first()
    if (!existing) return response.status(404).json({ status: 'error', message: 'Template dinamis tidak ditemukan' })

    if (isAdmin) {
      if (!actor.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      if (existing.company_id !== actor.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin hanya boleh mengubah template milik company sendiri' })
      }
    }

    const payload = request.only([
      'template_key',
      'name',
      'content',
      'content_json',
      'required_fields',
      'company_id',
      'source_type',
      'is_active'
    ])

    const updateData = { updated_at: new Date(), updated_by: actor.id }

    if (payload.template_key !== undefined) {
      const templateKey = String(payload.template_key || '').trim().toLowerCase()
      if (!templateKey) return response.status(422).json({ status: 'validation_failed', message: 'template_key tidak boleh kosong' })
      if (!/^[a-z0-9-]{2,100}$/.test(templateKey)) {
        return response.status(422).json({ status: 'validation_failed', message: 'template_key hanya boleh huruf kecil, angka, dan tanda - (2-100 karakter)' })
      }
      updateData.template_key = templateKey
    }

    if (payload.name !== undefined) {
      const name = String(payload.name || '').trim()
      if (!name) return response.status(422).json({ status: 'validation_failed', message: 'name tidak boleh kosong' })
      updateData.name = name
    }

    if (payload.source_type !== undefined) {
      const sourceType = String(payload.source_type || '').toLowerCase()
      if (sourceType !== 'pdfmake_json') {
        return response.status(422).json({ status: 'validation_failed', message: "source_type hanya mendukung 'pdfmake_json'" })
      }
      updateData.source_type = sourceType
    }

    if (payload.required_fields !== undefined) {
      const requiredFields = parseRequiredFields(payload.required_fields)
      if (!requiredFields.ok) {
        return response.status(422).json({ status: 'validation_failed', message: requiredFields.message })
      }
      updateData.required_fields = JSON.stringify(requiredFields.value)
    }

    if (payload.content !== undefined || payload.content_json !== undefined) {
      const contentObject = parseContentInput(payload.content, payload.content_json)
      if (!contentObject.ok) {
        return response.status(422).json({ status: 'validation_failed', message: contentObject.message })
      }
      updateData.content_json = JSON.stringify(contentObject.value)
    }

    if (payload.is_active !== undefined) updateData.is_active = !!payload.is_active

    let targetCompanyId = existing.company_id
    if (payload.company_id !== undefined) {
      if (isAdmin) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin tidak boleh mengubah company_id template' })
      }

      targetCompanyId = normalizeCompanyId(payload.company_id)
      if (payload.company_id !== null && payload.company_id !== '' && !targetCompanyId) {
        return response.status(422).json({ status: 'validation_failed', message: 'company_id tidak valid' })
      }

      if (targetCompanyId) {
        const company = await Database.table('companies').where('company_id', targetCompanyId).first()
        if (!company) return response.status(400).json({ status: 'error', message: 'Perusahaan tidak ditemukan' })
      }
      updateData.company_id = targetCompanyId
    }

    const nextTemplateKey = updateData.template_key || existing.template_key
    const conflict = await findByKeyAndCompany(nextTemplateKey, targetCompanyId, existing.id)
    if (conflict) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'template_key sudah dipakai untuk scope company tersebut'
      })
    }

    await Database.table('dynamic_templates').where('id', existing.id).update(updateData)
    const updated = await Database.table('dynamic_templates').where('id', existing.id).first()
    return response.json({
      status: 'updated',
      template: formatTemplateRow(updated)
    })
  }

  async activate({ params, response, auth }) {
    return this._setActive(params, response, auth, true)
  }

  async deactivate({ params, response, auth }) {
    return this._setActive(params, response, auth, false)
  }

  async _setActive(params, response, auth, active) {
    const actor = auth.user
    const role = actor && String(actor.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengubah status template dinamis' })
    }

    const id = Number(params.id)
    if (!id) return response.status(400).json({ status: 'error', message: 'id template tidak valid' })

    const existing = await Database.table('dynamic_templates').where('id', id).first()
    if (!existing) return response.status(404).json({ status: 'error', message: 'Template dinamis tidak ditemukan' })

    if (isAdmin) {
      if (!actor.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      if (existing.company_id !== actor.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin hanya boleh mengubah status template milik company sendiri' })
      }
    }

    await Database.table('dynamic_templates')
      .where('id', existing.id)
      .update({ is_active: !!active, updated_by: actor.id, updated_at: new Date() })

    const updated = await Database.table('dynamic_templates').where('id', existing.id).first()
    return response.json({
      status: active ? 'activated' : 'deactivated',
      template: formatTemplateRow(updated)
    })
  }
}

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (e) {
    return fallback
  }
}

function parseRequiredFields(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: [] }
  let arr
  if (Array.isArray(value)) {
    arr = value
  } else if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return { ok: true, value: [] }
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
          return { ok: false, message: 'required_fields JSON harus array' }
        }
        arr = parsed
      } catch (e) {
        return { ok: false, message: 'required_fields JSON tidak valid' }
      }
    } else {
      arr = raw.split(',').map((s) => s.trim()).filter(Boolean)
    }
  } else {
    return { ok: false, message: 'required_fields harus array atau string koma' }
  }

  const out = []
  for (const item of arr) {
    const f = String(item || '').trim()
    if (!f) continue
    if (!/^[a-zA-Z0-9_.-]{1,150}$/.test(f)) {
      return { ok: false, message: `required_fields tidak valid: ${f}` }
    }
    out.push(f)
  }
  return { ok: true, value: out }
}

function parseContentInput(content, contentJson) {
  const candidate = content !== undefined ? content : contentJson
  if (candidate === undefined || candidate === null || candidate === '') {
    return { ok: false, message: 'content/content_json wajib diisi (docDefinition JSON object)' }
  }
  let parsed = candidate
  if (typeof candidate === 'string') {
    try {
      parsed = JSON.parse(candidate)
    } catch (e) {
      return { ok: false, message: 'content_json harus berupa JSON valid' }
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'content/content_json harus object JSON (docDefinition)' }
  }
  return { ok: true, value: parsed }
}

function normalizeCompanyId(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

async function findByKeyAndCompany(templateKey, companyId, excludeId = null) {
  const query = Database.table('dynamic_templates').where('template_key', templateKey)
  if (companyId) query.where('company_id', companyId)
  else query.whereNull('company_id')
  if (excludeId) query.whereNot('id', excludeId)
  return query.first()
}

function formatTemplateRow(row) {
  if (!row) return null
  return {
    id: row.id,
    template_key: row.template_key,
    name: row.name,
    company_id: row.company_id,
    source_type: row.source_type,
    required_fields: safeJson(row.required_fields, []),
    is_active: !!row.is_active,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function toBool(val) {
  if (val === true || val === false) return val
  const str = String(val || '').toLowerCase().trim()
  return str === '1' || str === 'true' || str === 'yes'
}

module.exports = AdminTemplateController
