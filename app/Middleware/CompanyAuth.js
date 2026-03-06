'use strict'

const Database = use('Database')

class CompanyAuth {
  async handle({ request, response }, next) {
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

    const email = request.input('email')
    if (!email) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'Field email wajib diisi'
      })
    }

    const user = await Database.table('users').where('email', email).first()
    if (!user) {
      return response.status(401).json({
        status: 'error',
        message: 'Email tidak terdaftar'
      })
    }

    // Attach ke request untuk dipakai controller
    request.company = company
    request.user = user

    await next()
  }
}

module.exports = CompanyAuth
