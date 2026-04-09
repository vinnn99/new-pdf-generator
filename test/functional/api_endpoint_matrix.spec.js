'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const nodemailer = require('nodemailer')
const { spawn } = require('child_process')

const suite = use('Test/Suite')('API Endpoint Matrix (No Email Send)')
suite.timeout(0)
const { test, trait, before, after } = suite

const Database = use('Database')
const User = use('App/Models/User')
const Helpers = use('Helpers')
const ContactService = use('App/Services/ContactService')
const SendEmailJob = use('App/Jobs/SendEmailJob')

trait('Test/ApiClient')

const ROLES = ['user', 'admin', 'superadmin']
const BULK_ENDPOINTS = [
  '/api/v1/bulk/payslip',
  '/api/v1/bulk/insentif',
  '/api/v1/bulk/thr',
  '/api/v1/bulk/ba-penempatan',
  '/api/v1/bulk/ba-request-id',
  '/api/v1/bulk/ba-hold',
  '/api/v1/bulk/ba-rolling',
  '/api/v1/bulk/ba-hold-activate',
  '/api/v1/bulk/ba-takeout',
  '/api/v1/bulk/ba-terminated'
]

const seed = {
  companyAId: null,
  companyBId: null,
  companyAApiKey: 'api_key_company_a',
  companyBApiKey: 'api_key_company_b',
  userMainId: null,
  adminMainId: null,
  superMainId: null,
  outsiderUserId: null,
  managedUserId: null,
  dynamicTemplateCompanyId: null,
  contactOwnId: null,
  contactManagedId: null,
  contactOutsiderId: null,
  contactUpdateId: null,
  contactDeleteByRole: {
    user: null,
    admin: null,
    superadmin: null
  },
  credentials: {
    user: { email: 'user.main@test.local', password: 'secret123' },
    admin: { email: 'admin.main@test.local', password: 'secret123' },
    superadmin: { email: 'super.main@test.local', password: 'secret123' }
  },
  changeCredentials: {
    user: { email: 'user.change@test.local', password: 'secret123' },
    admin: { email: 'admin.change@test.local', password: 'secret123' },
    superadmin: { email: 'super.change@test.local', password: 'secret123' }
  },
  download: {
    company: 'Company_A',
    email: 'user.main@test.local',
    filename: 'sample.pdf'
  }
}

let uniqCounter = 0
let serverProcess = null

before(async () => {
  await resetSchema()
  await seedData()
  await ensureDownloadFixture()
  await startHttpServer()
})

after(async () => {
  await stopHttpServer()
})

for (const roleToRegister of ROLES) {
  test(`POST /api/v1/register role=${roleToRegister}`, async ({ client }) => {
    const id = uniqueId(`register_${roleToRegister}`)
    const response = await client
      .post('/api/v1/register')
      .header('x-api-key', seed.companyAApiKey)
      .send({
        username: `u_${id}`,
        email: `u_${id}@test.local`,
        password: 'secret123',
        role: roleToRegister
      })
      .end()

    response.assertStatus(201)
  })
}

for (const roleToLogin of ROLES) {
  test(`POST /api/v1/login role=${roleToLogin}`, async ({ client }) => {
    const response = await client
      .post('/api/v1/login')
      .send(seed.credentials[roleToLogin])
      .end()

    response.assertStatus(200)
  })
}

for (const role of ROLES) {
  test(`POST /api/v1/change-password role=${role}`, async ({ client }) => {
    const token = await loginAndGetToken(client, seed.changeCredentials[role])

    const response = await client
      .post('/api/v1/change-password')
      .header('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: seed.changeCredentials[role].password,
        newPassword: `newpass_${role}_123`
      })
      .end()

    response.assertStatus(200)
  })
}

