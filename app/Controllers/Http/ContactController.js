'use strict'

const Database = use('Database')
const Contact = use('App/Models/Contact')
const ContactService = use('App/Services/ContactService')

class ContactController {
  async index({ request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses contact'
      })
    }

    if (role === 'admin' && !actor.company_id) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Admin harus memiliki company_id'
      })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const q = String(request.input('q') || '').trim().toLowerCase()

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

    if (isProvided(companyIdRaw) && role !== 'superadmin') {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Filter company_id hanya untuk superadmin'
      })
    }

    if (role === 'user' && userId && userId !== actor.id) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'User hanya boleh melihat contact miliknya'
      })
    }

    if (role === 'admin' && userId) {
      const targetUser = await Database.table('users').where('id', userId).first()
      if (!targetUser || Number(targetUser.company_id) !== Number(actor.company_id)) {
        return response.status(403).json({
          status: 'forbidden',
          message: 'user_id di luar scope company admin'
        })
      }
    }

    const query = Database.from('contacts as ct')
      .leftJoin('users as u', 'ct.user_id', 'u.id')
      .leftJoin('companies as c', 'ct.company_id', 'c.company_id')
      .select(
        'ct.id',
        'ct.user_id',
        'u.username as user_username',
        'u.email as user_email',
        'ct.company_id',
        'c.name as company_name',
        'ct.email',
        'ct.name',
        'ct.phone',
        'ct.notes',
        'ct.source',
        'ct.last_sent_at',
        'ct.send_count',
        'ct.created_at',
        'ct.updated_at'
      )

    if (role === 'user') {
      query.where('ct.user_id', actor.id)
    } else if (role === 'admin') {
      query.where('ct.company_id', actor.company_id)
    }

    if (userId) query.where('ct.user_id', userId)
    if (companyId) query.where('ct.company_id', companyId)

    if (q) {
      const like = `%${q}%`
      query.where((qb) => {
        qb.whereRaw("LOWER(COALESCE(ct.email, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(ct.name, '')) LIKE ?", [like])
          .orWhereRaw("LOWER(COALESCE(ct.phone, '')) LIKE ?", [like])
      })
    }

    const results = await query
      .orderBy('ct.updated_at', 'desc')
      .paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: (results.data || []).map(serializeContactRow)
    })
  }

  async show({ params, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses contact'
      })
    }

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({ status: 'error', message: 'Contact id tidak valid' })
    }

    const row = await findContactRow(id)
    if (!row) {
      return response.status(404).json({ status: 'error', message: 'Contact tidak ditemukan' })
    }

    const access = canAccess(actor, role, row)
    if (!access.allowed) {
      return response.status(access.code).json({ status: 'forbidden', message: access.message })
    }

    return response.json({ status: 'ok', data: serializeContactRow(row) })
  }

  async store({ request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses contact'
      })
    }

    const payload = request.only(['email', 'name', 'phone', 'notes', 'user_id'])
    if (isProvided(payload.user_id) && !toPositiveInt(payload.user_id)) {
      return response.status(400).json({ status: 'error', message: 'user_id tidak valid' })
    }

    const normalizedEmail = ContactService.normalizeEmail(payload.email)
    if (!ContactService.isValidEmail(normalizedEmail)) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'Email tidak valid'
      })
    }

    const owner = await resolveOwnerForCreate(actor, role, payload.user_id)
    if (owner.error) {
      return response.status(owner.error.code).json({ status: owner.error.status, message: owner.error.message })
    }

    const duplicate = await Contact.query()
      .where('user_id', owner.user.id)
      .where('email', normalizedEmail)
      .first()
    if (duplicate) {
      return response.status(409).json({
        status: 'conflict',
        message: 'Contact dengan email tersebut sudah ada untuk user ini'
      })
    }

    const created = await Contact.create({
      user_id: owner.user.id,
      company_id: owner.user.company_id || null,
      email: normalizedEmail,
      name: payload.name || null,
      phone: payload.phone || null,
      notes: payload.notes || null,
      source: 'manual',
      last_sent_at: null,
      send_count: 0
    })

    const row = await findContactRow(created.id)
    return response.status(201).json({
      status: 'created',
      data: serializeContactRow(row)
    })
  }

  async update({ params, request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses contact'
      })
    }

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({ status: 'error', message: 'Contact id tidak valid' })
    }

    const contact = await Contact.find(id)
    if (!contact) {
      return response.status(404).json({ status: 'error', message: 'Contact tidak ditemukan' })
    }

    const access = canAccess(actor, role, contact)
    if (!access.allowed) {
      return response.status(access.code).json({ status: 'forbidden', message: access.message })
    }

    const payload = request.only(['email', 'name', 'phone', 'notes'])

    if (payload.email !== undefined) {
      const normalizedEmail = ContactService.normalizeEmail(payload.email)
      if (!ContactService.isValidEmail(normalizedEmail)) {
        return response.status(422).json({
          status: 'validation_failed',
          message: 'Email tidak valid'
        })
      }

      const duplicate = await Contact.query()
        .where('user_id', contact.user_id)
        .where('email', normalizedEmail)
        .whereNot('id', contact.id)
        .first()
      if (duplicate) {
        return response.status(409).json({
          status: 'conflict',
          message: 'Contact dengan email tersebut sudah ada untuk user ini'
        })
      }

      contact.email = normalizedEmail
    }

    if (payload.name !== undefined) contact.name = payload.name || null
    if (payload.phone !== undefined) contact.phone = payload.phone || null
    if (payload.notes !== undefined) contact.notes = payload.notes || null

    await contact.save()

    const row = await findContactRow(contact.id)
    return response.json({
      status: 'updated',
      data: serializeContactRow(row)
    })
  }

  async destroy({ params, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses contact'
      })
    }

    const id = toPositiveInt(params.id)
    if (!id) {
      return response.status(400).json({ status: 'error', message: 'Contact id tidak valid' })
    }

    const contact = await Contact.find(id)
    if (!contact) {
      return response.status(404).json({ status: 'error', message: 'Contact tidak ditemukan' })
    }

    const access = canAccess(actor, role, contact)
    if (!access.allowed) {
      return response.status(access.code).json({ status: 'forbidden', message: access.message })
    }

    await contact.delete()
    return response.json({ status: 'deleted', id: contact.id })
  }
}

