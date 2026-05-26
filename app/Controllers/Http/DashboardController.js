'use strict'

const Database = use('Database')

class DashboardController {
  /**
   * Ringkasan cepat untuk dashboard berbasis company user login.
   * Auth: JWT
   * Response:
   * {
   *   status: "ok",
   *   company: { id, name },
   *   pdf: { total, byTemplate: [...], recent: [...] },
   *   email: { totalSent, totalFailed, byTemplate: [...], recent: [...] }
   * }
  */
  async summary({ auth, request, response }) {
    const user = await auth.getUser()
    if (!user) {
      return response.status(401).json({ status: 'error', message: 'User tidak ditemukan' })
    }

    const role = String(user.role || '').toLowerCase()
    const isSuper = role === 'superadmin'
    const isAdmin = role === 'admin'
    const scopeParam = (request.input('scope') || '').toString().toLowerCase()
    const normalizedScopeParam = ['user', 'company', 'all'].includes(scopeParam) ? scopeParam : ''

    // Samakan default scope dengan /generated-pdfs:
    // - user      -> user
    // - admin     -> company
    // - superadmin-> all
    let scope = isSuper ? 'all' : isAdmin ? 'company' : 'user'

    if (normalizedScopeParam === 'all' && !isSuper) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Scope all hanya untuk superadmin'
      })
    }

    // Scope override hanya untuk superadmin.
    if (isSuper && normalizedScopeParam) {
      scope = normalizedScopeParam
    }

    // Superadmin tanpa company tidak bisa dipaksa ke scope company/user.
    if (!user.company_id && isSuper && scope !== 'all') {
      scope = 'all'
    }

    let company = null
    if (user.company_id) {
      company = await Database.table('companies')
        .where('company_id', user.company_id)
        .first()
      if (scope === 'company' && !company) {
        return response.status(404).json({ status: 'error', message: 'Perusahaan tidak ditemukan' })
      }
    }

    const scopeUser = scope === 'user'
    const scopeAllCompanies = scope === 'all'
    const scopeCompany = scope === 'company'
    const companyId = company ? company.company_id : null

    // Total PDF
    const pdfTotalRow = await Database.table('generated_pdfs')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('company_id', companyId)
        if (scopeUser) qb.andWhere('user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .count('* as total')
      .first()

    const pdfByTemplate = await Database.from('generated_pdfs')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('company_id', companyId)
        if (scopeUser) qb.andWhere('user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .select('template')
      .count('* as total')
      .groupBy('template')

    const pdfRecent = await Database.from('generated_pdfs as gp')
      .leftJoin('companies as c', 'gp.company_id', 'c.company_id')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('gp.company_id', companyId)
        if (scopeUser) qb.andWhere('gp.user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .orderBy('gp.created_at', 'desc')
      .limit(5)
      .select('gp.id', 'gp.template', 'gp.filename', 'gp.download_url', 'gp.email', 'gp.created_at', 'gp.company_id', 'c.name as company_name')

    // Email logs
    const emailSentRow = await Database.table('email_logs')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('company_id', companyId)
        if (scopeUser) qb.andWhere('user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .where('status', 'sent')
      .count('* as total')
      .first()

    const emailFailedRow = await Database.table('email_logs')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('company_id', companyId)
        if (scopeUser) qb.andWhere('user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .where('status', 'failed')
      .count('* as total')
      .first()

    const emailByTemplate = await Database.from('email_logs')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('company_id', companyId)
        if (scopeUser) qb.andWhere('user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .select('template', 'context')
      .count('* as total')
      .groupBy('template', 'context')

    const emailRecentRaw = await Database.from('email_logs as el')
      .leftJoin('companies as c', 'el.company_id', 'c.company_id')
      .where((qb) => {
        if (scopeCompany && companyId) qb.andWhere('el.company_id', companyId)
        if (scopeUser) qb.andWhere('el.user_id', user.id)
        if (scopeCompany && !companyId) qb.whereRaw('1=0')
      })
      .orderBy('el.created_at', 'desc')
      .limit(5)
      .select('el.id', 'el.template', 'el.context', 'el.to_email', 'el.subject', 'el.attachments', 'el.status', 'el.error', 'el.created_at', 'el.company_id', 'c.name as company_name')

    // Group by company (only if scope=all)
    let pdfByCompany = []
    let emailByCompany = []
    if (scopeAllCompanies) {
      pdfByCompany = await Database.from('generated_pdfs as gp')
        .leftJoin('companies as c', 'gp.company_id', 'c.company_id')
        .select('gp.company_id', 'c.name as company_name')
        .count('* as total')
        .groupBy('gp.company_id', 'c.name')

      emailByCompany = await Database.from('email_logs as el')
        .leftJoin('companies as c', 'el.company_id', 'c.company_id')
        .select('el.company_id', 'c.name as company_name')
        .count('* as total')
        .groupBy('el.company_id', 'c.name')
    }

    const emailRecent = emailRecentRaw.map((row) => ({
      ...row,
      attachments: safeJson(row.attachments, [])
    }))

    return response.json({
      status: 'ok',
      company: scopeAllCompanies
        ? { id: null, name: 'ALL' }
        : company
          ? { id: company.company_id, name: company.name }
          : null,
      scope: scopeAllCompanies ? 'all' : scopeUser ? 'user' : 'company',
      pdf: {
        total: toNumber(pdfTotalRow && pdfTotalRow.total),
        byTemplate: normalizeCounts(pdfByTemplate),
        byCompany: normalizeCompanyCounts(pdfByCompany),
        recent: pdfRecent
      },
      email: {
        totalSent: toNumber(emailSentRow && emailSentRow.total),
        totalFailed: toNumber(emailFailedRow && emailFailedRow.total),
        byTemplate: emailByTemplate.map((row) => ({
          template: row.template,
          context: row.context,
          total: toNumber(row.total)
        })),
        byCompany: normalizeCompanyCounts(emailByCompany),
        recent: emailRecent
      }
    })
  }
}

function toNumber(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function normalizeCounts(rows) {
  return (rows || []).map((row) => ({
    template: row.template,
    total: toNumber(row.total)
  }))
}

function normalizeCompanyCounts(rows) {
  return (rows || []).map((row) => ({
    companyId: row.company_id,
    companyName: row.company_name,
    total: toNumber(row.total)
  }))
}

function safeJson(str, fallback) {
  try { return JSON.parse(str) } catch (e) { return fallback }
}

module.exports = DashboardController
