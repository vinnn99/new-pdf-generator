'use strict'

const path = require('path')

const suite = use('Test/Suite')('Exel Payslip Template')
const { test } = suite

const template = require(path.join(process.cwd(), 'app', 'Templates', 'exel-payslip'))
const TemplateResolver = use('App/Services/TemplateResolver')
const SlipPayloadNormalizer = use('App/Services/SlipPayloadNormalizer')

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

test('Tunjangan Sewa Motor hanya menjadi earning pada exel-payslip', async ({ assert }) => {
  const exelPayload = SlipPayloadNormalizer.normalize({
    template: 'exel-payslip',
    data: {
      tunjanganSewaMotor: '250000'
    }
  })
  const otherPayslipPayload = SlipPayloadNormalizer.normalize({
    template: 'payslip',
    data: {
      tunjanganSewaMotor: '250000'
    }
  })
  const zeroAllowancePayload = SlipPayloadNormalizer.normalize({
    template: 'exel-payslip',
    data: {
      tunjangan_sewa_motor: 0,
      earnings: [{ label: 'Tunjangan Sewa Motor', amount: 0 }]
    }
  })

  const motorAllowance = exelPayload.earnings.find((item) => item.label === 'Tunjangan Sewa Motor')
  const doc = template({
    ...exelPayload,
    earnings: [{ label: 'Gaji Pokok', amount: 3000000 }, ...exelPayload.earnings],
    deductions: [{ label: 'BPJS', amount: 200000 }]
  })
  const text = collectText(doc.content)

  assert.equal(motorAllowance && motorAllowance.amount, 250000)
  assert.include(text, 'Tunjangan Sewa Motor')
  assert.include(text, '3.250.000')
  assert.include(text, '3.050.000')
  assert.isUndefined(otherPayslipPayload.earnings.find((item) => item.label === 'Tunjangan Sewa Motor'))
  assert.isUndefined(zeroAllowancePayload.earnings.find((item) => item.label === 'Tunjangan Sewa Motor'))
})

test('exel-payslip memakai komponen payroll baru dalam urutan canonical', async ({ assert }) => {
  const payload = SlipPayloadNormalizer.normalize({
    template: 'exel-payslip',
    data: {
      gajiPokok: '5.000.000',
      tunjanganMakan: 500000,
      tunjanganTransport: 300000,
      tunjanganSewaMotor: 250000,
      tunjanganKomunikasi: 200000,
      tunjanganJabatan: 400000,
      insentif: 600000,
      tunjanganBpjsKetenagakerjaan: 999999,
      bpjsKesehatan: 100000,
      bpjsKetenagakerjaan: 150000,
      pph21: 125000
    }
  })

  assert.deepEqual(payload.earnings.map((item) => item.label), [
    'Gaji Pokok',
    'Tunjangan Makan',
    'Tunjangan Transport',
    'Tunjangan Sewa Motor',
    'Tunjangan Komunikasi',
    'Tunjangan Jabatan',
    'Insentif'
  ])
  assert.deepEqual(payload.deductions.map((item) => item.label), [
    'BPJS Kesehatan',
    'BPJS Ketenagakerjaan',
    'PPH21'
  ])
  assert.isUndefined(payload.earnings.find((item) => item.label === 'Tunjangan BPJS Ketenagakerjaan'))

  const doc = template(payload)
  const text = collectText(doc.content)
  assert.include(text, 'Insentif')
  assert.include(text, 'BPJS Kesehatan')
  assert.include(text, '7.250.000')
  assert.include(text, '6.875.000')
})

test('exel-payslip canonical-kan array dan membuang komponen legacy atau asing', async ({ assert }) => {
  const payload = SlipPayloadNormalizer.normalize({
    template: 'exel-payslip',
    data: {
      earnings: [
        { label: 'Insentif', amount: 500000 },
        { label: 'Tunjangan BPJS Ketenagakerjaan', amount: 200000 },
        { label: 'Pendapatan Lain', amount: 100000 },
        { label: 'Gaji Pokok', amount: 3000000 }
      ],
      deductions: [
        { label: 'pph 21', amount: 100000 },
        { label: 'BPJS Kesehatan', amount: 50000 },
        { label: 'Potongan Lain', amount: 25000 }
      ],
      insentif: 900000
    }
  })

  assert.deepEqual(payload.earnings, [
    { label: 'Gaji Pokok', amount: 3000000 },
    { label: 'Insentif', amount: 500000 }
  ])
  assert.deepEqual(payload.deductions, [
    { label: 'BPJS Kesehatan', amount: 50000 },
    { label: 'PPH21', amount: 100000 }
  ])
})

function collectText(value) {
  if (Array.isArray(value)) return value.map(collectText).join(' ')
  if (!value || typeof value !== 'object') return value === undefined || value === null ? '' : String(value)
  return Object.keys(value)
    .map((key) => collectText(value[key]))
    .join(' ')
}