const endpointCases = [
  {
    method: 'get',
    url: () => '/api/v1/admin/users?page=1&perPage=10',
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => '/api/v1/admin/users',
    auth: 'jwt',
    body: ({ role }) => {
      const id = uniqueId(`admin_user_create_${role}`)
      return {
        username: `new_user_${id}`,
        email: `new_user_${id}@test.local`,
        password: 'secret123',
        role: 'user',
        company_id: seed.companyAId
      }
    },
    expected: { user: 403, admin: 201, superadmin: 201 }
  },
  {
    method: 'put',
    url: () => `/api/v1/admin/users/${seed.managedUserId}`,
    auth: 'jwt',
    body: ({ role }) => ({ username: `updated_${uniqueId(role)}` }),
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/users/${seed.managedUserId}/deactivate`,
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/users/${seed.managedUserId}/password`,
    auth: 'jwt',
    body: ({ role }) => ({ password: `reset_${role}_123` }),
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/admin/companies?page=1&perPage=10',
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => '/api/v1/admin/companies',
    auth: 'jwt',
    body: () => {
      const id = uniqueId('company_create')
      return { name: `Company ${id}`, api_key: `api_key_${id}` }
    },
    expected: { user: 403, admin: 403, superadmin: 201 }
  },
  {
    method: 'put',
    url: () => `/api/v1/admin/companies/${seed.companyAId}`,
    auth: 'jwt',
    body: () => ({ name: `Company A ${uniqueId('upd')}` }),
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/companies/${seed.companyBId}/activate`,
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/companies/${seed.companyBId}/deactivate`,
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/admin/templates',
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/companies/${seed.companyBId}/templates`,
    auth: 'jwt',
    body: () => ({ templates: ['payslip', 'thr'] }),
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/admin/dynamic-templates?page=1&perPage=10',
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => '/api/v1/admin/dynamic-templates',
    auth: 'jwt',
    body: ({ role }) => {
      const id = uniqueSlug(`dyn-${role}`)
      return {
        template_key: id,
        name: `Dynamic ${id}`,
        required_fields: ['employeeName'],
        content: {
          pageSize: 'A4',
          content: [{ text: 'Nama: {{employeeName}}' }]
        },
        company_id: role === 'superadmin' ? seed.companyBId : seed.companyAId,
        is_active: true
      }
    },
    expected: { user: 403, admin: 201, superadmin: 201 }
  },
  {
    method: 'put',
    url: () => `/api/v1/admin/dynamic-templates/${seed.dynamicTemplateCompanyId}`,
    auth: 'jwt',
    body: ({ role }) => ({ name: `Template Updated ${uniqueId(role)}` }),
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/dynamic-templates/${seed.dynamicTemplateCompanyId}/activate`,
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => `/api/v1/admin/dynamic-templates/${seed.dynamicTemplateCompanyId}/deactivate`,
    auth: 'jwt',
    expected: { user: 403, admin: 200, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => '/api/v1/generate-pdf',
    auth: 'none',
    headers: () => ({ 'x-api-key': seed.companyAApiKey }),
    body: ({ role }) => {
      const roleEmail = role === 'user'
        ? seed.credentials.user.email
        : role === 'admin'
          ? seed.credentials.admin.email
          : seed.credentials.superadmin.email

      const payload = {
        template: 'payslip',
        email: roleEmail,
        data: {
          employeeName: 'Test User',
          position: 'Staff',
          period: '2026-04'
        }
      }

      if (role === 'superadmin') payload.company_id = seed.companyAId
      return payload
    },
    expected: { user: 202, admin: 202, superadmin: 202 }
  },
  {
    method: 'get',
    url: () => '/api/v1/generated-pdfs?page=1&perPage=10',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/company/api-key',
    label: '/api/v1/company/api-key',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 404 },
    assertBody: ({ response, expectedStatus }) => {
      if (expectedStatus !== 200) return

      const company = response.body && response.body.company
      if (!company) throw new Error('Response company/api-key tidak memiliki objek company')
      if (!Array.isArray(company.allowed_templates)) {
        throw new Error('Field company.allowed_templates harus berupa array')
      }
    }
  },
  {
    method: 'get',
    url: () => '/api/v1/contacts?page=1&perPage=10&q=contact',
    label: '/api/v1/contacts',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 },
    assertBody: ({ response, role }) => {
      const rows = (response.body && response.body.data) || []
      if (!Array.isArray(rows)) throw new Error('Response contacts.data harus berupa array')

      if (role === 'user' && rows.some((row) => Number(row.user_id) !== Number(seed.userMainId))) {
        throw new Error('Role user tidak boleh melihat contact user lain')
      }

      if (role === 'admin' && rows.some((row) => Number(row.company_id) !== Number(seed.companyAId))) {
        throw new Error('Role admin tidak boleh melihat contact di luar company sendiri')
      }
    }
  },
  {
    method: 'get',
    url: () => `/api/v1/contacts?page=1&perPage=10&company_id=${seed.companyAId}`,
    label: '/api/v1/contacts?company_id=',
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => `/api/v1/contacts/${seed.contactOwnId}`,
    label: '/api/v1/contacts/:id own',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => `/api/v1/contacts/${seed.contactOutsiderId}`,
    label: '/api/v1/contacts/:id outsider',
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'post',
    url: () => '/api/v1/contacts',
    label: '/api/v1/contacts create',
    auth: 'jwt',
    body: ({ role }) => {
      const id = uniqueId(`contact_create_${role}`)
      return {
        email: `Contact_${id}@test.local`,
        name: `Contact ${id}`,
        phone: `08${Date.now()}`
      }
    },
    expected: { user: 201, admin: 201, superadmin: 201 },
    assertBody: ({ response, expectedStatus }) => {
      if (expectedStatus !== 201) return
      const data = response.body && response.body.data
      if (!data || !data.email) throw new Error('Response create contact tidak memiliki data.email')
      if (data.email !== String(data.email).toLowerCase()) {
        throw new Error('Email contact harus tersimpan dalam lowercase')
      }
    }
  },
  {
    method: 'post',
    url: () => '/api/v1/contacts',
    label: '/api/v1/contacts create cross scope',
    auth: 'jwt',
    body: ({ role }) => {
      const id = uniqueId(`contact_scope_${role}`)
      return {
        email: `scope_${id}@test.local`,
        user_id: seed.outsiderUserId
      }
    },
    expected: { user: 403, admin: 403, superadmin: 201 }
  },
  {
    method: 'put',
    url: () => `/api/v1/contacts/${seed.contactUpdateId}`,
    label: '/api/v1/contacts/:id update own-company',
    auth: 'jwt',
    body: ({ role }) => ({
      name: `Updated ${uniqueId(`contact_upd_${role}`)}`,
      email: `UPD_${uniqueId(role)}@TEST.LOCAL`
    }),
    expected: { user: 200, admin: 200, superadmin: 200 },
    assertBody: ({ response, expectedStatus }) => {
      if (expectedStatus !== 200) return
      const data = response.body && response.body.data
      if (!data || !data.email) throw new Error('Response update contact tidak memiliki data.email')
      if (data.email !== String(data.email).toLowerCase()) {
        throw new Error('Email update contact harus tersimpan dalam lowercase')
      }
    }
  },
  {
    method: 'put',
    url: () => `/api/v1/contacts/${seed.contactOutsiderId}`,
    label: '/api/v1/contacts/:id update outsider',
    auth: 'jwt',
    body: () => ({ notes: 'forbidden update check' }),
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'delete',
    url: ({ role }) => `/api/v1/contacts/${seed.contactDeleteByRole[role]}`,
    label: '/api/v1/contacts/:id delete',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/email-logs?page=1&perPage=10&q=test',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/dashboard/summary',
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => '/api/v1/dashboard/summary?scope=all',
    auth: 'jwt',
    expected: { user: 403, admin: 403, superadmin: 200 }
  },
  {
    method: 'get',
    url: () => `/download/${encodeURIComponent(seed.download.company)}/${encodeURIComponent(seed.download.email)}/${encodeURIComponent(seed.download.filename)}`,
    auth: 'jwt',
    expected: { user: 200, admin: 200, superadmin: 200 }
  }
]

