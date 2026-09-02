'use strict'

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const Database = use('Database')

class BatchController {
  static resolveSafeDownloadPath(savedPath) {
    if (!savedPath || typeof savedPath !== 'string') return null

    const normalized = savedPath.replace(/\\/g, '/')
    const safeRoot = path.resolve(process.cwd(), 'public', 'download')
    const absolute = path.resolve(process.cwd(), normalized)
    const relative = path.relative(safeRoot, absolute)

    if (
      relative === '' ||
      (!relative.startsWith('..') && !path.isAbsolute(relative))
    ) {
      return absolute
    }

    return null
  }

  static sanitizeZipEntryName(value, fallback = 'batch-file.pdf') {
    const raw = String(value || '').trim()
    const cleaned = raw
      .replace(/\\/g, '/')
      .split('/')
      .join('-')
      .replace(/\.\.+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return cleaned || fallback
  }

  async downloadZip({ params, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengunduh batch zip'
      })
    }

    const batchId = String(params.batch_id || '').trim()
    if (!batchId) {
      return response.status(400).json({ status: 'error', message: 'batch_id tidak valid' })
    }

    const batch = await Database.from('generation_batches')
      .where('batch_id', batchId)
      .first()

    if (!batch) {
      return response.status(404).json({ status: 'error', message: 'Batch tidak ditemukan' })
    }

