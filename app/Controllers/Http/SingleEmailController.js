'use strict'

const JobService = require('../../Services/JobService')
const Database = use('Database')
const GeneratePdfJob = use('App/Jobs/GeneratePdfJob')
const Env = use('Env')

class SingleEmailController {
  async sendBaPenempatan(ctx) {
    return this._send(ctx, cfgBa('ba-penempatan'))
  }
  async sendBaRequestId(ctx) {
    return this._send(ctx, cfgBa('ba-request-id'))
  }
  async sendBaHold(ctx) {
    return this._send(ctx, cfgBa('ba-hold'))
  }
  async sendBaRolling(ctx) {
    return this._send(ctx, cfgBa('ba-rolling'))
  }
  async sendBaHoldActivate(ctx) {
    return this._send(ctx, cfgBa('ba-hold-activate'))
  }
  async sendBaTerminated(ctx) {
    return this._send(ctx, cfgBa('ba-terminated'))
  }

  /**
   * Generic handler untuk BA single email.
   * Body JSON:
   * {
   *   "to": "email@tujuan.com", (wajib)
   *   "cc": ["..."],            (opsional)
   *   "bcc": ["..."],           (opsional)
   *   "subject": "...",         (opsional, auto default jika kosong)
   *   "body": "...",            (opsional, auto default jika kosong)
   *   "data": { ... }           (wajib sesuai template)
   * }
   */
  async _send({ request, response, auth }, cfg) {
    try {
      const user = await auth.getUser()
      if (!user || !user.company_id) {
        return response.status(401).json({ status: 'error', message: 'User belum terhubung ke perusahaan' })
      }

      const company = await Database.table('companies').where('company_id', user.company_id).first()
      if (!company) {
        return response.status(401).json({ status: 'error', message: 'Perusahaan user tidak ditemukan' })
      }

      const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom } = pickSmtpConfig(company)
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        return response.status(500).json({ status: 'error', message: 'Konfigurasi SMTP belum lengkap di perusahaan atau .env' })
      }

      const bodyJson = request.all()
      const to = (bodyJson.to || '').toLowerCase().trim()
      const cc = Array.isArray(bodyJson.cc) ? bodyJson.cc : []
      const bcc = Array.isArray(bodyJson.bcc) ? bodyJson.bcc : []
      const data = bodyJson.data || {}

      if (!to) {
        return response.status(422).json({ status: 'validation_failed', message: 'Field to wajib diisi' })
      }

      // Validasi field wajib per template
      const missing = (cfg.required || []).filter((f) => !data[f])
      if (missing.length) {
        return response.status(422).json({
          status: 'validation_failed',
          message: `Field data.${missing.join(', ')} wajib diisi`
        })
      }

      // Sisipkan companyName bila belum ada
      if (!data.companyName) data.companyName = company.name

      // Generate PDF secara sinkron
      const generator = new GeneratePdfJob()
      const pdfMeta = await generator.handle({
        template: cfg.template,
        data,
        email: to, // dipakai untuk penamaan folder/file
        companyName: company.name,
        userId: user.id,
        companyId: company.company_id
      })

      const subject = bodyJson.subject || cfg.subject(data, company)
      const textBody = bodyJson.body || cfg.body(data, company)

      // Queue pengiriman email dengan lampiran PDF
      await JobService.dispatch('App/Jobs/SendEmailJob', {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        mailFrom,
        to,
        cc,
        bcc,
        subject,
        text: textBody,
        attachments: [
          { filename: pdfMeta.filename, path: pdfMeta.filePath }
        ],
        userId: user.id,
        companyId: company.company_id,
        template: cfg.template,
        context: 'single-send'
      }, { attempts: 3, timeout: 120000 })