for (const bulkPath of BULK_ENDPOINTS) {
  endpointCases.push({
    method: 'post',
    url: () => bulkPath,
    auth: 'jwt',
    expected: { user: 422, admin: 422, superadmin: 401 }
  })
}

for (const endpoint of endpointCases) {
  for (const role of ROLES) {
    const endpointLabel = endpoint.label || '[dynamic endpoint]'
    test(`${endpoint.method.toUpperCase()} ${endpointLabel} as ${role}`, async ({ client }) => {
      const targetUrl = endpoint.url({ role })
      let request = client[endpoint.method](targetUrl)

      if (endpoint.auth === 'jwt') {
        const token = await loginAndGetToken(client, seed.credentials[role])
        request = request.header('Authorization', `Bearer ${token}`)
      }

      const headers = endpoint.headers ? endpoint.headers({ role }) : null
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          request = request.header(key, value)
        }
      }

      if (endpoint.body) {
        request = request.send(endpoint.body({ role }))
      }

      const response = await request.end()
      response.assertStatus(endpoint.expected[role])
      if (endpoint.assertBody) {
        endpoint.assertBody({
          response,
          role,
          expectedStatus: endpoint.expected[role]
        })
      }
    })
  }
}

test('ContactService.upsertFromSend normalisasi + increment send_count', async ({ assert }) => {
  const stamp = uniqueId('upsert')
  const toEmail = `Mix.${stamp}@Test.Local`
  const ccEmail = `cc.${stamp}@test.local`
  const bccEmail = `bcc.${stamp}@test.local`

  const first = await ContactService.upsertFromSend({
    userId: seed.userMainId,
    companyId: seed.companyAId,
    to: `  ${toEmail}  `,
    cc: [ccEmail, 'invalid-email'],
    bcc: `${bccEmail};${toEmail}`,
    source: 'auto-bulk',
    sentAt: new Date()
  })

  assert.equal(first.upserted, 3)
  assert.equal(first.skipped, 1)

  await ContactService.upsertFromSend({
    userId: seed.userMainId,
    companyId: seed.companyAId,
    to: toEmail,
    cc: [],
    bcc: [],
    source: 'auto-bulk',
    sentAt: new Date()
  })

  const stored = await Database.table('contacts')
    .where('user_id', seed.userMainId)
    .where('email', toEmail.toLowerCase())
    .first()

  assert.ok(stored)
  assert.equal(Number(stored.send_count), 2)
  assert.equal(stored.source, 'auto-bulk')
})

