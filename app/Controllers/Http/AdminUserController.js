'use strict'

const Database = use('Database')
const User = use('App/Models/User')
const { validate } = use('Validator')

class AdminUserController {
  async index({ request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat melihat daftar user' })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const query = Database.table('users')
    if (isAdmin) {
      if (!admin.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      query.where('company_id', admin.company_id)
    } // superadmin: semua

    const results = await query
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: results.data.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        company_id: u.company_id,
        created_at: u.created_at,
        updated_at: u.updated_at,
      }))
    })
  }

  async store({ request, response, auth }) {
    const admin = auth.user
    const roleAdmin = admin && String(admin.role).toLowerCase()
    const isAdmin = roleAdmin === 'admin'
    const isSuper = roleAdmin === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Hanya admin/superadmin yang dapat membuat user baru'
      })
    }

    const payload = request.only(['username', 'email', 'password', 'role', 'company_id'])
    if (payload.email) payload.email = payload.email.toLowerCase()

    const rules = {
      username: 'required|unique:users,username',
      email: 'required|email|unique:users,email',
      password: 'required|min:6',
      role: 'in:user,admin,superadmin'
    }

    const validation = await validate(payload, rules)
    if (validation.fails()) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'Validasi gagal',
        errors: validation.messages()
      })
    }

    let targetCompanyId = null
    if (isAdmin) {
      if (!admin.company_id) {
        return response.status(400).json({ status: 'error', message: 'Admin belum terhubung ke perusahaan' })
      }
      targetCompanyId = admin.company_id
    } else if (isSuper) {
      targetCompanyId = payload.company_id || null
      if (payload.role !== 'superadmin' && !targetCompanyId) {
        return response.status(400).json({ status: 'error', message: 'company_id wajib diisi untuk role user/admin' })
      }
    }

    if (targetCompanyId) {
      const company = await Database.table('companies').where('company_id', targetCompanyId).first()
      if (!company) return response.status(400).json({ status: 'error', message: 'Perusahaan tidak ditemukan' })
      if (company.is_active === false) return response.status(400).json({ status: 'error', message: 'Perusahaan tidak aktif' })
    }

    const roleToSet = ['admin', 'superadmin'].includes(payload.role) ? payload.role : 'user'

    const user = await User.create({
      username: payload.username,
      email: payload.email,
      password: payload.password,
      company_id: roleToSet === 'superadmin' ? null : targetCompanyId,
      role: roleToSet
    })

    return response.status(201).json({
      status: 'created',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    })
  }

  async update({ request, params, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengubah user' })
    }

    const userId = Number(params.id)
    if (!userId) return response.status(400).json({ status: 'error', message: 'User id tidak valid' })

    const target = await User.find(userId)
    if (!target) return response.status(404).json({ status: 'error', message: 'User tidak ditemukan' })

    // Batasi hanya dalam perusahaan yang sama (jika admin punya company_id)
    if (isAdmin) {
      if (!admin.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      if (target.company_id !== admin.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'User tidak berada di perusahaan anda' })
      }
    }

    const payload = request.only(['username', 'email', 'role', 'is_active', 'company_id'])
    if (payload.email) payload.email = payload.email.toLowerCase()

    // Validasi manual + uniqueness
    if (payload.username) {
      const existing = await User.query().where('username', payload.username).whereNot('id', target.id).first()
      if (existing) return response.status(422).json({ status: 'validation_failed', message: 'Username sudah dipakai' })
      target.username = payload.username
    }

    if (payload.email) {
      const existing = await User.query().where('email', payload.email).whereNot('id', target.id).first()
      if (existing) return response.status(422).json({ status: 'validation_failed', message: 'Email sudah dipakai' })
      target.email = payload.email
    }

    if (payload.role) {
      const r = String(payload.role).toLowerCase()
      if (!['user', 'admin', 'superadmin'].includes(r)) {
        return response.status(422).json({ status: 'validation_failed', message: 'Role harus user/admin/superadmin' })
      }
      if (isAdmin && r === 'superadmin') {
        return response.status(403).json({ status: 'forbidden', message: 'Admin tidak boleh set role superadmin' })
      }
      target.role = r
    }

    if (payload.company_id !== undefined) {
      if (isAdmin) {
        return response.status(403).json({ status: 'forbidden', message: 'Admin tidak boleh mengubah company_id user' })
      }
      target.company_id = payload.company_id
    }

    if (payload.is_active !== undefined) {
      target.is_active = !!payload.is_active
    }

    await target.save()

    return response.json({
      status: 'updated',
      user: {
        id: target.id,
        username: target.username,
        email: target.email,
        role: target.role,
        is_active: target.is_active,
        company_id: target.company_id
      }
    })
  }

  async deactivate({ params, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat menonaktifkan user' })
    }

    const userId = Number(params.id)
    if (!userId) return response.status(400).json({ status: 'error', message: 'User id tidak valid' })

    const target = await User.find(userId)
    if (!target) return response.status(404).json({ status: 'error', message: 'User tidak ditemukan' })
    if (isAdmin) {
      if (!admin.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      if (target.company_id !== admin.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'User tidak berada di perusahaan anda' })
      }
    }

    target.is_active = false
    await target.save()

    return response.json({ status: 'deactivated', user_id: target.id })
  }

  async resetPassword({ params, request, response, auth }) {
    const admin = auth.user
    const role = admin && String(admin.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'
    if (!isAdmin && !isSuper) {
      return response.status(403).json({ status: 'forbidden', message: 'Hanya admin/superadmin yang dapat mengganti password user' })
    }

    const userId = Number(params.id)
    if (!userId) return response.status(400).json({ status: 'error', message: 'User id tidak valid' })

    const target = await User.find(userId)
    if (!target) return response.status(404).json({ status: 'error', message: 'User tidak ditemukan' })
    if (isAdmin) {
      if (!admin.company_id) return response.status(403).json({ status: 'forbidden', message: 'Admin harus memiliki company_id' })
      if (target.company_id !== admin.company_id) {
        return response.status(403).json({ status: 'forbidden', message: 'User tidak berada di perusahaan anda' })
      }
    }

    const payload = request.only(['password'])
    if (!payload.password || String(payload.password).length < 6) {
      return response.status(422).json({ status: 'validation_failed', message: 'Password minimal 6 karakter' })
    }

    target.password = payload.password
    await target.save()

    return response.json({ status: 'password_reset', user_id: target.id })
  }
}

module.exports = AdminUserController
