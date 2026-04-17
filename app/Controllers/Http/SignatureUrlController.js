'use strict'

const Database = use('Database')
const SignatureUrlHistoryService = use('App/Services/SignatureUrlHistoryService')

class SignatureUrlController {
  async index({ request, response, auth }) {
    const context = await resolveActorContext(auth)
    if (context.error) return response.status(context.error.code).json(context.error.body)

    const pageRaw = Number(request.input('page', 1))
    const perPageRaw = Number(request.input('perPage', 10))
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const perPage = Number.isFinite(perPageRaw)
      ? Math.min(Math.max(Math.floor(perPageRaw), 1), 100)
      : 10

    const q = String(request.input('q') || '').trim().toLowerCase()

    const sortRaw = String(request.input('sort') || 'last_used_at').trim().toLowerCase()
    if (!['last_used_at', 'created_at'].includes(sortRaw)) {
      return response.status(400).json({
        status: 'error',
        message: 'sort hanya boleh last_used_at atau created_at'
      })
    }

    const companyIdRaw = request.input('company_id')
    const companyId = toPositiveInt(companyIdRaw)
    if (isProvided(companyIdRaw) && !companyId) {
      return response.status(400).json({
        status: 'error',
        message: 'company_id tidak valid'
      })
    }

    if (isProvided(companyIdRaw) && !context.isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Filter company_id hanya untuk superadmin'
      })
    }

    const query = baseSignatureQuery()

    if (context.isSuper) {
      if (companyId) query.where('csu.company_id', companyId)
    } else {
      query.where('csu.company_id', context.companyId)
    }

    if (q) {
      const like = `%${q}%`
      query.where((qb) => {
        qb.whereRaw("LOWER(COALESCE(csu.url, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(csu.name, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(csu.title, '')) LIKE ?", [like])
      })
    }

    const results = await query
      .orderBy(`csu.${sortRaw}`, 'desc')
      .orderBy('csu.id', 'desc')
      .paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: (results.data || []).map(serializeSignatureRow)
    })
  }

  async show({ params, response, auth }) {
    const context = await resolveActorContext(auth)
    if (context.error) return response.status(context.error.code).json(context.error.body)

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({
        status: 'error',
        message: 'Signature URL id tidak valid'
      })
    }

    const row = await findScopedSignatureRowById({ id, context })
    if (!row) {
      return response.status(404).json({
        status: 'error',
        message: 'Signature URL tidak ditemukan'
      })
    }

    return response.json({
      status: 'ok',
      data: serializeSignatureRow(row)
    })
  }

  async store({ request, response, auth }) {
    const context = await resolveActorContext(auth)
    if (context.error) return response.status(context.error.code).json(context.error.body)

    const restrictedField = findRestrictedFieldInput(request)
    if (restrictedField) {
      return response.status(400).json({
        status: 'error',
        message: `${restrictedField} tidak boleh diisi manual`
      })
    }

    const payload = request.only(['url', 'name', 'title', 'company_id'])
    if (!isProvided(payload.url)) {
      return response.status(400).json({
        status: 'error',
        message: 'url wajib diisi'
      })
    }

    if (!context.isSuper && isProvided(payload.company_id)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Payload company_id hanya untuk superadmin'
      })
    }

    let targetCompanyId = context.companyId
    if (context.isSuper) {
      if (isProvided(payload.company_id)) {
        targetCompanyId = toPositiveInt(payload.company_id)
        if (!targetCompanyId) {
          return response.status(400).json({
            status: 'error',
            message: 'company_id tidak valid'
          })
        }
      } else if (!targetCompanyId) {
        return response.status(400).json({
          status: 'error',
          message: 'company_id wajib diisi untuk superadmin tanpa company_id'
        })
      }
    }

    const companyExists = await hasCompany(targetCompanyId)
    if (!companyExists) {
      return response.status(404).json({
        status: 'error',
        message: 'Company tidak ditemukan'
      })
    }

    const rawUrl = cleanRawUrl(payload.url)
    const normalizedUrl = SignatureUrlHistoryService.normalizeHttpUrl(rawUrl)
    if (!normalizedUrl) {
      return response.status(400).json({
        status: 'error',
        message: 'url harus http/https yang valid'
      })
    }

    const duplicate = await Database.table('company_signature_urls')
      .where('company_id', targetCompanyId)
      .where('url_normalized', normalizedUrl)
      .first()

    if (duplicate) {
      return response.status(409).json({
        status: 'conflict',
        message: 'Signature URL sudah ada untuk company ini'
      })
    }

    const now = new Date()
    let insertedId

    try {
      const inserted = await Database.table('company_signature_urls').insert({
        company_id: targetCompanyId,
        url: rawUrl,
        url_normalized: normalizedUrl,
        name: cleanLabel(payload.name),
        title: cleanLabel(payload.title),
        last_used_at: now,
        use_count: 1,
        created_by: toPositiveInt(context.actor.id),
        created_at: now,
        updated_at: now
      })
      insertedId = Array.isArray(inserted) ? inserted[0] : inserted
    } catch (error) {
      if (isUniqueError(error)) {
        return response.status(409).json({
          status: 'conflict',
          message: 'Signature URL sudah ada untuk company ini'
        })
      }
      throw error
    }

    const row = await findSignatureRowById(insertedId)
    return response.status(201).json({
      status: 'created',
      data: serializeSignatureRow(row)
    })
  }

  async update({ params, request, response, auth }) {
    const context = await resolveActorContext(auth)
    if (context.error) return response.status(context.error.code).json(context.error.body)

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({
        status: 'error',
        message: 'Signature URL id tidak valid'
      })
    }

    const restrictedField = findRestrictedFieldInput(request)
    if (restrictedField) {
      return response.status(400).json({
        status: 'error',
        message: `${restrictedField} tidak boleh diisi manual`
      })
    }

    const payload = request.only(['url', 'name', 'title', 'company_id'])
    if (!context.isSuper && isProvided(payload.company_id)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Payload company_id hanya untuk superadmin'
      })
    }

    const hasUpdatableField = ['url', 'name', 'title', 'company_id'].some((field) => payload[field] !== undefined)
    if (!hasUpdatableField) {
      return response.status(400).json({
        status: 'error',
        message: 'Tidak ada field yang diperbarui'
      })
    }

    const current = await findScopedSignatureRowById({ id, context })
    if (!current) {
      return response.status(404).json({
        status: 'error',
        message: 'Signature URL tidak ditemukan'
      })
    }

    let targetCompanyId = toPositiveInt(current.company_id)
    if (context.isSuper && isProvided(payload.company_id)) {
      targetCompanyId = toPositiveInt(payload.company_id)
      if (!targetCompanyId) {
        return response.status(400).json({
          status: 'error',
          message: 'company_id tidak valid'
        })
      }
    }

    if (!targetCompanyId) {
      return response.status(400).json({
        status: 'error',
        message: 'company_id tidak valid'
      })
    }

    if (context.isSuper && isProvided(payload.company_id)) {
      const companyExists = await hasCompany(targetCompanyId)
      if (!companyExists) {
        return response.status(404).json({
          status: 'error',
          message: 'Company tidak ditemukan'
        })
      }
    }

    let nextRawUrl = current.url
    let nextNormalizedUrl = current.url_normalized

    if (payload.url !== undefined) {
      const rawUrl = cleanRawUrl(payload.url)
      const normalizedUrl = SignatureUrlHistoryService.normalizeHttpUrl(rawUrl)
      if (!normalizedUrl) {
        return response.status(400).json({
          status: 'error',
          message: 'url harus http/https yang valid'
        })
      }
      nextRawUrl = rawUrl
      nextNormalizedUrl = normalizedUrl
    }

    const duplicate = await Database.table('company_signature_urls')
      .where('company_id', targetCompanyId)
      .where('url_normalized', nextNormalizedUrl)
      .whereNot('id', id)
      .first()

    if (duplicate) {
      return response.status(409).json({
        status: 'conflict',
        message: 'Signature URL sudah ada untuk company ini'
      })
    }

    const now = new Date()
    const updates = { updated_at: now }

    if (payload.url !== undefined) {
      updates.url = nextRawUrl
      updates.url_normalized = nextNormalizedUrl
    }

    if (payload.name !== undefined) updates.name = cleanLabel(payload.name)
    if (payload.title !== undefined) updates.title = cleanLabel(payload.title)
    if (targetCompanyId !== toPositiveInt(current.company_id)) updates.company_id = targetCompanyId

    await Database.table('company_signature_urls')
      .where('id', id)
      .update(updates)

    const row = await findSignatureRowById(id)
    return response.json({
      status: 'updated',
      data: serializeSignatureRow(row)
    })
  }

  async destroy({ params, response, auth }) {
    const context = await resolveActorContext(auth)
    if (context.error) return response.status(context.error.code).json(context.error.body)

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({
        status: 'error',
        message: 'Signature URL id tidak valid'
      })
    }

    const row = await findScopedSignatureRowById({ id, context })
    if (!row) {
      return response.status(404).json({
        status: 'error',
        message: 'Signature URL tidak ditemukan'
      })
    }

    await Database.table('company_signature_urls')
      .where('id', id)
      .delete()

    return response.json({
      status: 'deleted',
      id
    })
  }
}

