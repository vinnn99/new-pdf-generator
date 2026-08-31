'use strict'

const path = require('path')

const suite = use('Test/Suite')('Event Weekly Payslip Template')
const { test } = suite

const template = require(path.join(process.cwd(), 'app', 'Templates', 'event_weekly_payslip'))
const SlipPayloadNormalizer = use('App/Services/SlipPayloadNormalizer')
const TemplateResolver = use('App/Services/TemplateResolver')

test('menampilkan struktur utama event weekly payslip', async ({ assert }) => {
  const doc = template(samplePayload())
  const text = collectText(doc.content)

  assert.include(text, 'PT. EXEL INTEGRASI SOLUSINDO')
  assert.include(text, 'SLIP GAJI')
  assert.include(text, '25/07/2026 - 31/07/2026')
  assert.include(text, 'Event mingguan outlet Jakarta')
  assert.include(text, 'PENDAPATAN')
  assert.include(text, '25/07/2026')
  assert.include(text, '31/07/2026')
  assert.include(text, 'POTONGAN')
  assert.include(text, 'ADJ/DEDUCTION')
  assert.include(text, 'PO TELAT')
  assert.include(text, 'KASBON')
  assert.include(text, 'Gaji Bersih (Net)')
})

test('normalizer membentuk 7 hari pendapatan dari alias event weekly', async ({ assert }) => {
  const data = SlipPayloadNormalizer.normalize({
    template: 'event_weekly_payslip',
    data: {
      nik: '3171000000000001',
      jabatan: 'Event Crew',
      periode: '25/07/2026 - 31/07/2026',
      deskripsi: 'Event mingguan outlet Jakarta',
      visitEarnings: [
        { tgl_date: '2026-07-25', tgl_value: '0' },
        { tgl_date: '2026-07-26', tgl_value: '0' },
        { tgl_date: '2026-07-27', tgl_value: '295.000' },
        { tgl_date: '2026-07-28', tgl_value: '295000' },
        { tgl_date: '2026-07-29', tgl_value: '295000' },
        { tgl_date: '2026-07-30', tgl_value: '295000' },
        { tgl_date: '2026-07-31', tgl_value: '295000' }
      ],
      'pot telat': '5.000',
      kasbon: '10.000'
    }
  })

  assert.equal(data.companyName, 'PT. EXEL INTEGRASI SOLUSINDO')
  assert.equal(data.slipTitle, 'SLIP GAJI')
  assert.equal(data.employeeId, '3171000000000001')
  assert.equal(data.position, 'Event Crew')
  assert.equal(data.description, 'Event mingguan outlet Jakarta')
  assert.equal(data.visitEarnings.length, 7)
  assert.equal(data.visitEarnings[0].date, '25/07/2026')
  assert.equal(data.visitEarnings[2].date, '27/07/2026')
  assert.equal(data.visitEarnings[2].amount, 295000)
  assert.equal(data.poTelat, 5000)
  assert.equal(data.kasbon, 10000)
})

test('pendapatan event weekly mengikuti jumlah input tanggal yang diberikan', async ({ assert }) => {
  const data = SlipPayloadNormalizer.normalize({
    template: 'event_weekly_payslip',
    data: {
      employeeName: 'Budi Event',
      employeeId: '3171000000000001',
      position: 'Event Crew',
      period: '25/07/2026 - 31/07/2026',
      visitEarnings: [
        { tgl_date: '2026-07-25', tgl_value: '150000' },
        { tgl_date: '2026-07-26', tgl_value: '200000' }
      ]
    }
  })

  assert.equal(data.visitEarnings.length, 2)
  assert.equal(data.visitEarnings[0].date, '25/07/2026')
  assert.equal(data.visitEarnings[1].date, '26/07/2026')
})

test('employeeName dan employeeId wajib untuk event weekly payslip', async ({ assert }) => {
  const resolved = await TemplateResolver.resolve('event_weekly_payslip')
  const errors = TemplateResolver.validateRequiredFields({ employeeId: '3171000000000001' }, resolved.requiredFields)

  assert.include(resolved.requiredFields, 'employeeName')
  assert.include(resolved.requiredFields, 'employeeId')
  assert.include(errors, 'Field data.employeeName is required')
})

function samplePayload() {
  return {
    employeeName: 'Budi Event',
    employeeId: '3171000000000001',
    status: 'ACTIVE',
    area: 'Jakarta',
    position: 'Event Crew',
    npwp: '09.123.456.7-012.000',
    jumlahHK: 7,
    period: '25/07/2026 - 31/07/2026',
    description: 'Event mingguan outlet Jakarta',
    visitEarnings: [
      { tgl_date: '2026-07-25', tgl_value: 0 },
      { tgl_date: '2026-07-26', tgl_value: 0 },
      { tgl_date: '2026-07-27', tgl_value: 295000 },
      { tgl_date: '2026-07-28', tgl_value: 295000 },
      { tgl_date: '2026-07-29', tgl_value: 295000 },
      { tgl_date: '2026-07-30', tgl_value: 295000 },
      { tgl_date: '2026-07-31', tgl_value: 295000 }
    ],
    adjustment: 0,
    poTelat: 0,
    kasbon: 0
  }
}

function collectText(value) {
  if (Array.isArray(value)) return value.map(collectText).join(' ')
  if (!value || typeof value !== 'object') return value === undefined || value === null ? '' : String(value)
  return Object.keys(value)
    .map((key) => collectText(value[key]))
    .join(' ')
}
