'use strict'

const suite = use('Test/Suite')('Excel Date Normalizer')
const { test } = suite

const ExcelDateService = use('App/Services/ExcelDateService')
const SlipPayloadNormalizer = use('App/Services/SlipPayloadNormalizer')
const PayloadDateNormalizer = use('App/Services/PayloadDateNormalizer')

test('mengubah serial tanggal Excel menjadi YYYY-MM-DD', async ({ assert }) => {
  assert.equal(ExcelDateService.parse(46233), '2026-07-30')
  assert.equal(ExcelDateService.parse(45049), '2023-05-03')
  assert.equal(ExcelDateService.parse('45917'), '2025-09-17')
})

test('menormalisasi joinDate slip dari serial Excel', async ({ assert }) => {
  const payload = SlipPayloadNormalizer.normalize({
    template: 'payslip',
    data: { employeeName: 'Budi', position: 'Staff', period: 'Juni 2026', joinDate: 46233 }
  })

  assert.equal(payload.joinDate, '2026-07-30')
})

test('menormalisasi field tanggal BA dari serial Excel', async ({ assert }) => {
  const payload = PayloadDateNormalizer.normalize({
    template: 'ba-request-id',
    data: { birthDate: 45049, joinDate: 45917, letterDate: 45478 }
  })

  assert.equal(payload.birthDate, '2023-05-03')
  assert.equal(payload.joinDate, '2025-09-17')
  assert.equal(payload.letterDate, '2024-07-05')
})
