'use strict'

const ExcelDateService = require('./ExcelDateService')
const SlipPeriodService = require('./SlipPeriodService')

const EXEL_PAYSLIP_TEMPLATE = 'exel-payslip'
const EVENT_WEEKLY_PAYSLIP_TEMPLATE = 'event_weekly_payslip'
const EVENT_WEEKLY_DEFAULT_COMPANY = 'PT. EXEL INTEGRASI SOLUSINDO'
const EVENT_WEEKLY_DEFAULT_TITLE = 'SLIP GAJI'
const EVENT_WEEKLY_VISIT_DAYS = 7

class SlipPayloadNormalizer {
  static normalize ({ template, data } = {}) {
    const normalizedTemplate = String(template || '').trim().toLowerCase()
    const source = isPlainObject(data) ? data : {}

    if (!isSlipTemplate(normalizedTemplate)) {
      return { ...source }
    }

    const out = { ...source }
    const isThr = normalizedTemplate === 'thr'

    if (normalizedTemplate === EXEL_PAYSLIP_TEMPLATE) {
      assignAlias(out, 'companyName', ['companyName', 'company_name', 'company'])
      if (isMissing(out.companyName)) out.companyName = EVENT_WEEKLY_DEFAULT_COMPANY
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      if (isMissing(out.slipTitle)) out.slipTitle = EVENT_WEEKLY_DEFAULT_TITLE
      assignAlias(out, 'department', ['department', 'departement', 'departemen'])
      assignAlias(out, 'period', ['period', 'periode'])
      if (!isMissing(out.period)) out.period = SlipPeriodService.normalize(out.period)
      assignAlias(out, 'employeeName', ['employeeName', 'employee_name', 'nama', 'nama karyawan'])
      assignAlias(out, 'employeeId', ['employeeId', 'employee_id', 'nip', 'nik'])
      assignAlias(out, 'position', ['position', 'jabatan'])
      assignAlias(out, 'jumlahHK', ['jumlahHK', 'jumlah_hk', 'jumlah hk', 'jumlahhk'])
      assignAlias(out, 'joinDate', ['joinDate', 'join_date', 'tanggalMasuk', 'tglMasuk'])
      normalizeDate(out, 'joinDate')
      assignAlias(out, 'targetHK', ['targetHK', 'target_hk'])
      assignAlias(out, 'attendance', ['attendance', 'kehadiran'])
      assignAlias(out, 'ptkp', ['ptkp', 'PTKP'])
      const earnings = normalizeMoneyList(out.earnings)
      const deductions = normalizeMoneyList(out.deductions)
      appendAliasMoney(earnings, out, 'Gaji Pokok', ['gajiPokok', 'gaji_pokok', 'gaji pokok', 'baseSalary', 'base_salary'])
      appendAliasMoney(earnings, out, 'Tunjangan Makan', ['tunjanganMakan', 'tunjangan_makan', 'tunjangan makan'])
      appendAliasMoney(earnings, out, 'Tunjangan Transport', ['tunjanganTransport', 'tunjangan_transport', 'tunjangan transport'])
      appendAliasMoney(earnings, out, 'Tunjangan Komunikasi', ['tunjanganKomunikasi', 'tunjangan_komunikasi', 'tunjangan komunikasi', 'yunjangan komunikasi'])
      appendAliasMoney(earnings, out, 'Tunjangan Jabatan', ['tunjanganJabatan', 'tunjangan_jabatan', 'tunjangan jabatan'])
      appendAliasMoney(earnings, out, 'Tunjangan BPJS Ketenagakerjaan', ['tunjanganBpjsKetenagakerjaan', 'tunjanganBPJSKetenagakerjaan', 'tunjangan_bpjs_ketenagakerjaan', 'tunjangan bpjs ketenagakerjaan'])
      appendAliasMoney(deductions, out, 'BPJS Ketenagakerjaan', ['bpjsKetenagakerjaan', 'bpjs_ketenagakerjaan', 'bpjs ketenagakerjaan'])
      appendAliasMoney(deductions, out, 'PPh21', ['pph21', 'pph_21', 'pph 21'])
      out.earnings = earnings
      out.deductions = deductions
      return out
    }

    assignAlias(out, 'department', ['department', 'departement', 'departemen'])
    assignAlias(out, 'period', ['period', 'periode'])
    if (!isMissing(out.period)) out.period = SlipPeriodService.normalize(out.period)
    assignAlias(out, 'employeeName', ['employeeName', 'employee_name', 'nama', 'nama karyawan'])
    assignAlias(out, 'employeeId', ['employeeId', 'employee_id', 'nip', 'nik'])
    assignAlias(out, 'position', ['position', 'jabatan'])
    assignAlias(out, 'joinDate', ['joinDate', 'join_date', 'tanggalMasuk', 'tglMasuk'])
    normalizeDate(out, 'joinDate')
    assignAlias(out, 'targetHK', ['targetHK', 'target_hk'])
    assignAlias(out, 'attendance', ['attendance', 'kehadiran'])
    assignAlias(out, 'ptkp', ['ptkp', 'PTKP'])

    if (normalizedTemplate === EVENT_WEEKLY_PAYSLIP_TEMPLATE) {
      assignAlias(out, 'status', ['status'])
      assignAlias(out, 'area', ['area', 'wilayah', 'region'])
      assignAlias(out, 'npwp', ['npwp', 'NPWP'])
      assignAlias(out, 'jumlahHK', ['jumlahHK', 'jumlah_hk', 'jumlah hk', 'jumlahhk'])
      assignAlias(out, 'description', ['description', 'deskripsi'])
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      assignAlias(out, 'companyName', ['companyName', 'company_name', 'company'])
      if (isMissing(out.companyName)) out.companyName = EVENT_WEEKLY_DEFAULT_COMPANY
      if (isMissing(out.slipTitle)) out.slipTitle = EVENT_WEEKLY_DEFAULT_TITLE

      out.visitEarnings = normalizeEventVisitEarnings(out)
      out.adjustment = eventAmount(pickFirstValue(out, ['adjustment', 'adjDeduction', 'adj_deduction', 'adj/deduction', 'adj deduction']))
      out.poTelat = eventAmount(pickFirstValue(out, ['poTelat', 'po_telat', 'potTelat', 'pot_telat', 'po telat', 'pot telat']))
      out.kasbon = eventAmount(pickFirstValue(out, ['kasbon']))
      out.earnings = out.visitEarnings.map((item) => ({ label: item.date || item.label, amount: item.amount }))
      out.deductions = [
        { label: 'ADJ/DEDUCTION', amount: out.adjustment },
        { label: 'PO TELAT', amount: out.poTelat },
        { label: 'KASBON', amount: out.kasbon }
      ]

      return out
    }

    if (normalizedTemplate === 'insentif') {
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      if (isMissing(out.slipTitle)) out.slipTitle = 'Payslip Insentif'
    }

    if (isThr) {
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      if (isMissing(out.slipTitle)) out.slipTitle = 'Payslip THR'
      assignAlias(out, 'payoutDate', ['payoutDate', 'payout_date', 'tanggalPembayaran', 'tanggalBayar'])
      normalizeDate(out, 'payoutDate')
    }

    const baseSalaryValue = pickFirstValue(out, ['baseSalary', 'base_salary', 'gajiPokok', 'gaji_pokok', 'gaji pokok'])
    if (!isMissing(baseSalaryValue) && isMissing(out.baseSalary)) {
      out.baseSalary = toAmount(baseSalaryValue)
    }

    const earnings = normalizeMoneyList(out.earnings)
    const deductions = normalizeMoneyList(out.deductions)

    if (earnings.length === 0 && Array.isArray(out.items)) {
      earnings.push(...normalizeMoneyList(out.items))
    }

    appendAliasMoney(earnings, out, 'Gaji Pokok', ['gajiPokok', 'gaji_pokok', 'gaji pokok', 'baseSalary', 'base_salary'])
    appendAliasMoney(earnings, out, 'Tunjangan Makan', ['tunjanganMakan', 'tunjangan_makan', 'tunjangan makan'])
    appendAliasMoney(earnings, out, 'Tunjangan Transport', ['tunjanganTransport', 'tunjangan_transport', 'tunjangan transport'])
    appendAliasMoney(earnings, out, 'Tunjangan Komunikasi', ['tunjanganKomunikasi', 'tunjangan_komunikasi', 'tunjangan komunikasi', 'yunjangan komunikasi'])
    appendAliasMoney(earnings, out, 'Tunjangan Jabatan', ['tunjanganJabatan', 'tunjangan_jabatan', 'tunjangan jabatan'])
    appendAliasMoney(earnings, out, 'Tunjangan BPJS Ketenagakerjaan', ['tunjanganBpjsKetenagakerjaan', 'tunjanganBPJSKetenagakerjaan', 'tunjangan_bpjs_ketenagakerjaan', 'tunjangan bpjs ketenagakerjaan', 'tunjanganBpjs', 'tunjanganBPJS', 'tunjangan_bpjs', 'tunjangan bpjs'])
    appendAliasMoney(earnings, out, 'INSENTIF SAMPLING', ['insentifSampling', 'insentif_sampling', 'insentif sampling'])
    appendAliasMoney(earnings, out, 'INSENTIF SELLOUT', ['insentifSellout', 'insentif_sellout', 'insentif sellout', 'insentif  sellout'])
    appendAliasMoney(earnings, out, 'INSENTIF KERAJINAN', ['insentifKerajinan', 'insentif_kerajinan', 'insentif kerajinan'])
    appendAliasMoney(earnings, out, 'INSENTIF TL', ['insentifTl', 'insentif_tl', 'insentif tl'])
    appendAliasMoney(earnings, out, 'THR', ['thr', 'THR'])

    appendAliasMoney(deductions, out, 'BPJS Ketenagakerjaan', ['bpjsKetenagakerjaan', 'bpjs_ketenagakerjaan', 'bpjs ketenagakerjaan'])
    appendAliasMoney(deductions, out, 'PPh21', ['pph21', 'pph_21', 'pph 21', 'PPh21'])

    if (isThr) {
      const baseFromEarnings = pickMoneyByLabel(earnings, ['gaji pokok', 'thr'])
      if (isMissing(out.baseSalary) && !isMissing(baseFromEarnings)) {
        out.baseSalary = toAmount(baseFromEarnings)
      }
      if (isMissing(out.baseSalary)) out.baseSalary = 0

      const allowanceValue = pickFirstValue(out, ['allowance', 'tunjangan', 'tunjanganThr', 'tunjangan_thr'])
      if (!isMissing(allowanceValue)) {
        out.allowance = toAmount(allowanceValue)
      } else if (isMissing(out.allowance)) {
        out.allowance = 0
      }

      const bonusValue = pickFirstValue(out, ['bonus', 'bonusInsentif', 'bonus_insentif'])
      if (!isMissing(bonusValue)) {
        out.bonus = toAmount(bonusValue)
      } else if (isMissing(out.bonus)) {
        out.bonus = sumMoneyByLabel(earnings, ['bonus', 'insentif'])
      }

      const deductionScalar = pickFirstValue(out, ['deduction', 'potongan'])
      const deductionTotal = !isMissing(deductionScalar)
        ? toAmount(deductionScalar)
        : sumMoneyList(deductions)

      out.deductionsItems = deductions
      out.deductions = deductionTotal
      out.baseSalary = toNumberSafe(out.baseSalary)
      out.allowance = toNumberSafe(out.allowance)
      out.bonus = toNumberSafe(out.bonus)
      out.deductions = toNumberSafe(out.deductions)
    } else {
      out.deductions = deductions
    }

    out.earnings = earnings

    return out
  }
}

