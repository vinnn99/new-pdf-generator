'use strict'

const Database = use('Database')

class EmailLogController {
  async index({ request, response, auth }) {
    const actor = auth.user
    const role = actor && String(actor.role).toLowerCase()
    const isUser = role === 'user'
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'

    if (!isUser && !isAdmin && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses email logs'
      })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const q = String(request.input('q') || '').trim().toLowerCase()
    const statusFilter = String(request.input('status') || '').trim().toLowerCase()
    const templateFilter = String(request.input('template') || '').trim().toLowerCase()
    const contextFilter = String(request.input('context') || '').trim().toLowerCase()

    const userIdRaw = request.input('user_id')
    const userId = toPositiveInt(userIdRaw)
    if (isProvided(userIdRaw) && !userId) {
      return response.status(400).json({ status: 'error', message: 'user_id tidak valid' })
    }

    const companyIdRaw = request.input('company_id')
    const companyId = toPositiveInt(companyIdRaw)
    if (isProvided(companyIdRaw) && !companyId) {
      return response.status(400).json({ status: 'error', message: 'company_id tidak valid' })
    }
    if (isProvided(companyIdRaw) && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Filter company_id hanya untuk superadmin'
      })
    }

    if (isUser && userId && userId !== actor.id) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'User hanya boleh melihat email log miliknya'
      })
    }

    const query = Database.from('email_logs as el')
      .leftJoin('users as u', 'el.user_id', 'u.id')
      .leftJoin('companies as c', 'el.company_id', 'c.company_id')
      .select(
        'el.id',
        'el.user_id',
        'u.username as user_username',
        'u.email as user_email',
        'el.company_id',
        'c.name as company_name',
        'el.template',
        'el.context',
        'el.to_email',
        'el.cc',
        'el.bcc',
        'el.subject',
        'el.body',
        'el.attachments',
        'el.status',
        'el.error',
        'el.created_at',
        'el.updated_at'
      )

    if (isSuper) {
      if (companyId) query.where('el.company_id', companyId)
    } else if (isAdmin) {
      if (!actor.company_id) {
        return response.status(403).json({
          status: 'forbidden',
          message: 'Admin harus memiliki company_id'
        })
      }
      query.where('el.company_id', actor.company_id)
    } else {
      query.where('el.user_id', actor.id)
    }

    if (userId) query.where('el.user_id', userId)
    if (statusFilter) query.whereRaw('LOWER(el.status) = ?', [statusFilter])
    if (templateFilter) query.whereRaw('LOWER(el.template) = ?', [templateFilter])
    if (contextFilter) query.whereRaw('LOWER(el.context) = ?', [contextFilter])

    if (q) {
      const like = `%${q}%`
      query.where((qb) => {
        qb.whereRaw("LOWER(COALESCE(el.to_email, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(el.subject, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(el.template, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(el.context, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(el.status, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(el.error, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(u.username, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(u.email, '')) LIKE ?", [like])
      })
    }

    const results = await query
      .orderBy('el.created_at', 'desc')
      .paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: (results.data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        user: row.user_id
          ? {
              id: row.user_id,
              username: row.user_username,
              email: row.user_email
            }
          : null,
        company_id: row.company_id,
        company_name: row.company_name,
        template: row.template,
        context: row.context,
        to_email: row.to_email,
        cc: safeJson(row.cc, []),
        bcc: safeJson(row.bcc, []),
        subject: row.subject,
        body: row.body,
        attachments: safeJson(row.attachments, []),
        status: row.status,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    })
  }
}

function toPositiveInt(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null
  const n = Number(val)
  return Number.isInteger(n) && n > 0 ? n : null
}

function isProvided(val) {
  return val !== undefined && val !== null && String(val).trim() !== ''
}

function safeJson(str, fallback) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return fallback
  }
}

module.exports = EmailLogController
