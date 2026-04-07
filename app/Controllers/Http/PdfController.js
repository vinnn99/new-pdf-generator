'use strict'

const JobService = require('../../Services/JobService')
const path = require('path')
const fs = require('fs')

class PdfController {
  async generate({ request, response }) {
    try {
      const payload = request.all()
      const company = request.company
      const user = request.user

      console.log('[pdf.generate] raw payload =', JSON.stringify(payload, null, 2))
      console.log('[pdf.generate] attached company =', company)
      console.log('[pdf.generate] attached user =', user)

      // Manual validation
      const requiredFields = ['data', 'template', 'email']

      // Required fields per template
      const templateRequiredFields = {
        musik: [
          'nama', 'judul', 'nik', 'address', 'pt',
          'pencipta', 'asNama', 'bankName', 'npwp',
          'imail', 'phone', 'norek'
        ],
        invoice: ['clientName', 'items'],
        thr: ['employeeName', 'position', 'period', 'payoutDate', 'baseSalary'],
        payslip: ['employeeName', 'position', 'period'],
        'ba-penempatan': ['letterNo', 'mdsName', 'nik', 'placementDate', 'outlet'],
      }

      const errors = []

      for (const f of requiredFields) {
        if (!payload[f]) errors.push(`Field ${f} is required`)
      }

      if (payload.data && typeof payload.data === 'object' && payload.template) {
        const required = templateRequiredFields[payload.template] || []
        for (const f of required) {
          if (!payload.data[f]) errors.push(`Field data.${f} is required`)
        }
      }

      if (payload.callback && !payload.callback.url) {
        errors.push('Field callback.url is required')
      }

      if (errors.length > 0) {
        return response.status(422).json({
          status: 'validation_failed',
          message: 'Validation failed',
          errors
        })
      }

      // Validasi template diizinkan untuk company
      if (company) {
        const allowed = company.allowed_templates ? (() => {
          try { return JSON.parse(company.allowed_templates) } catch (e) { return [] }
        })() : []
        if (Array.isArray(allowed) && allowed.length > 0) {
          if (!allowed.includes(payload.template)) {
            return response.status(403).json({
              status: 'forbidden',
              message: `Template '${payload.template}' tidak diizinkan untuk company ini`
            })
          }
        }
      }

      // Sisipkan companyName dari hasil middleware (API key)
      if (company) {
        payload.companyName = company.name
        if (payload.data && typeof payload.data === 'object' && !payload.data.companyName) {
          payload.data.companyName = company.name
        }
      }

      // Sisipkan user/company id untuk pencatatan hasil
      payload.userId = user ? user.id : null
      payload.companyId = company ? company.company_id : null

      // Push job to queue
      await JobService.dispatch('App/Jobs/GeneratePdfJob', payload, {
        attempts: 3,
        timeout: 120000 // 2 minutes timeout for PDF generation
      })

      return response.status(202).json({
        status: 'queued',
        message: 'PDF generation is being processed'
      })
    } catch (error) {
      console.error('PDF Controller Error:', error.message)
      return response.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      })
    }
  }

  async download({ params, response }) {
    try {
      const { company, email, filename } = params

      // Decode URL-encoded path segments
      const companyDecoded  = decodeURIComponent(company)
      const emailDecoded    = decodeURIComponent(email)
      const filenameDecoded = decodeURIComponent(filename)

      // Hanya izinkan file .pdf
      if (!filenameDecoded.endsWith('.pdf')) {
        return response.status(400).json({ status: 'error', message: 'Invalid file type' })
      }

      const filePath = path.join(
        process.cwd(), 'public', 'download',
        companyDecoded, emailDecoded, filenameDecoded
      )

      if (!fs.existsSync(filePath)) {
        return response.status(404).json({ status: 'error', message: 'File not found' })
      }

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filenameDecoded}"`)

      const fileBuffer = fs.readFileSync(filePath)
      return response.send(fileBuffer)

    } catch (error) {
      console.error('Download Error:', error.message)
      return response.status(500).json({ status: 'error', message: 'Failed to download file' })
    }
  }
}

module.exports = PdfController