function isSlipTemplate (template) {
  return template === 'payslip' ||
    template === 'insentif' ||
    template === 'thr' ||
    template === EXEL_PAYSLIP_TEMPLATE ||
    template === EVENT_WEEKLY_PAYSLIP_TEMPLATE
}

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function isMissing (value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim())
}

function pickFirstValue (obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !isMissing(obj[key])) {
      return obj[key]
    }
  }
  return undefined
}

function assignAlias (obj, targetKey, aliases) {
  if (!isMissing(obj[targetKey])) return
  const picked = pickFirstValue(obj, aliases)
  if (!isMissing(picked)) obj[targetKey] = picked
}

function normalizeDate (obj, key) {
  if (isMissing(obj[key])) return
  obj[key] = ExcelDateService.parse(obj[key])
}

function normalizeMoneyList (input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => normalizeMoneyItem(item))
      .filter(Boolean)
  }

  if (isPlainObject(input)) {
    return Object.keys(input)
      .map((label) => normalizeMoneyItem({ label, amount: input[label] }))
      .filter(Boolean)
  }

  return []
}

function normalizeMoneyItem (item) {
  if (!isPlainObject(item)) return null

  const label = pickFirstValue(item, ['label', 'name', 'title', 'description'])
  const amount = pickFirstValue(item, ['amount', 'value', 'nominal', 'total'])
  if (isMissing(amount) && isMissing(label)) return null

  return {
    label: isMissing(label) ? '-' : String(label),
    amount: toAmount(amount)
  }
}

