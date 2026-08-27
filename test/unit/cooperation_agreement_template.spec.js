'use strict'

const path = require('path')

const suite = use('Test/Suite')('Cooperation Agreement Template')
const { test } = suite

const template = require(path.join(process.cwd(), 'app', 'Templates', 'cooperation_agreement'))
const CooperationAgreementService = use('App/Services/CooperationAgreementService')

test('menerapkan bold, blok korespondensi, dan indent numerik', async ({ assert }) => {
  const doc = template(samplePayload())
  const nodes = collectNodes(doc.content)
  const boldFragments = collectBoldFragments(doc.content)

  assert.isTrue(
    boldFragments.includes('PT. Contoh Company Indonesia') ||
    boldFragments.includes('PT. CONTOH COMPANY INDONESIA')
  )
  assert.isTrue(boldFragments.includes('TEMA Agency') || boldFragments.includes('TEMA AGENCY'))
  assert.isTrue(boldFragments.includes('MITRA'))
  assert.isFalse(boldFragments.includes('MITRAAN'))

  const correspondenceBlocks = nodes.filter((node) => node.unbreakable && node.table)
  assert.equal(correspondenceBlocks.length, 2)
  assert.deepEqual(correspondenceBlocks.map((block) => plainText(block.table.body[0][0].text)), [
    'PT. CONTOH COMPANY INDONESIA',
    'MITRA'
  ])
  assert.isTrue(correspondenceBlocks[1].table.body.some((row) => row[0].text === 'Nomor KTP'))

  const closingParagraph = nodes.find((node) => {
    return node.unbreakable &&
      Array.isArray(node.stack) &&
      node.stack.some((item) => plainText(item.text).includes('Demikianlah Perjanjian ini dibuat'))
  })
  assert.isOk(closingParagraph)

  const listItems = collectListItems(nodes)

  assert.isTrue(listItems.some((item) => item.number === '1.' && item.margin === 0 && item.width === 20))
  assert.isTrue(listItems.some((item) => item.number === '3.1.' && item.margin === 18 && item.width === 34))
  assert.isTrue(listItems.some((item) => item.number === '3.3.1' && item.margin === 52 && item.width === 44))
})

test('menyembunyikan tunjangan bernilai 0 dan menomori ulang sub tunjangan', async ({ assert }) => {
  const doc = template({
    ...samplePayload(),
    transportAllowance: 0,
    mealAllowance: 300000,
    phoneAllowance: 100000
  })
  const listItems = collectListItems(collectNodes(doc.content))
  const allowanceItems = listItems.filter((item) => /^3\.3\.\d+/.test(item.number))

  assert.equal(allowanceItems.length, 2)
  assert.isFalse(allowanceItems.some((item) => item.text.includes('Tunjangan transport')))
  assert.isTrue(allowanceItems.some((item) => item.number === '3.3.1' && item.margin === 52 && item.text.includes('Tunjangan makan')))
  assert.isTrue(allowanceItems.some((item) => item.number === '3.3.2' && item.margin === 52 && item.text.includes('Tunjangan pulsa')))

  const paymentContinuation = collectNodes(doc.content)
    .find((node) => plainText(node.text).includes('Seluruh pembayaran tersebut'))
  assert.isOk(paymentContinuation)
  assert.equal(paymentContinuation.margin[0], 52)
  assert.isUndefined(paymentContinuation.columns)
})

test('menampilkan lima tunjangan aktif dengan penomoran dan indent yang sama', async ({ assert }) => {
  const doc = template({
    ...samplePayload(),
    operationalCostAllowance: 250000,
    tlAllowance: 150000
  })
  const allowanceItems = collectListItems(collectNodes(doc.content))
    .filter((item) => /^3\.3\.\d+/.test(item.number))

  assert.equal(allowanceItems.length, 5)
  assert.deepEqual(allowanceItems.map((item) => item.number), ['3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.5'])
  assert.isTrue(allowanceItems.every((item) => item.margin === 52 && item.width === 44))
  assert.isTrue(allowanceItems[3].text.includes('Tunjangan biaya operasional'))
  assert.isTrue(allowanceItems[4].text.includes('Tunjangan TL'))
})

test('menyembunyikan tunjangan baru bernilai 0 atau blank dan menjaga nomor rapat', async ({ assert }) => {
  const doc = template({
    ...samplePayload(),
    transportAllowance: 0,
    mealAllowance: 300000,
    phoneAllowance: '',
    operationalCostAllowance: 250000,
    tlAllowance: 0
  })
  const allowanceItems = collectListItems(collectNodes(doc.content))
    .filter((item) => /^3\.3\.\d+/.test(item.number))

  assert.equal(allowanceItems.length, 2)
  assert.deepEqual(allowanceItems.map((item) => item.number), ['3.3.1', '3.3.2'])
  assert.isTrue(allowanceItems[0].text.includes('Tunjangan makan'))
  assert.isTrue(allowanceItems[1].text.includes('Tunjangan biaya operasional'))
  assert.isFalse(allowanceItems.some((item) => item.text.includes('Tunjangan TL')))
})

