'use strict'

const PdfPrinter = require('pdfmake')
const Database = use('Database')
const path = require('path')
const fs = require('fs')
const WebhookSender = require('../Services/WebhookSender')
const TemplateResolver = require('../Services/TemplateResolver')

// Server-side font paths for pdfmake v0.2
const fontsDir = path.join(__dirname, '../Fonts')
const printer = new PdfPrinter({
  Roboto: {
    normal: path.join(fontsDir, 'Roboto_Condensed-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto_Condensed-Bold.ttf'),
    italics: path.join(fontsDir, 'Roboto_Condensed-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto_Condensed-BoldItalic.ttf'),
  }
})

class GeneratePdfJob {
  // This is required by AdonisJS for the Job
  static get key() {
    return 'GeneratePdfJob'
  }

  async handle(data) {
    let filename
    let filePath
    let downloadUrl
    let companyFolder
    let emailFolder
    try {
      console.log('Starting PDF generation job...')
      console.log('Data:', JSON.stringify(data, null, 2))

      // Extract payload — companyName & email are top-level fields
      const { data: payloadData, template, callback, companyName, email, userId, companyId, filenameTemplate } = data

      // Validate template name
      if (!template || typeof template !== 'string') {
        throw new Error('Invalid template name')
      }

      // Resolve template: DB dynamic first, then fallback ke file JS legacy
      const resolvedTemplate = await TemplateResolver.resolve(template, { companyId })
      if (!resolvedTemplate) {
        throw new Error(`Template '${template}' tidak ditemukan`)
      }

      // Generate PDF document definition
      console.log('Generating PDF document definition...')
      let docDefinition
      if (resolvedTemplate.source === 'dynamic') {
        docDefinition = TemplateResolver.renderDynamicDocDefinition(
          resolvedTemplate.templateRecord,
          payloadData
        )
      } else {
        const templateFunction = resolvedTemplate.templateFunction
        if (typeof templateFunction !== 'function') {
          throw new Error(`Template '${template}' must export a function`)
        }
        docDefinition = templateFunction(payloadData)
      }

      // Create PDF
      console.log('Creating PDF...')
      const pdfDoc = printer.createPdfKitDocument(docDefinition)

      // Generate PDF as buffer
      const pdfBuffer = await new Promise((resolve, reject) => {
        const chunks = []
        pdfDoc.on('data', chunk => chunks.push(chunk))
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
        pdfDoc.on('error', err => reject(new Error(`PDF generation failed: ${err}`)))
        pdfDoc.end()
      })

      console.log('PDF generated successfully, saving to disk...')

      // Sanitize folder names — hapus karakter tidak valid untuk nama folder
      const sanitize = (str) => (str || 'unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
      companyFolder = sanitize(companyName)
      emailFolder   = sanitize(email)

      // Buat folder public/download/{companyName}/{email}/ — recursive, tidak error kalau sudah ada
      const downloadDir = path.join(process.cwd(), 'public', 'download', companyFolder, emailFolder)
      fs.mkdirSync(downloadDir, { recursive: true })

      // Simpan PDF dengan kode unik.
      const uniqueId  = Date.now().toString(36) + Math.random().toString(36).slice(2, 7).toUpperCase()

      // Helper untuk penamaan file
      const safe = (str) => (str || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_')
      const periodFromPayload = payloadData && (payloadData.period || payloadData.periode)
      const currentPeriod = (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      })()
      const normalizedPeriod = periodFromPayload
        ? sanitizeSlipSegment(String(periodFromPayload).trim().replace(/\//g, '-'), currentPeriod)
        : currentPeriod
      const normalizedFilenameTemplate = sanitizeSlipSegment(normalizeFilenameTemplate(filenameTemplate || template), 'payslip').toLowerCase()

      // Penamaan file per template
      if (isSlipFilenameTemplate(template)) {
        const nip = payloadData && payloadData.employeeId ? String(payloadData.employeeId) : 'NIP'
        const nama = payloadData && payloadData.employeeName ? String(payloadData.employeeName) : 'NAME'
        filename = `${normalizedPeriod}.${normalizedFilenameTemplate}.${sanitizeSlipSegment(nip, 'NIP')}.${sanitizeSlipSegment(nama, 'NAME')}.${uniqueId}.pdf`
      } else if (template === 'ba-penempatan') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const outlet  = payloadData && payloadData.outlet ? String(payloadData.outlet) : 'OUTLET'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-penempatan.${safe(mdsName)}.${safe(outlet)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-request-id') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const area     = payloadData && payloadData.area ? String(payloadData.area) : 'AREA'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-request-id.${safe(mdsName)}.${safe(area)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-hold') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const region  = payloadData && payloadData.region ? String(payloadData.region) : 'REGION'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-hold.${safe(mdsName)}.${safe(region)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-rolling') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const region  = payloadData && payloadData.region ? String(payloadData.region) : 'REGION'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-rolling.${safe(mdsName)}.${safe(region)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-hold-activate') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const region  = payloadData && payloadData.region ? String(payloadData.region) : 'REGION'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-hold-activate.${safe(mdsName)}.${safe(region)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-takeout') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const region  = payloadData && payloadData.region ? String(payloadData.region) : 'REGION'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-takeout.${safe(mdsName)}.${safe(region)}.${safeLetter}.${uniqueId}.pdf`
      } else if (template === 'ba-terminated') {
        const mdsName = payloadData && payloadData.mdsName ? String(payloadData.mdsName) : 'MDS'
        const region  = payloadData && payloadData.region ? String(payloadData.region) : 'REGION'
        const letterNo = payloadData && payloadData.letterNo ? String(payloadData.letterNo) : 'LETTERNO'
        const safeLetter = safe(letterNo.replace(/\//g, '-'))
        filename = `ba-terminated.${safe(mdsName)}.${safe(region)}.${safeLetter}.${uniqueId}.pdf`
      } else {
        filename  = `${template}_${uniqueId}.pdf`
      }
      filePath  = path.join(downloadDir, filename)
      fs.writeFileSync(filePath, pdfBuffer)
      console.log(`PDF saved to: ${filePath}`)

      // Bangun download URL
      const baseUrl    = process.env.APP_URL || `http://localhost:${process.env.PORT || 3334}`
      downloadUrl = `${baseUrl}/download/${encodeURIComponent(companyFolder)}/${encodeURIComponent(emailFolder)}/${encodeURIComponent(filename)}`

      // Kirim webhook dengan download URL (bukan base64)
      const webhookPayload = {
        success:      true,
        download_url: downloadUrl,
        filename:     filename,
        saved_at:     `public/download/${companyFolder}/${emailFolder}/${filename}`,
        template:     template,
        email:        email,
        companyName:  companyName,
        data:         payloadData
      }

      // Simpan metadata ke DB
      let generatedId = null
      try {
        const inserted = await Database.table('generated_pdfs').insert({
          user_id: userId || null,
          company_id: companyId || null,
          template,
          filename,
          download_url: downloadUrl,
          saved_path: `public/download/${companyFolder}/${emailFolder}/${filename}`,
          email,
          company_name: companyName || 'unknown',
          data: JSON.stringify(payloadData || {}),
          created_at: new Date(),
          updated_at: new Date()
        })
        generatedId = Array.isArray(inserted) ? inserted[0] : inserted
      } catch (err) {
        console.error('Failed to insert generated_pdfs record:', err.message)
      }

      if (callback && callback.url) {
        try {
          const result = await WebhookSender.send(
            callback.url,
            webhookPayload,
            {
              headers:    callback.header || {},
              timeout:    10000,
              maxRetries: 3,
              retryDelay: 2000
            }
          )
          console.log('[Job] Webhook delivered successfully')
          console.log('[Job] Response:', result)

          if (generatedId) {
            await Database.table('generated_pdfs')
              .where('id', generatedId)
              .update({
                callback_status: result.statusCode || null,
                callback_response: typeof result.body === 'string' ? result.body : JSON.stringify(result.body),
                updated_at: new Date()
              })
          }
        } catch (err) {
          console.error('[Job] Webhook failed:', err.message)
          if (generatedId) {
            await Database.table('generated_pdfs')
              .where('id', generatedId)
              .update({
                callback_status: null,
                callback_error: err.message,
                updated_at: new Date()
              })
          }
          throw err
        }
      }

      // Kembalikan metadata dasar agar bisa dipakai pemanggil sinkron (opsional)
      return {
        filename,
        filePath,
        downloadUrl,
        companyFolder,
        emailFolder
      }

    } catch (error) {
      console.error('GeneratePdfJob error:', error.message)
      throw error
    }
  }
}

function normalizeFilenameTemplate(value) {
  const raw = (value || '').toString().trim().toLowerCase()
  return raw || 'payslip'
}

function isSlipFilenameTemplate(template) {
  const keyA = normalizeFilenameTemplate(template)
  return ['payslip', 'insentif', 'thr'].includes(keyA)
}

function sanitizeSlipSegment(value, fallback) {
  const cleaned = (value === undefined || value === null ? '' : String(value))
    .trim()
    .replace(/\//g, '-')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\./g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (cleaned) return cleaned
  return fallback || 'UNKNOWN'
}

module.exports = GeneratePdfJob