function appendAliasMoney (list, source, label, keys) {
  const value = pickFirstValue(source, keys)
  if (isMissing(value)) return
  if (hasLabel(list, label)) return
  list.push({ label, amount: toAmount(value) })
}

function hasLabel (list, label) {
  const needle = normalizeLabel(label)
  return list.some((item) => normalizeLabel(item && item.label) === needle)
}

function normalizeLabel (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function toAmount (value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return 0

  const normalized = normalizeNumberString(trimmed)
  const parsed = Number(normalized)
  if (Number.isFinite(parsed)) return parsed

  return value
}

function normalizeNumberString (value) {
  let str = String(value).replace(/\s+/g, '').replace(/[^0-9,.-]/g, '')
  const commaCount = (str.match(/,/g) || []).length
  const dotCount = (str.match(/\./g) || []).length

  if (commaCount > 0 && dotCount > 0) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(/,/g, '.')
    } else {
      str = str.replace(/,/g, '')
    }
  } else if (commaCount > 0 && dotCount === 0) {
    str = str.replace(/,/g, '.')
  } else if (dotCount === 1 && /^\d{1,3}\.\d{3}$/.test(str)) {
    str = str.replace(/\./g, '')
  } else if (dotCount > 1) {
    str = str.replace(/\./g, '')
  }

  return str
}

