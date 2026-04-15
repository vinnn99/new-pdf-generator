'use strict'

const Database = use('Database')

class SignatureUrlController {
  async index({ request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)
    const isUser = role === 'user'
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'

    if (!isUser && !isAdmin && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses signature URL history'
      })
    }

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

    if (isProvided(companyIdRaw) && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Filter company_id hanya untuk superadmin'
      })
    }

    if (!isSuper && !toPositiveInt(actor.company_id)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'User/admin harus memiliki company_id'
      })
    }

    const query = Database.from('company_signature_urls as csu')
      .leftJoin('companies as c', 'csu.company_id', 'c.company_id')
      .select(
        'csu.id',
        'csu.company_id',
        'c.name as company_name',
        'csu.url',
        'csu.name',
        'csu.title',
        'csu.use_count',
        'csu.last_used_at',
        'csu.created_at'
      )

    if (isSuper) {
      if (companyId) query.where('csu.company_id', companyId)
    } else {
      query.where('csu.company_id', actor.company_id)
    }

    if (q) {
      const like = `%${q}%`
      query.whereRaw("LOWER(COALESCE(csu.url, '')) LIKE ?", [like])
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
      data: (results.data || []).map((row) => ({
        id: row.id,
        company_id: row.company_id,
        company_name: row.company_name,
        url: row.url,
        name: row.name,
        title: row.title,
        use_count: toNumber(row.use_count),
        last_used_at: row.last_used_at,
        created_at: row.created_at
      }))
    })
  }
}

function resolveRole(user) {
  return String((user && user.role) || '').toLowerCase()
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

module.exports = SignatureUrlController
