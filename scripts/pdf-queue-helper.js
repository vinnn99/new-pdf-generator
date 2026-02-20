#!/usr/bin/env node
'use strict'

/**
 * PDF Queue System - Helper Script
 * 
 * Usage:
 *   node scripts/pdf-queue-helper.js <command> [options]
 * 
 * Commands:
 *   test-api              - Send a test PDF generation request
 *   list-jobs             - List all pending jobs in the queue
 *   list-failed           - List all failed jobs
 *   clear-jobs            - Delete all jobs from queue (use with caution)
 *   test-callback         - Test callback with dummy PDF data
 */

const http = require('http')
const Database = use('Database')
const Config = use('Config')

const command = process.argv[2]

async function testApi() {
  console.log('Sending test PDF generation request...\n')

  const testData = {
    data: {
      nama: 'Test User',
      judul: 'Test Music Title',
      nik: '1234567890123456',
      address: 'Test Address, City',
      pt: 'Test Company',
      pencipta: 'Test Creator',
      asNama: 'Test AS Name',
      bankName: 'Test Bank',
      npwp: '12345678901234',
      imail: 'test@example.com',
      phone: '+621234567890',
      norek: '9876543210'
    },
    template: 'music',
    callback: {
      url: 'https://webhook.site/12345678-1234-1234-1234-123456789012',
      header: {
        'x-callback-key': 'test-api'
      }
    }
  }

  const options = {
    hostname: 'localhost',
    port: 3333,
    path: '/api/v1/generate-pdf',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', chunk => {
        data += chunk
      })

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`)
        console.log(`Response:`)
        console.log(JSON.stringify(JSON.parse(data), null, 2))
        resolve()
      })
    })

    req.on('error', reject)
    req.write(JSON.stringify(testData))
    req.end()
  })
}

async function listJobs() {
  console.log('Fetching pending jobs from queue...\n')

  const queueConfig = Config.get('queue')
  const jobsTable = queueConfig.database.table || 'jobs'

  try {
    const jobs = await Database
      .table(jobsTable)
      .where('failed_at', null)
      .select('id', 'queue', 'attempts', 'created_at', 'updated_at')

    if (jobs.length === 0) {
      console.log('No pending jobs found.')
      return
    }

    console.table(jobs)
  } catch (error) {
    console.error('Error fetching jobs:', error.message)
  }
}

async function listFailed() {
  console.log('Fetching failed jobs from queue...\n')

  const queueConfig = Config.get('queue')
  const jobsTable = queueConfig.database.table || 'jobs'

  try {
    const jobs = await Database
      .table(jobsTable)
      .where('failed_at', '!=', null)
      .select('id', 'queue', 'attempts', 'created_at', 'failed_at')

    if (jobs.length === 0) {
      console.log('No failed jobs found.')
      return
    }

    console.table(jobs)
  } catch (error) {
    console.error('Error fetching failed jobs:', error.message)
  }
}

async function clearJobs() {
  const queueConfig = Config.get('queue')
  const jobsTable = queueConfig.database.table || 'jobs'

  const answer = await new Promise(resolve => {
    process.stdout.write('Are you sure you want to delete ALL jobs? (yes/no): ')
    process.stdin.once('data', data => {
      resolve(data.toString().trim().toLowerCase())
    })
  })

  if (answer !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }

  try {
    const result = await Database.table(jobsTable).delete()
    console.log(`\nDeleted ${result} jobs from queue`)
  } catch (error) {
    console.error('Error clearing jobs:', error.message)
  }
}

async function testCallback() {
  console.log('Simulating callback test...\n')

  const sampleBase64 = Buffer.from('Sample PDF content here').toString('base64')

  const callbackData = {
    success: true,
    file: sampleBase64,
    filename: 'music.pdf'
  }

  const options = {
    hostname: 'webhook.site',
    port: 443,
    path: '/12345678-1234-1234-1234-123456789012',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-key': 'test'
    }
  }

  console.log('Callback URL: https://webhook.site/12345678-1234-1234-1234-123456789012')
  console.log('Callback Payload:', JSON.stringify(callbackData, null, 2))
  console.log('\n(Note: Update the webhook.site URL from your test)')
}

async function main() {
  if (!command) {
    console.log(`
PDF Queue System Helper

Usage:
  node scripts/pdf-queue-helper.js <command>

Commands:
  test-api      - Send test PDF generation request to API
  list-jobs     - List all pending jobs in queue
  list-failed   - List all failed jobs
  clear-jobs    - Delete all jobs (CAUTION!)
  test-callback - Show callback test example

Examples:
  node scripts/pdf-queue-helper.js test-api
  node scripts/pdf-queue-helper.js list-jobs
    `)
    process.exit(0)
  }

  try {
    switch (command) {
      case 'test-api':
        await testApi()
        break
      case 'list-jobs':
        await listJobs()
        break
      case 'list-failed':
        await listFailed()
        break
      case 'clear-jobs':
        await clearJobs()
        break
      case 'test-callback':
        testCallback()
        break
      default:
        console.log(`Unknown command: ${command}`)
        process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

main()
