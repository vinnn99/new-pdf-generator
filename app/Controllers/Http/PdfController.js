'use strict'

const JobService = require('../../Services/JobService')
const path = require('path')
const fs = require('fs')

class PdfController {
  async generate({ request, response }) {
    try {
      const payload = request.all()

      // Manual validation
      const requiredFields = ['data', 'template', 'callback']

      // Required fields per template
      const templateRequiredFields = {
        musik: [
          'nama', 'judul', 'nik', 'address', 'pt',
          'pencipta', 'asNama', 'bankName', 'npwp',
          'imail', 'phone', 'norek'
        ],
        invoice: ['companyName', 'clientName', 'items'],
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
