'use strict'

class SlipPayloadNormalizer {
  static normalize ({ template, data } = {}) {
    const normalizedTemplate = String(template || '').trim().toLowerCase()
    const source = isPlainObject(data) ? data : {}

    if (!isSlipTemplate(normalizedTemplate)) {
      return { ...source }
    }

    const out = { ...source }
    const isThr = normalizedTemplate === 'thr'

    assignAlias(out, 'department', ['department', 'departement', 'departemen'])
    assignAlias(out, 'period', ['period', 'periode'])
    assignAlias(out, 'employeeId', ['employeeId', 'employee_id', 'nip'])
    assignAlias(out, 'position', ['position', 'jabatan'])
    assignAlias(out, 'joinDate', ['joinDate', 'join_date', 'tanggalMasuk', 'tglMasuk'])
    assignAlias(out, 'targetHK', ['targetHK', 'target_hk'])
    assignAlias(out, 'attendance', ['attendance', 'kehadiran'])
    assignAlias(out, 'ptkp', ['ptkp', 'PTKP'])

    if (normalizedTemplate === 'insentif') {
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      if (isMissing(out.slipTitle)) out.slipTitle = 'Payslip Insentif'
    }

    if (isThr) {
      assignAlias(out, 'slipTitle', ['slipTitle', 'slip_title', 'title', 'judul'])
      if (isMissing(out.slipTitle)) out.slipTitle = 'Payslip THR'
      assignAlias(out, 'payoutDate', ['payoutDate', 'payout_date', 'tanggalPembayaran', 'tanggalBayar'])
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
  return template === 'payslip' || template === 'insentif' || template === 'thr'
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

module.exports = SlipPayloadNormalizer
