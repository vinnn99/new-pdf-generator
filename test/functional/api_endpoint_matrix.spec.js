'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')

const suite = use('Test/Suite')('API Endpoint Matrix (No Email Send)')
suite.timeout(0)
const { test, trait, before, after } = suite

const Database = use('Database')
const User = use('App/Models/User')
const Helpers = use('Helpers')

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
  '/api/v1/bulk/ba-terminated'
]

const seed = {
  companyAId: null,
  companyBId: null,
  companyAApiKey: 'api_key_company_a',
  companyBApiKey: 'api_key_company_b',
  managedUserId: null,
  dynamicTemplateCompanyId: null,
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
      let request = client[endpoint.method](endpoint.url())

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

  const tables = ['dynamic_templates', 'email_logs', 'generated_pdfs', 'jobs', 'tokens', 'users', 'companies']
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

  await User.create({
    username: 'user_main',
    email: seed.credentials.user.email,
    password: seed.credentials.user.password,
    role: 'user',
    company_id: seed.companyAId,
    is_active: true
  })

  const adminMain = await User.create({
    username: 'admin_main',
    email: seed.credentials.admin.email,
    password: seed.credentials.admin.password,
    role: 'admin',
    company_id: seed.companyAId,
    is_active: true
  })

  await User.create({
    username: 'super_main',
    email: seed.credentials.superadmin.email,
    password: seed.credentials.superadmin.password,
    role: 'superadmin',
    company_id: null,
    is_active: true
  })

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