test('menghilangkan bagian tunjangan dan menaikkan nomor berikutnya saat semua tunjangan 0', async ({ assert }) => {
  const doc = template({
    ...samplePayload(),
    transportAllowance: 0,
    mealAllowance: 0,
    phoneAllowance: 0
  })
  const listItems = collectListItems(collectNodes(doc.content))

  assert.isFalse(listItems.some((item) => item.text.includes('MITRA sepakat mendapatkan upah dengan tunjangan')))
  assert.isFalse(listItems.some((item) => item.text.includes('Tunjangan transport')))
  assert.isFalse(listItems.some((item) => item.text.includes('Tunjangan makan')))
  assert.isFalse(listItems.some((item) => item.text.includes('Tunjangan pulsa')))
  assert.isTrue(listItems.some((item) => item.number === '3.3.' && item.text.includes('seluruh pembayaran atas gaji')))
  assert.isTrue(listItems.some((item) => item.number === '3.4.' && item.text.includes('MITRA berhak mendapatkan upah')))
  assert.isTrue(listItems.some((item) => item.number === '3.5.' && item.text.includes('MITRA melaksanakan kemitraan')))
})

test('menormalisasi alias tunjangan baru dan tidak mewajibkan allowance', async ({ assert }) => {
  const normalized = CooperationAgreementService.normalizeData({
    ...samplePayloadWithoutAllowances(),
    'tunjangan biaya operasional': '250.000',
    'tunjangan TL': '150000'
  })

  assert.equal(normalized.operationalCostAllowance, 250000)
  assert.equal(normalized.tlAllowance, 150000)
  assert.deepEqual(CooperationAgreementService.validateData(samplePayloadWithoutAllowances()), [])
})

function samplePayload() {
  return {
    companyName: 'PT. Contoh Company Indonesia',
    letterNo: '001/PKM/VIII/2026',
    firstPartyName: 'Direktur Contoh',
    firstPartyTitle: 'Direktur',
    partnerName: 'Budi Mitra',
    partnerNationality: 'Indonesia',
    partnerIdentityNumber: '3171000000000001',
    partnerBirthPlace: 'Jakarta',
    partnerBirthDate: '1990-01-01',
    partnerAddress: 'Alamat mitra',
    partnerPhone: '08123456789',
    partnerEmail: 'budi@example.com',
    brand: 'Brand Uji',
    salary: 5000000,
    transportAllowance: 100000,
    mealAllowance: 200000,
    phoneAllowance: 50000,
    partnerBankAccountNumber: '1234567890',
    partnerBankAccountName: 'Budi Mitra',
    partnerBankName: 'Bank Uji',
    agreementDuration: 12,
    workHoursPerDay: 8,
    placementArea: 'Jakarta',
    picName: 'PIC Contoh',
    picTitle: 'Manager',
    picEmail: 'pic@example.com',
    picAddress: 'Alamat PIC'
  }
}

function samplePayloadWithoutAllowances() {
  const data = samplePayload()
  delete data.transportAllowance
  delete data.mealAllowance
  delete data.phoneAllowance
  return data
}

function collectNodes(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out)
    return out
  }

  out.push(value)
  for (const key of Object.keys(value)) {
    if (key === 'text') continue
    collectNodes(value[key], out)
  }
  return out
}

function collectBoldFragments(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) collectBoldFragments(item, out)
    return out
  }

  if (Array.isArray(value.text)) {
    for (const fragment of value.text) {
      if (fragment && fragment.bold) out.push(plainText(fragment.text))
    }
  }

  for (const key of Object.keys(value)) {
    if (key === 'text') continue
    collectBoldFragments(value[key], out)
  }
  return out
}

function collectListItems(nodes) {
  return nodes
    .filter((node) => Array.isArray(node.columns) && node.columns[0] && node.columns[1])
    .map((node) => ({
      number: plainText(node.columns[0].text),
      text: plainText(node.columns[1].text),
      margin: node.margin && node.margin[0],
      width: node.columns[0].width
    }))
}

function plainText(value) {
  if (Array.isArray(value)) return value.map(plainText).join('')
  if (value && typeof value === 'object') return plainText(value.text)
  return value === undefined || value === null ? '' : String(value)
}
