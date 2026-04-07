'use strict'

const Database = use('Database')

class GeneratedPdfController {
  async index({ request, response, auth }) {
    const user = auth.user
    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const role = user && String(user.role).toLowerCase()
    const isAdmin = role === 'admin'
    const isSuper = role === 'superadmin'

    const query = Database.table('generated_pdfs')
    if (isSuper) {
      // superadmin melihat semua
    } else if (isAdmin) {
      if (user.company_id) query.where('company_id', user.company_id)
      else query.whereRaw('1=0') // admin tanpa company tidak boleh melihat apa pun
    } else {
      query.where('user_id', user.id)
    }

    const results = await query
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    // Format tanggal ke YYYY-MM-DD hh:mm:ss
    const formatDate = (d) => {
      if (!d) return null
      const pad = (n) => String(n).padStart(2, '0')
      const date = new Date(d)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    const formattedData = results.data.map((row) => ({
      ...row,
      created_at: formatDate(row.created_at),
      updated_at: formatDate(row.updated_at)
    }))

    return response.json({
      status: 'ok',
      total: results.total,
      perPage: results.perPage,
      page: results.page,
      lastPage: results.lastPage,
      data: formattedData
    })
  }
}

module.exports = GeneratedPdfController