async function resolveOwnerForCreate(actor, role, requestedUserId) {
  const requested = toPositiveInt(requestedUserId)

  if (role === 'user') {
    if (requested && requested !== actor.id) {
      return {
        error: {
          code: 403,
          status: 'forbidden',
          message: 'User hanya boleh membuat contact untuk dirinya sendiri'
        }
      }
    }
    return { user: actor }
  }

  if (role === 'admin') {
    if (!actor.company_id) {
      return {
        error: {
          code: 403,
          status: 'forbidden',
          message: 'Admin harus memiliki company_id'
        }
      }
    }

    if (!requested) return { user: actor }

    const target = await Database.table('users').where('id', requested).first()
    if (!target) {
      return {
        error: {
          code: 404,
          status: 'error',
          message: 'User target tidak ditemukan'
        }
      }
    }

    if (Number(target.company_id) !== Number(actor.company_id)) {
      return {
        error: {
          code: 403,
          status: 'forbidden',
          message: 'User target di luar scope company admin'
        }
      }
    }

    return { user: target }
  }

  if (requested) {
    const target = await Database.table('users').where('id', requested).first()
    if (!target) {
      return {
        error: {
          code: 404,
          status: 'error',
          message: 'User target tidak ditemukan'
        }
      }
    }
    return { user: target }
  }

  return { user: actor }
}

function resolveRole(user) {
  return String((user && user.role) || '').toLowerCase()
}

function isAllowedRole(role) {
  return ['user', 'admin', 'superadmin'].includes(role)
}

function canAccess(actor, role, contact) {
  if (role === 'superadmin') return { allowed: true }

  if (role === 'admin') {
    if (!actor.company_id) {
      return { allowed: false, code: 403, message: 'Admin harus memiliki company_id' }
    }
    if (Number(contact.company_id) !== Number(actor.company_id)) {
      return { allowed: false, code: 403, message: 'Contact di luar scope company admin' }
    }
    return { allowed: true }
  }

  if (Number(contact.user_id) !== Number(actor.id)) {
    return { allowed: false, code: 403, message: 'Contact bukan milik user login' }
  }
  return { allowed: true }
}

async function findContactRow(id) {
  return Database.from('contacts as ct')
    .leftJoin('users as u', 'ct.user_id', 'u.id')
    .leftJoin('companies as c', 'ct.company_id', 'c.company_id')
    .where('ct.id', id)
    .select(
      'ct.id',
      'ct.user_id',
      'u.username as user_username',
      'u.email as user_email',
      'ct.company_id',
      'c.name as company_name',
      'ct.email',
      'ct.name',
      'ct.phone',
      'ct.notes',
      'ct.source',
      'ct.last_sent_at',
      'ct.send_count',
      'ct.created_at',
      'ct.updated_at'
    )
    .first()
}

function serializeContactRow(row) {
  if (!row) return null

  return {
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
    email: row.email,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    source: row.source,
    last_sent_at: row.last_sent_at,
    send_count: toNumber(row.send_count),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
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

module.exports = ContactController
