'use strict'

const Database = use('Database')

class CompanyAuth {
  async handle({ request, response }, next) {
    const apiKey = request.header('x-api-key')
    console.log('[companyAuth] header x-api-key =', apiKey)

    if (!apiKey) {
      return response.status(401).json({
        status: 'error',
        message: 'API key (header: x-api-key) wajib diisi'
      })
    }

    const emailRaw = request.input('email')
    const email = emailRaw ? emailRaw.toLowerCase() : emailRaw
    console.log('[companyAuth] email body =', email)

    if (!email) {
      return response.status(422).json({
        status: 'validation_failed',
        message: 'Field email wajib diisi'
      })
    }

    const user = await Database.table('users').where('email', email).first()
    console.log('[companyAuth] user row =', user)

    if (!user) {
      return response.status(401).json({
        status: 'error',
        message: 'Email tidak terdaftar'
      })
    }

    if (!user.company_id) {
      return response.status(401).json({
        status: 'error',
        message: 'User belum terhubung ke perusahaan'
      })
    }

    const company = await Database.table('companies').where('company_id', user.company_id).first()
    console.log('[companyAuth] company row (by user.company_id) =', company)

    if (!company) {
      return response.status(401).json({
        status: 'error',
        message: 'Perusahaan untuk user tidak ditemukan'
      })
    }

    if (company.api_key !== apiKey) {
      return response.status(401).json({
        status: 'error',
        message: 'API key tidak cocok dengan perusahaan user'
      })
    }

    // Attach ke request untuk dipakai controller
    request.company = company
    request.user = user

    await next()
  }
}

module.exports = CompanyAuth