test('SendEmailJob tetap upsert contact saat kirim email gagal', async ({ assert }) => {
  const stamp = uniqueId('sendjob')
  const toEmail = `sendjob.${stamp}@test.local`
  const ccEmail = `sendjob.cc.${stamp}@test.local`
  const originalCreateTransport = nodemailer.createTransport

  nodemailer.createTransport = () => ({
    sendMail: async () => {
      throw new Error('SMTP mock failure')
    }
  })

  try {
    await new SendEmailJob().handle({
      smtpHost: 'localhost',
      smtpPort: 25,
      smtpSecure: false,
      smtpUser: 'noreply@test.local',
      smtpPass: 'dummy',
      mailFrom: 'noreply@test.local',
      to: toEmail,
      cc: [ccEmail],
      bcc: [],
      subject: 'Mock Subject',
      text: 'Mock Body',
      attachments: [],
      userId: seed.userMainId,
      companyId: seed.companyAId,
      template: 'ba-penempatan',
      context: 'single-send'
    })
    throw new Error('SendEmailJob seharusnya throw saat SMTP gagal')
  } catch (err) {
    if (!String(err.message || '').includes('SMTP mock failure')) {
      throw err
    }
  } finally {
    nodemailer.createTransport = originalCreateTransport
  }

  const toContact = await Database.table('contacts')
    .where('user_id', seed.userMainId)
    .where('email', toEmail)
    .first()

  const ccContact = await Database.table('contacts')
    .where('user_id', seed.userMainId)
    .where('email', ccEmail)
    .first()

  assert.ok(toContact)
  assert.ok(ccContact)
  assert.equal(toContact.source, 'auto-single')
  assert.equal(Number(toContact.send_count), 1)

  const emailLog = await Database.table('email_logs')
    .where('to_email', toEmail)
    .orderBy('id', 'desc')
    .first()

  assert.ok(emailLog)
  assert.equal(emailLog.status, 'failed')
})

