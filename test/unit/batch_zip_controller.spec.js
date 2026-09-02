'use strict'

const fs = require('fs')
const path = require('path')
const stream = require('stream')

const suite = use('Test/Suite')('Batch ZIP Controller')
const { test } = suite
const BatchController = use('App/Controllers/Http/BatchController')
const Database = use('Database')

test('resolveSafeDownloadPath menolak path di luar public/download', async ({ assert }) => {
  const safe = BatchController.resolveSafeDownloadPath('public/download/company/user/file.pdf')
  assert.equal(safe, path.join(process.cwd(), 'public', 'download', 'company', 'user', 'file.pdf'))

  assert.equal(BatchController.resolveSafeDownloadPath('../outside/file.pdf'), null)
  assert.equal(BatchController.resolveSafeDownloadPath('public/../../etc/passwd'), null)
})

test('sanitizeZipEntryName membuat nama aman untuk file ZIP', async ({ assert }) => {
  assert.equal(BatchController.sanitizeZipEntryName('row-1/../bad.pdf'), 'row-1-bad.pdf')
  assert.equal(BatchController.sanitizeZipEntryName(''), 'batch-file.pdf')
})

test('downloadZip mengalirkan archive ke response.response native stream', async ({ assert }) => {
  const companyId = 42
  const batchId = 'batch-abc123'
  const safeDir = path.join(process.cwd(), 'public', 'download', 'test-batch-stream')
  fs.mkdirSync(safeDir, { recursive: true })
  const filePath = path.join(safeDir, 'sample.pdf')
  fs.writeFileSync(filePath, '%PDF-1.4\n% sample pdf\n%%EOF')

  const originalFrom = Database.from
  Database.from = (table) => {
    if (table === 'generation_batches') {
      return {
        where () { return this },
        first: async () => ({ batch_id: batchId, company_id: companyId })
      }
    }

    return {
      leftJoin () { return this },
      where () { return this },
      select () { return this },
      orderBy () { return this },
      then (resolve) {
        resolve([
          {
            row_no: 1,
            filename: 'sample.pdf',
            saved_path: filePath,
            status: 'success',
            generated_filename: 'sample.pdf'
          }
        ])
      }
    }
  }

  const nativeResponse = new stream.PassThrough()
  const chunks = []
  nativeResponse.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

  const response = {
    headersSent: false,
    implicitEnd: true,
    response: nativeResponse,
    header (key, value) {
      this[key] = value
      return this
    },
    status (code) {
      this.statusCode = code
      return this
    },
    json (payload) {
      this.payload = payload
      return this
    },
    end () {
      this.finished = true
      return this
    }
  }

  try {
    const result = await BatchController.prototype.downloadZip.call(
      { auth: { getUser: async () => ({ company_id: companyId, id: 1, role: 'admin' }) } },
      {
        params: { batch_id: batchId },
        response,
        auth: { getUser: async () => ({ company_id: companyId, id: 1, role: 'admin' }) }
      }
    )

    assert.isOk(result)
    assert.isTrue(Buffer.concat(chunks).length > 0)
    assert.isTrue(response.response instanceof stream.PassThrough)
  } finally {
    Database.from = originalFrom
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    if (fs.existsSync(safeDir)) fs.rmdirSync(safeDir, { recursive: true })
  }
})
