'use strict'

const path = require('path')

const suite = use('Test/Suite')('Exel Payslip Template')
const { test } = suite

const template = require(path.join(process.cwd(), 'app', 'Templates', 'exel-payslip'))
const TemplateResolver = use('App/Services/TemplateResolver')

test('template exel-payslip memuat default company dan warna merah untuk header', async ({ assert }) => {
  const doc = template({
    employeeName: 'Budi Exel',
    employeeId: 'E001',
    position: 'Supervisor',
    jumlahHK: 22,
    period: '2026-08',
    earnings: [{ label: 'Gaji Pokok', amount: 3000000 }],
    deductions: [{ label: 'BPJS', amount: 200000 }]
  })

  const text = collectText(doc.content)
  assert.include(text, 'PT. EXEL INTEGRASI SOLUSINDO')
  assert.include(text, 'SLIP GAJI')
  assert.include(text, 'Agustus 2026')
  assert.include(text, '22')
  assert.include(text, 'Pendapatan')
  assert.include(text, 'Potongan')
})

test('resolver exel-payslip mewajibkan employeeName position period', async ({ assert }) => {
  const resolved = await TemplateResolver.resolve('exel-payslip')
  const errors = TemplateResolver.validateRequiredFields({ employeeName: 'Budi' }, resolved.requiredFields)

  assert.include(resolved.requiredFields, 'employeeName')
  assert.include(resolved.requiredFields, 'position')
  assert.include(resolved.requiredFields, 'period')
  assert.include(errors, 'Field data.position is required')
  assert.include(errors, 'Field data.period is required')
})

function collectText(value) {
  if (Array.isArray(value)) return value.map(collectText).join(' ')
  if (!value || typeof value !== 'object') return value === undefined || value === null ? '' : String(value)
  return Object.keys(value)
    .map((key) => collectText(value[key]))
    .join(' ')
}