async function loginAndGetToken(client, credentials) {
  const response = await client
    .post('/api/v1/login')
    .send(credentials)
    .end()

  response.assertStatus(200)

  const tokenField = response.body && response.body.token
  if (!tokenField) {
    throw new Error('Token login tidak ditemukan pada response')
  }

  if (typeof tokenField === 'string') return tokenField
  if (tokenField.token) return tokenField.token

  throw new Error('Format token login tidak dikenali')
}

function uniqueId(prefix) {
  uniqCounter += 1
  return `${prefix}_${Date.now()}_${uniqCounter}`
}

function uniqueSlug(prefix) {
  uniqCounter += 1
  return `${prefix}-${Date.now()}-${uniqCounter}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
}

async function resetSchema() {
  await Database.raw('PRAGMA foreign_keys = OFF')

  const tables = ['contacts', 'dynamic_templates', 'email_logs', 'generated_pdfs', 'jobs', 'tokens', 'users', 'companies']
  for (const table of tables) {
    const exists = await Database.schema.hasTable(table)
    if (exists) await Database.schema.dropTable(table)
  }

  await Database.schema.createTable('companies', (table) => {
    table.increments('company_id')
    table.string('name', 191).notNullable()
    table.string('api_key', 191).notNullable().unique()
    table.string('smtp_host', 191).nullable()
    table.integer('smtp_port').nullable()
    table.string('smtp_user', 191).nullable()
    table.string('smtp_pass', 191).nullable()
    table.boolean('smtp_secure').defaultTo(false)
    table.string('mail_from', 191).nullable()
    table.boolean('is_active').notNullable().defaultTo(true).index()
    table.text('allowed_templates').nullable()
    table.timestamps()
  })

  await Database.schema.createTable('users', (table) => {
    table.increments()
    table.string('username', 80).notNullable().unique()
    table.string('email', 254).notNullable().unique()
    table.string('password', 60).notNullable()
    table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL').index()
    table.string('role', 20).notNullable().defaultTo('user').index()
    table.boolean('is_active').notNullable().defaultTo(true).index()
    table.timestamps()
  })

  await Database.schema.createTable('tokens', (table) => {
    table.increments()
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
    table.string('token', 255).notNullable().unique().index()
    table.string('type', 80).notNullable()
    table.boolean('is_revoked').defaultTo(false)
    table.timestamps()
  })

  await Database.schema.createTable('jobs', (table) => {
    table.increments('id')
    table.string('queue').index()
    table.text('payload').notNullable()
    table.integer('attempts').defaultTo(0)
    table.text('failed_at').nullable()
    table.timestamps()
  })

  await Database.schema.createTable('generated_pdfs', (table) => {
    table.increments()
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
    table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL')
    table.string('template', 100).notNullable()
    table.string('filename', 191).notNullable()
    table.string('download_url', 500).notNullable()
    table.string('saved_path', 500).notNullable()
    table.string('email', 254).notNullable()
    table.string('company_name', 191).notNullable()
    table.text('data').nullable()
    table.integer('callback_status').nullable()
    table.text('callback_response').nullable()
    table.text('callback_error').nullable()
    table.timestamps()
  })

  await Database.schema.createTable('email_logs', (table) => {
    table.increments()
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
    table.integer('company_id').unsigned().references('company_id').inTable('companies').onDelete('SET NULL')
    table.string('template', 100).nullable()
    table.string('context', 100).nullable()
    table.string('to_email', 254).notNullable()
    table.text('cc').nullable()
    table.text('bcc').nullable()
    table.string('subject', 255).nullable()
    table.text('body').nullable()
    table.text('attachments').nullable()
    table.string('status', 50).notNullable()
    table.text('error').nullable()
    table.timestamps()
  })

  await Database.schema.createTable('contacts', (table) => {
    table.increments()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.integer('company_id').unsigned().nullable().references('company_id').inTable('companies').onDelete('SET NULL')
    table.string('email', 254).notNullable()
    table.string('name', 191).nullable()
    table.string('phone', 50).nullable()
    table.text('notes').nullable()
    table.string('source', 50).notNullable().defaultTo('manual')
    table.datetime('last_sent_at').nullable()
    table.integer('send_count').notNullable().defaultTo(0)
    table.timestamps()
    table.unique(['user_id', 'email'])
    table.index(['company_id'])
    table.index(['user_id'])
    table.index(['email'])
    table.index(['last_sent_at'])
  })

  await Database.schema.createTable('dynamic_templates', (table) => {
    table.increments()
    table.string('template_key', 100).notNullable().index()
    table.string('name', 191).notNullable()
    table.integer('company_id').unsigned().nullable().references('company_id').inTable('companies').onDelete('SET NULL').index()
    table.string('source_type', 50).notNullable().defaultTo('pdfmake_json')
    table.text('required_fields').nullable()
    table.text('content_json').notNullable()
    table.boolean('is_active').notNullable().defaultTo(true).index()
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
    table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamps()
    table.unique(['template_key', 'company_id'])
  })

  await Database.raw('PRAGMA foreign_keys = ON')
}

async function seedData() {
  const now = new Date()

  const cA = await Database.table('companies').insert({
    name: 'Company A',
    api_key: seed.companyAApiKey,
    is_active: true,
    allowed_templates: null,
    created_at: now,
    updated_at: now
  })
  seed.companyAId = Array.isArray(cA) ? cA[0] : cA

  const cB = await Database.table('companies').insert({
    name: 'Company B',
    api_key: seed.companyBApiKey,
    is_active: true,
    allowed_templates: null,
    created_at: now,
    updated_at: now
  })
  seed.companyBId = Array.isArray(cB) ? cB[0] : cB

  const userMain = await User.create({
    username: 'user_main',
    email: seed.credentials.user.email,
    password: seed.credentials.user.password,
    role: 'user',
    company_id: seed.companyAId,
    is_active: true
  })
  seed.userMainId = userMain.id

  const adminMain = await User.create({
    username: 'admin_main',
    email: seed.credentials.admin.email,
    password: seed.credentials.admin.password,
    role: 'admin',
    company_id: seed.companyAId,
    is_active: true
  })
  seed.adminMainId = adminMain.id

  const superMain = await User.create({
    username: 'super_main',
    email: seed.credentials.superadmin.email,
    password: seed.credentials.superadmin.password,
    role: 'superadmin',
    company_id: null,
    is_active: true
  })
  seed.superMainId = superMain.id

  await User.create({
    username: 'user_change',
    email: seed.changeCredentials.user.email,
    password: seed.changeCredentials.user.password,
    role: 'user',
    company_id: seed.companyAId,
    is_active: true
  })

  await User.create({
    username: 'admin_change',
    email: seed.changeCredentials.admin.email,
    password: seed.changeCredentials.admin.password,
    role: 'admin',
    company_id: seed.companyAId,
    is_active: true
  })

  await User.create({
    username: 'super_change',
    email: seed.changeCredentials.superadmin.email,
    password: seed.changeCredentials.superadmin.password,
    role: 'superadmin',
    company_id: null,
    is_active: true
  })

  const managedUser = await User.create({
    username: 'managed_user',
    email: 'managed.user@test.local',
    password: 'secret123',
    role: 'user',
    company_id: seed.companyAId,
    is_active: true
  })
  seed.managedUserId = managedUser.id

  const outsider = await User.create({
    username: 'outsider_user',
    email: 'outsider.user@test.local',
    password: 'secret123',
    role: 'user',
    company_id: seed.companyBId,
    is_active: true
  })
  seed.outsiderUserId = outsider.id

  const contactsInserted = await Database.table('contacts').insert([
    {
      user_id: seed.userMainId,
      company_id: seed.companyAId,
      email: 'owned-contact@test.local',
      name: 'Owned Contact',
      phone: '081111111111',
      notes: 'Contact owned by user_main',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: managedUser.id,
      company_id: seed.companyAId,
      email: 'managed-contact@test.local',
      name: 'Managed Contact',
      phone: '082222222222',
      notes: 'Contact in company A',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: outsider.id,
      company_id: seed.companyBId,
      email: 'outsider-contact@test.local',
      name: 'Outsider Contact',
      phone: '083333333333',
      notes: 'Contact in company B',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: seed.userMainId,
      company_id: seed.companyAId,
      email: 'update-contact@test.local',
      name: 'Update Contact',
      phone: '084444444444',
      notes: 'Contact for update scenario',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: seed.userMainId,
      company_id: seed.companyAId,
      email: 'delete-user@test.local',
      name: 'Delete User Contact',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: seed.adminMainId,
      company_id: seed.companyAId,
      email: 'delete-admin@test.local',
      name: 'Delete Admin Contact',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    },
    {
      user_id: seed.superMainId,
      company_id: null,
      email: 'delete-super@test.local',
      name: 'Delete Super Contact',
      source: 'manual',
      last_sent_at: null,
      send_count: 0,
      created_at: now,
      updated_at: now
    }
  ])

  const contactIds = Array.isArray(contactsInserted) ? contactsInserted : []
  if (contactIds.length >= 7) {
    seed.contactOwnId = contactIds[0]
    seed.contactManagedId = contactIds[1]
    seed.contactOutsiderId = contactIds[2]
    seed.contactUpdateId = contactIds[3]
    seed.contactDeleteByRole.user = contactIds[4]
    seed.contactDeleteByRole.admin = contactIds[5]
    seed.contactDeleteByRole.superadmin = contactIds[6]
  } else {
    const seededContacts = await Database.table('contacts').select('id', 'email').orderBy('id', 'asc')
    for (const c of seededContacts) {
      if (c.email === 'owned-contact@test.local') seed.contactOwnId = c.id
      if (c.email === 'managed-contact@test.local') seed.contactManagedId = c.id
      if (c.email === 'outsider-contact@test.local') seed.contactOutsiderId = c.id
      if (c.email === 'update-contact@test.local') seed.contactUpdateId = c.id
      if (c.email === 'delete-user@test.local') seed.contactDeleteByRole.user = c.id
      if (c.email === 'delete-admin@test.local') seed.contactDeleteByRole.admin = c.id
      if (c.email === 'delete-super@test.local') seed.contactDeleteByRole.superadmin = c.id
    }
  }

  await Database.table('generated_pdfs').insert([
    {
      user_id: managedUser.id,
      company_id: seed.companyAId,
      template: 'payslip',
      filename: 'payslip-a.pdf',
      download_url: 'http://localhost:3334/download/Company_A/user.main%40test.local/sample.pdf',
      saved_path: 'public/download/Company_A/user.main@test.local/sample.pdf',
      email: seed.credentials.user.email,
      company_name: 'Company A',
      data: JSON.stringify({ employeeName: 'User A' }),
      callback_status: 200,
      callback_response: '{"ok":true}',
      callback_error: null,
      created_at: now,
      updated_at: now
    },
    {
      user_id: outsider.id,
      company_id: seed.companyBId,
      template: 'thr',
      filename: 'thr-b.pdf',
      download_url: 'http://localhost:3334/download/Company_B/outsider.user%40test.local/thr-b.pdf',
      saved_path: 'public/download/Company_B/outsider.user@test.local/thr-b.pdf',
      email: outsider.email,
      company_name: 'Company B',
      data: JSON.stringify({ employeeName: 'User B' }),
      callback_status: 200,
      callback_response: '{"ok":true}',
      callback_error: null,
      created_at: now,
      updated_at: now
    }
  ])

  await Database.table('email_logs').insert([
    {
      user_id: managedUser.id,
      company_id: seed.companyAId,
      template: 'payslip-email',
      context: 'bulk-slip',
      to_email: seed.credentials.user.email,
      cc: JSON.stringify([]),
      bcc: JSON.stringify([]),
      subject: 'Slip Gaji',
      body: 'Lampiran slip gaji.',
      attachments: JSON.stringify(['payslip-a.pdf']),
      status: 'sent',
      error: null,
      created_at: now,
      updated_at: now
    },
    {
      user_id: outsider.id,
      company_id: seed.companyBId,
      template: 'ba-terminated',
      context: 'single-send',
      to_email: outsider.email,
      cc: JSON.stringify([]),
      bcc: JSON.stringify([]),
      subject: 'BA Terminated',
      body: 'Lampiran BA.',
      attachments: JSON.stringify(['thr-b.pdf']),
      status: 'failed',
      error: 'SMTP timeout',
      created_at: now,
      updated_at: now
    }
  ])

  const dt = await Database.table('dynamic_templates').insert({
    template_key: 'dyn-company-a',
    name: 'Dynamic Company A',
    company_id: seed.companyAId,
    source_type: 'pdfmake_json',
    required_fields: JSON.stringify(['employeeName']),
    content_json: JSON.stringify({ content: [{ text: 'Hello {{employeeName}}' }] }),
    is_active: true,
    created_by: adminMain.id,
    updated_by: adminMain.id,
    created_at: now,
    updated_at: now
  })
  seed.dynamicTemplateCompanyId = Array.isArray(dt) ? dt[0] : dt

  await Database.table('dynamic_templates').insert({
    template_key: 'dyn-global',
    name: 'Dynamic Global',
    company_id: null,
    source_type: 'pdfmake_json',
    required_fields: JSON.stringify(['name']),
    content_json: JSON.stringify({ content: [{ text: 'Global {{name}}' }] }),
    is_active: true,
    created_by: adminMain.id,
    updated_by: adminMain.id,
    created_at: now,
    updated_at: now
  })
}

async function ensureDownloadFixture() {
  const targetDir = path.join(Helpers.publicPath(), 'download', seed.download.company, seed.download.email)
  fs.mkdirSync(targetDir, { recursive: true })
  const filePath = path.join(targetDir, seed.download.filename)
  fs.writeFileSync(filePath, '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
}

async function startHttpServer() {
  if (serverProcess) return

  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'testing',
      HOST: '127.0.0.1',
      PORT: '3334',
      APP_URL: 'http://127.0.0.1:3334',
      DB_CONNECTION: 'sqlite',
      DB_DATABASE: './tmp/test.sqlite',
      QUEUE_AUTOSTART: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Drain output to avoid child process deadlock on large logs.
  if (serverProcess.stdout) serverProcess.stdout.on('data', () => {})
  if (serverProcess.stderr) serverProcess.stderr.on('data', () => {})

  await waitUntilServerReady('127.0.0.1', 3334, 15000)
}

async function stopHttpServer() {
  if (!serverProcess) return

  const proc = serverProcess
  serverProcess = null

  await new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }

    proc.once('exit', finish)
    proc.kill('SIGTERM')

    setTimeout(() => {
      try { proc.kill('SIGKILL') } catch (e) { /* ignore */ }
      finish()
    }, 3000)
  })
}

async function waitUntilServerReady(host, port, timeoutMs) {
  const start = Date.now()
  while ((Date.now() - start) < timeoutMs) {
    const ok = await probeHttp(host, port)
    if (ok) return
    await sleep(250)
  }
  throw new Error(`HTTP server tidak siap pada ${host}:${port} dalam ${timeoutMs}ms`)
}

function probeHttp(host, port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host, port, path: '/', method: 'GET', timeout: 1000 },
      () => {
        resolve(true)
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      try { req.destroy() } catch (e) { /* ignore */ }
      resolve(false)
    })
    req.end()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
