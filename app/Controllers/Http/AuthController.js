'use strict'

const Database = use('Database')
const User = use('App/Models/User')
const { validate } = use('Validator')

class AuthController {
  async register({ request, response }) {
    try {
      const apiKey = request.header('x-api-key')

      if (!apiKey) {
        return response.status(401).json({
          status: 'error',
          message: 'API key (header: x-api-key) wajib diisi'
        })
      }

      const company = await Database.table('companies').where('api_key', apiKey).first()
      if (!company) {
        return response.status(401).json({
          status: 'error',
          message: 'API key tidak valid'
        })
      }

      const payload = request.only(['username', 'email', 'password'])
      if (payload.email) payload.email = payload.email.toLowerCase()

      const rules = {
        username: 'required|unique:users,username',
        email: 'required|email|unique:users,email',
        password: 'required|min:6'
      }

      const validation = await validate(payload, rules)
      if (validation.fails()) {
        return response.status(422).json({
          status: 'validation_failed',
          message: 'Validasi gagal',
          errors: validation.messages()
        })
      }

      const user = await User.create({
        username: payload.username,
        email: payload.email,
        password: payload.password,
        company_id: company.company_id
      })

      return response.status(201).json({
        status: 'registered',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          company: {
            id: company.company_id,
            name: company.name
          }
        }
      })
    } catch (error) {
      console.error('Register error:', error.message)
      return response.status(500).json({
        status: 'error',
        message: 'Gagal registrasi user',
        error: error.message
      })
    }
  }

  async login({ request, response, auth }) {
    try {
      const payload = request.only(['email', 'password'])
      if (payload.email) payload.email = payload.email.toLowerCase()

      const rules = {
        email: 'required|email',
        password: 'required|min:6'
      }

      const validation = await validate(payload, rules)
      if (validation.fails()) {
        return response.status(422).json({
          status: 'validation_failed',
          message: 'Validasi gagal',
          errors: validation.messages()
        })
      }

      const user = await User.query()
        .where('email', payload.email)
        .first()

      if (!user) {
        return response.status(401).json({
          status: 'error',
          message: 'User tidak ditemukan'
        })
      }

      // Generate JWT token
      const token = await auth.authenticator('jwt').attempt(payload.email, payload.password)

      let company = null
      if (user.company_id) {
        company = await Database.table('companies').where('company_id', user.company_id).first()
      }

      return response.status(200).json({
        status: 'logged_in',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          company: company
            ? { id: company.company_id, name: company.name }
            : null
        }
      })
    } catch (error) {
      console.error('Login error:', error.message)
      return response.status(401).json({
        status: 'error',
        message: 'Kredensial salah atau gagal login',
        error: error.message
      })
    }
  }
}

module.exports = AuthController
