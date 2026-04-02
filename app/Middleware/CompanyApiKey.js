'use strict'

const Database = use('Database')

/**
 * Middleware ringan untuk otentikasi hanya dengan header x-api-key.
 * Dipakai untuk endpoint bulk upload yang memproses banyak email sekaligus,
 * sehingga tidak cocok memakai CompanyAuth yang mewajibkan field email tunggal.
 */
class CompanyApiKey {
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

    request.company = company

    await next()
  }
}

module.exports = CompanyApiKey
