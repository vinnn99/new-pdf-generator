'use strict'

const Database = use('Database')

class CompanyController {
  /**
   * Ambil API key perusahaan milik user yang sedang login.
   */
  async apiKey({ auth, response }) {
    const user = await auth.getUser()

    if (!user || !user.company_id) {
      return response.status(404).json({
        status: 'error',
        message: 'User tidak terhubung ke perusahaan'
      })
    }

    const company = await Database.table('companies')
      .where('company_id', user.company_id)
      .first()

    if (!company) {
      return response.status(404).json({
        status: 'error',
        message: 'Perusahaan tidak ditemukan'
      })
    }

    return response.json({
      status: 'ok',
      company: {
        id: company.company_id,
        name: company.name,
        apiKey: company.api_key
      }
    })
  }
}

module.exports = CompanyController