    if ((role === 'user' || role === 'admin') && Number(batch.company_id) !== Number(actor.company_id)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Batch di luar scope company user/admin'
      })
    }

    const itemRows = await Database.from('generation_batch_items as gbi')
      .leftJoin('generated_pdfs as gp', 'gbi.generated_pdf_id', 'gp.id')
      .where('gbi.batch_id', batchId)
      .where('gbi.company_id', batch.company_id)
      .select(
        'gbi.row_no',
        'gbi.filename',
        'gbi.saved_path',
        'gbi.status',
        'gp.filename as generated_filename'
      )
      .orderBy('gbi.row_no', 'asc')

    const archiveFiles = itemRows
      .filter((item) => String(item.status || '').toLowerCase() === 'success')
      .map((item) => {
        const savedPath = item.saved_path || (item.generated_filename ? `public/download/${item.generated_filename}` : '')
        const absolute = BatchController.resolveSafeDownloadPath(savedPath)
        if (!absolute || !absolute.endsWith('.pdf') || !fs.existsSync(absolute)) return null
        return {
          absolute,
          entryName: BatchController.sanitizeZipEntryName(
            item.filename || item.generated_filename || `row-${item.row_no || 'batch'}.pdf`,
            `row-${item.row_no || 'batch'}.pdf`
          )
        }
      })
      .filter(Boolean)

    if (!archiveFiles.length) {
      return response.status(422).json({
        status: 'error',
        message: 'Tidak ada file PDF yang bisa didownload untuk batch ini'
      })
    }

    const zipName = `batch-${String(batchId).replace(/[^a-zA-Z0-9_-]/g, '-')}.zip`
    response.header('Content-Type', 'application/zip')
    response.header('Content-Disposition', `attachment; filename="${zipName}"`)

    const nativeResponse = response.response || response
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.on('error', (err) => {
      console.error('[BatchController.downloadZip] archive error:', err)
      if (!nativeResponse.headersSent) {
        response.status(500).json({ status: 'error', message: 'Gagal membuat ZIP batch' })
      }
    })

    response.implicitEnd = false
    archive.pipe(nativeResponse)

    for (const file of archiveFiles) {
      archive.file(file.absolute, { name: file.entryName })
    }

    await archive.finalize()
    return response
  }

  async index({ request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses batch history'
      })
    }

    if ((role === 'user' || role === 'admin') && !actor.company_id) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'User/Admin harus memiliki company_id untuk mengakses batch history'
      })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 10)) || 10
    const perPage = Math.min(Math.max(perPageRaw, 1), 100)

    const template = String(request.input('template') || '').trim().toLowerCase()
    const companyIdFilter = toPositiveInt(request.input('company_id'))

    if (companyIdFilter && role !== 'superadmin') {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Filter company_id hanya boleh dipakai superadmin'
      })
    }

    const query = Database.from('generation_batches as gb')
      .leftJoin('users as u', 'gb.created_by', 'u.id')
      .leftJoin('companies as c', 'gb.company_id', 'c.company_id')
      .select(
        'gb.id',
        'gb.batch_id',
        'gb.company_id',
        'c.name as company_name',
        'gb.template',
        'gb.created_by',
        'u.username as created_by_username',
        'u.email as created_by_email',
        'gb.total_rows',
        'gb.queued',
        'gb.failed',
        'gb.status',
        'gb.created_at',
        'gb.updated_at'
      )

    if (role === 'superadmin') {
      if (companyIdFilter) query.where('gb.company_id', companyIdFilter)
    } else {
      query.where('gb.company_id', actor.company_id)
    }

    if (template) query.where('gb.template', template)

    const result = await query.orderBy('gb.created_at', 'desc').paginate(page, perPage)

    return response.json({
      status: 'ok',
      total: result.total,
      perPage: result.perPage,
      page: result.page,
      lastPage: result.lastPage,
      data: result.data
    })
  }

  async show({ params, request, response, auth }) {
    const actor = await auth.getUser()
    const role = resolveRole(actor)

    if (!isAllowedRole(role)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Role tidak diizinkan mengakses batch history'
      })
    }

    const batchId = String(params.batch_id || '').trim()
    if (!batchId) {
      return response.status(400).json({ status: 'error', message: 'batch_id tidak valid' })
    }

    const batchQuery = Database.from('generation_batches as gb')
      .leftJoin('users as u', 'gb.created_by', 'u.id')
      .leftJoin('companies as c', 'gb.company_id', 'c.company_id')
      .where('gb.batch_id', batchId)
      .select(
        'gb.id',
        'gb.batch_id',
        'gb.company_id',
        'c.name as company_name',
        'gb.template',
        'gb.created_by',
        'u.username as created_by_username',
        'u.email as created_by_email',
        'gb.total_rows',
        'gb.queued',
        'gb.failed',
        'gb.status',
        'gb.created_at',
        'gb.updated_at'
      )
      .first()

    const batch = await batchQuery
    if (!batch) {
      return response.status(404).json({ status: 'error', message: 'Batch tidak ditemukan' })
    }

    if ((role === 'user' || role === 'admin') && Number(batch.company_id) !== Number(actor.company_id)) {
      return response.status(403).json({
        status: 'forbidden',
        message: 'Batch di luar scope company user/admin'
      })
    }

    const page = Number(request.input('page', 1)) || 1
    const perPageRaw = Number(request.input('perPage', 20)) || 20
    const perPage = Math.min(Math.max(perPageRaw, 1), 200)

    const itemQuery = Database.from('generation_batch_items as gbi')
      .leftJoin('generated_pdfs as gp', 'gbi.generated_pdf_id', 'gp.id')
      .where('gbi.batch_id', batchId)
      .select(
        'gbi.id',
        'gbi.batch_id',
        'gbi.company_id',
        'gbi.template',
        'gbi.row_no',
        'gbi.match_key',
        'gbi.letter_no',
        'gbi.filename',
        'gbi.saved_path',
        'gbi.generated_pdf_id',
        'gbi.status',
        'gbi.error',
        'gbi.created_at',
        'gbi.updated_at',
        'gp.download_url'
      )

    const items = await itemQuery.orderBy('gbi.row_no', 'asc').paginate(page, perPage)

    return response.json({
      status: 'ok',
      batch,
      items: {
        total: items.total,
        perPage: items.perPage,
        page: items.page,
        lastPage: items.lastPage,
        data: items.data
      }
    })
  }
}

function resolveRole(user) {
  return String((user && user.role) || '').toLowerCase()
}

function isAllowedRole(role) {
  return ['user', 'admin', 'superadmin'].includes(role)
}

function toPositiveInt(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

module.exports = BatchController

