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

    const applyRoleScope = (query) => {
      if (isSuper) {
        return query // superadmin melihat semua
      }

      if (isAdmin) {
        if (user.company_id) query.where('company_id', user.company_id)
        else query.whereRaw('1=0') // admin tanpa company tidak boleh melihat apa pun
        return query
      }

      query.where('user_id', user.id)
      return query
    }

    // Ambil ID dulu agar ORDER BY tidak menyortir baris besar (json/text) di memori.
    const idPage = await applyRoleScope(Database.table('generated_pdfs'))
      .select('id')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    const orderedIds = idPage.data.map((row) => row.id)
    let rows = []

    if (orderedIds.length > 0) {
      const fullRows = await Database.table('generated_pdfs')
        .whereIn('id', orderedIds)

      const byId = new Map(fullRows.map((row) => [String(row.id), row]))
      rows = orderedIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
    }

    // Format tanggal ke YYYY-MM-DD hh:mm:ss
    const formatDate = (d) => {
      if (!d) return null
      const pad = (n) => String(n).padStart(2, '0')
      const date = new Date(d)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    const formattedData = rows.map((row) => ({
      ...row,
      created_at: formatDate(row.created_at),
      updated_at: formatDate(row.updated_at)
    }))

    return response.json({
      status: 'ok',
      total: idPage.total,
      perPage: idPage.perPage,
      page: idPage.page,
      lastPage: idPage.lastPage,
      data: formattedData
    })
  }
}

module.exports = GeneratedPdfController
