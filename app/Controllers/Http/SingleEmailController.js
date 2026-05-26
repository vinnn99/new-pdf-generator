'use strict'

const JobService = require('../../Services/JobService')
const Database = use('Database')
const GeneratePdfJob = use('App/Jobs/GeneratePdfJob')
const BaTemplateService = use('App/Services/BaTemplateService')
const BaLetterNoService = use('App/Services/BaLetterNoService')
const SignatureUrlHistoryService = use('App/Services/SignatureUrlHistoryService')
const EmailLogService = use('App/Services/EmailLogService')
const Env = use('Env')

class SingleEmailController {
  async sendPayslip(ctx) {
    return this._send(ctx, cfgSlip('payslip'))
  }
  async sendInsentif(ctx) {
    return this._send(ctx, cfgSlip('insentif'))
  }
  async sendThr(ctx) {
    return this._send(ctx, cfgSlip('thr'))
  }

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
  async sendBaTakeout(ctx) {
    return this._send(ctx, cfgBa('ba-takeout'))
  }
  async sendBaTerminated(ctx) {
    return this._send(ctx, cfgBa('ba-terminated'))
  }
  async sendBaCancelJoin(ctx) {
    return this._send(ctx, cfgBa('ba-cancel-join'))
  }
  async sendBaResign(ctx) {
    return this._send(ctx, cfgBa('ba-resign'))
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

      const normalizedTemplate = BaTemplateService.normalizeTemplate(cfg.template)
      if (BaTemplateService.isBaTemplate(normalizedTemplate)) {
        try {
          const numbering = await BaLetterNoService.nextLetterNo({
            companyId: company.company_id,
            template: normalizedTemplate,
            createdBy: user.id
          })
          data.letterNo = numbering.letterNo
        } catch (err) {
          return response.status(422).json({
            status: 'validation_failed',
            message: `Gagal generate letterNo: ${err.message}`
          })
        }
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

      try {
        await SignatureUrlHistoryService.recordFromPayload({
          companyId: company.company_id,
          createdBy: user.id,
          payloadData: data
        })
      } catch (historyErr) {
        console.warn('[SingleEmail] gagal simpan histori signature URL:', historyErr.message)
      }

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
      const jobAttachments = [
        { filename: pdfMeta.filename, path: pdfMeta.filePath }
      ]

      let emailLogId = null
      try {
        emailLogId = await EmailLogService.createQueued({
          userId: user.id,
          companyId: company.company_id,
          template: cfg.template,
          context: 'single-send',
          to,
          cc,
          bcc,
          subject,
          body: textBody,
          attachments: jobAttachments,
          status: 'queued'
        })
      } catch (logErr) {
        throw new Error(`Gagal menyimpan email log sebelum enqueue: ${logErr.message}`)
      }

      // Queue pengiriman email dengan lampiran PDF
      try {
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
          attachments: jobAttachments,
          userId: user.id,
          companyId: company.company_id,
          template: cfg.template,
          context: 'single-send',
          emailLogId
        }, { attempts: 3, timeout: 120000 })
      } catch (dispatchErr) {
        await markDispatchFailed(emailLogId, dispatchErr.message)
        throw dispatchErr
      }

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
        template === 'ba-takeout' ? 'Berita Acara Toko Takeout' :
        template === 'ba-cancel-join' ? 'Berita Acara Batal Join' :
        template === 'ba-resign' ? 'Berita Acara Resign' :
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
          : template === 'ba-takeout'
          ? 'Berikut terlampir Berita Acara Toko Takeout MDS.'
          : template === 'ba-cancel-join'
          ? 'Berikut terlampir Berita Acara Batal Join MDS.'
          : template === 'ba-resign'
          ? 'Berikut terlampir Berita Acara Resign MDS.'
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

async function markDispatchFailed(emailLogId, error) {
  if (!emailLogId) return
  try {
    await EmailLogService.markDispatchFailed({ id: emailLogId, error })
  } catch (logErr) {
    console.error('[SingleEmail] gagal update email_log dispatch failed:', logErr.message)
  }
}

function cfgSlip(template) {
  return {
    template,
    required: requiredFields(template),
    subject: (f) => {
      const base =
        template === 'insentif' ? 'Slip Insentif' :
        template === 'thr' ? 'Slip THR' :
        'Slip Gaji'
      const who = f.employeeName || f.employeeId || ''
      return who ? `${base} - ${who}` : base
    },
    body: (f, company) => {
      const lines = [
        `Yth. ${f.employeeName || 'Bapak/Ibu'},`,
        '',
        template === 'insentif'
          ? 'Berikut terlampir slip insentif Anda.'
          : template === 'thr'
          ? 'Berikut terlampir slip THR Anda.'
          : 'Berikut terlampir slip gaji Anda.',
        f.period ? `Periode: ${f.period}` : null,
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
    payslip: ['employeeName', 'position', 'period'],
    insentif: ['employeeName', 'position', 'period'],
    thr: ['employeeName', 'position', 'period', 'payoutDate', 'baseSalary'],
    'ba-penempatan': ['mdsName', 'placementDate', 'outlet'],
    'ba-request-id': ['mdsName', 'nik', 'joinDate'],
    'ba-hold': ['region', 'holdDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-rolling': ['region', 'rollingDate', 'mdsName', 'mdsCode', 'status', 'outletFrom', 'outletTo'],
    'ba-hold-activate': ['region', 'reactivateDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-takeout': ['region', 'takeoutDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-terminated': ['region', 'terminateDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-cancel-join': ['region', 'cancelJoinDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-resign': ['region', 'mdsName', 'mdsCode', 'nik', 'effectiveResignDate', 'status', 'mdsCategory', 'outletFrom']
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
    'ba-takeout': 'Takeout',
    'ba-terminated': 'Terminasi',
    'ba-cancel-join': 'Batal Join',
    'ba-resign': 'Resign'
  }
  return map[template] || template
}

module.exports = SingleEmailController