async function resolveActorContext(auth) {
  const actor = await auth.getUser()
  const role = resolveRole(actor)
  const isUser = role === 'user'
  const isAdmin = role === 'admin'
  const isSuper = role === 'superadmin'

  if (!isUser && !isAdmin && !isSuper) {
    return {
      error: {
        code: 403,
        body: {
          status: 'forbidden',
          message: 'Role tidak diizinkan mengakses signature URL history'
        }
      }
    }
  }

  const companyId = toPositiveInt(actor.company_id)
  if (!isSuper && !companyId) {
    return {
      error: {
        code: 403,
        body: {
          status: 'forbidden',
          message: 'User/admin harus memiliki company_id'
        }
      }
    }
  }

  return { actor, role, isUser, isAdmin, isSuper, companyId }
}

function baseSignatureQuery() {
  return Database.from('company_signature_urls as csu')
    .leftJoin('companies as c', 'csu.company_id', 'c.company_id')
    .select(
      'csu.id',
      'csu.company_id',
      'c.name as company_name',
      'csu.url',
      'csu.url_normalized',
      'csu.name',
      'csu.title',
      'csu.use_count',
      'csu.last_used_at',
      'csu.created_by',
      'csu.created_at',
      'csu.updated_at'
    )
}

async function findScopedSignatureRowById({ id, context }) {
  const query = baseSignatureQuery().where('csu.id', id)
  if (!context.isSuper) query.where('csu.company_id', context.companyId)
  return query.first()
}

async function findSignatureRowById(id) {
  return baseSignatureQuery()
    .where('csu.id', id)
    .first()
}

async function hasCompany(companyId) {
  const row = await Database.table('companies')
    .where('company_id', companyId)
    .first()
  return !!row
}

function serializeSignatureRow(row) {
  if (!row) return null

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: row.company_name,
    url: row.url,
    name: row.name,
    title: row.title,
    use_count: toNumber(row.use_count),
    last_used_at: row.last_used_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function findRestrictedFieldInput(request) {
  const restrictedFields = ['url_normalized', 'use_count', 'last_used_at', 'created_by', 'created_at', 'updated_at']
  return restrictedFields.find((field) => isProvided(request.input(field)))
}

function resolveRole(user) {
  return String((user && user.role) || '').toLowerCase()
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

function toPositiveInt(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function isProvided(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isUniqueError(error) {
  const message = String((error && error.message) || '').toLowerCase()
  return message.includes('unique') || message.includes('duplicate')
}

module.exports = SignatureUrlController