      return response.status(202).json({
        status: 'queued',
        message: 'PDF digenerate dan email akan dikirim',
        download_url: pdfMeta.downloadUrl,
        filename: pdfMeta.filename
      })
    } catch (err) {
      console.error('[SingleEmail] error:', err.message)
      return response.status(500).json({
        status: 'error',
        message: 'Gagal memproses permintaan',
        error: err.message
      })
    }
  }
}

function truthy(val) {
  if (val === true || val === false) return val
  const str = String(val || '').toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(str)
}

function pickSmtpConfig(company) {
  const envHost = Env.get('SMTP_HOST')
  const envPort = Env.get('SMTP_PORT')
  const envUser = Env.get('SMTP_USER')
  const envPass = Env.get('SMTP_PASS')
  const envSecure = Env.get('SMTP_SECURE', 'false')
  const envFrom = Env.get('MAIL_FROM') || envUser

  const companyComplete = company &&
    company.smtp_host &&
    company.smtp_port &&
    company.smtp_user &&
    company.smtp_pass

  const useCompany = !!companyComplete

  const smtpHost = useCompany ? company.smtp_host : envHost
  const smtpPort = useCompany ? company.smtp_port : envPort
  const smtpUser = useCompany ? company.smtp_user : envUser
  const smtpPass = useCompany ? company.smtp_pass : envPass
  const smtpSecure = useCompany
    ? truthy(company.smtp_secure)
    : truthy(envSecure)
  const mailFrom = useCompany
    ? (company.mail_from || company.smtp_user)
    : (envFrom || envUser)

  return { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, mailFrom }
}

function cfgBa(template) {
  return {
    template,
    required: requiredFields(template),
    subject: (f, company) => {
      const base =
        template === 'ba-penempatan' ? 'Berita Acara Penempatan' :
        template === 'ba-request-id' ? 'Berita Acara Request ID' :
        template === 'ba-hold' ? 'Berita Acara Hold' :
        template === 'ba-rolling' ? 'Berita Acara Rolling' :
        template === 'ba-hold-activate' ? 'Berita Acara HOLD Aktif Kembali' :
        'Berita Acara Terminasi'
      const who = f.mdsName || f.letterNo || ''
      return who ? `${base} - ${who}` : base
    },
    body: (f, company) => {
      const lines = [
        `Yth. ${f.mdsName || 'Bapak/Ibu'},`,
        '',
        template === 'ba-terminated'
          ? 'Berikut terlampir Berita Acara Terminasi MDS.'
          : template === 'ba-hold-activate'
          ? 'Berikut terlampir Berita Acara HOLD Aktif Kembali.'
          : `Berikut terlampir Berita Acara ${title(template)}.`,
        f.region ? `Wilayah: ${f.region}` : null,
        f.letterNo ? `Nomor Surat: ${f.letterNo}` : null,
        '',
        company && company.name ? company.name : '',
        'Pesan ini dikirim otomatis, mohon tidak membalas ke alamat ini.'
      ]
      return lines.filter(Boolean).join('\n')
    }
  }
}

function requiredFields(template) {
  const map = {
    'ba-penempatan': ['letterNo', 'mdsName', 'placementDate', 'outlet'],
    'ba-request-id': ['letterNo', 'mdsName', 'nik', 'joinDate'],
    'ba-hold': ['letterNo', 'region', 'holdDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-rolling': ['letterNo', 'region', 'rollingDate', 'mdsName', 'mdsCode', 'status', 'outletFrom', 'outletTo'],
    'ba-hold-activate': ['letterNo', 'region', 'reactivateDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-terminated': ['letterNo', 'region', 'terminateDate', 'mdsName', 'mdsCode', 'status', 'outlet']
  }
  return map[template] || []
}

function title(template) {
  const map = {
    'ba-penempatan': 'Penempatan',
    'ba-request-id': 'Request ID',
    'ba-hold': 'Hold',
    'ba-rolling': 'Rolling',
    'ba-hold-activate': 'Hold Aktivasi',
    'ba-terminated': 'Terminasi'
  }
  return map[template] || template
}

module.exports = SingleEmailController