function toNumberSafe (value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(normalizeNumberString(value.trim()))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sumMoneyList (list) {
  if (!Array.isArray(list)) return 0
  return list.reduce((sum, item) => sum + toNumberSafe(item && item.amount), 0)
}

function pickMoneyByLabel (list, labels) {
  if (!Array.isArray(list)) return undefined
  const normalizedLabels = (labels || []).map((label) => normalizeLabel(label))
  for (const item of list) {
    const label = normalizeLabel(item && item.label)
    if (normalizedLabels.includes(label)) return item.amount
  }
  return undefined
}

function sumMoneyByLabel (list, keywords) {
  if (!Array.isArray(list)) return 0
  const needles = (keywords || []).map((k) => normalizeLabel(k))
  return list.reduce((sum, item) => {
    const label = normalizeLabel(item && item.label)
    const match = needles.some((needle) => label.includes(needle))
    if (!match) return sum
    return sum + toNumberSafe(item && item.amount)
  }, 0)
}

function normalizeEventVisitEarnings (source) {
  const explicit = source.visitEarnings || source.visit_earnings || source.dailyEarnings || source.daily_earnings
  if (Array.isArray(explicit) && explicit.length) {
    const normalized = explicit.map((item, index) => normalizeEventVisitItem(item, index))
    return fillEventVisitEarnings(normalized, source.period, normalized.length)
  }

  const dateKeyItems = Object.keys(source || {})
    .map((key) => ({ key, date: parseDateLabel(key) }))
    .filter((item) => item.date)
    .map((item) => ({
      date: formatDateShort(item.date),
      amount: eventAmount(source[item.key]),
      sort: item.date.getTime()
    }))
    .sort((left, right) => left.sort - right.sort)

  if (dateKeyItems.length) {
    return fillEventVisitEarnings(dateKeyItems.slice(0, EVENT_WEEKLY_VISIT_DAYS), source.period, dateKeyItems.length)
  }

  return fillEventVisitEarnings(Array.from({ length: EVENT_WEEKLY_VISIT_DAYS }).map((_, index) => {
    const n = index + 1
    return {
      date: eventVisitDateForIndex(source, n),
      amount: eventAmount(pickFirstValue(source, [
        `tgl${n}`,
        `tgl_${n}`,
        `tgl ${n}`,
        `TGL${n}`,
        `TGL ${n}`,
        `tgl${n}Amount`,
        `tgl${n}_amount`,
        `tgl${n} amount`
      ]))
    }
  }), source.period)
}

function normalizeEventVisitItem (item, index) {
  if (Array.isArray(item)) {
    return {
      date: formatDateValue(item[0]) || `TGL${index + 1}`,
      amount: eventAmount(item[1])
    }
  }

  if (isPlainObject(item)) {
    return {
      date: formatDateValue(pickFirstValue(item, ['tgl_date', 'tglDate', 'tgl date', 'date', 'tanggal', 'label', 'name'])) || `TGL${index + 1}`,
      amount: eventAmount(pickFirstValue(item, ['tgl_value', 'tglValue', 'tgl value', 'amount', 'value', 'nominal', 'total']))
    }
  }

  return {
    date: `TGL${index + 1}`,
    amount: eventAmount(item)
  }
}

function fillEventVisitEarnings (items, period, targetLength = EVENT_WEEKLY_VISIT_DAYS) {
  const list = Array.isArray(items)
    ? items.filter((item) => item && String(item.date || item.label || '').trim() !== '').slice(0, targetLength)
    : []
  const start = parsePeriodStart(period)
  const hasRealValues = Array.isArray(items) && items.some((item) => item && String(item.date || item.label || '').trim() !== '')

  if (!hasRealValues) {
    for (let i = list.length; i < targetLength; i++) {
      list.push({
        date: start ? formatDateShort(addDays(start, i)) : `TGL${i + 1}`,
        amount: 0
      })
    }
  }

  return list.map((item, index) => ({
    date: item.date || item.label || (start ? formatDateShort(addDays(start, index)) : `TGL${index + 1}`),
    amount: eventAmount(item.amount)
  }))
}

function eventVisitDateForIndex (source, n) {
  const explicit = pickFirstValue(source, [
    `tgl${n}Date`,
    `tgl${n}_date`,
    `tgl${n} date`,
    `tanggal${n}`,
    `tanggal_${n}`,
    `tanggal ${n}`
  ])
  const formatted = formatDateValue(explicit)
  if (formatted) return formatted

  const start = parsePeriodStart(source.period)
  if (start) return formatDateShort(addDays(start, n - 1))
  return `TGL${n}`
}

function eventAmount (value) {
  return toNumberSafe(toAmount(value))
}

function parsePeriodStart (period) {
  const raw = String(period || '')
  const match = raw.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/)
  return match ? parseDateLabel(match[1]) : null
}

function parseDateLabel (value) {
  const raw = String(value || '').trim()
  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (local) {
    const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3])
    const date = new Date(year, Number(local[2]) - 1, Number(local[1]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function formatDateValue (value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateShort(value)
  const parsed = parseDateLabel(value)
  if (parsed) return formatDateShort(parsed)
  return isMissing(value) ? '' : String(value)
}

function addDays (date, days) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

function formatDateShort (date) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear())
  ].join('/')
}

module.exports = SlipPayloadNormalizer
