'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_COMPANY_NAME = 'PT. EXEL INTEGRASI SOLUSINDO'
const DEFAULT_SLIP_TITLE = 'SLIP GAJI'
const VISIT_DAYS = 7
const LOGO_BLUE = '#d92d2d'

module.exports = function eventWeeklyPayslipTemplate(payloadData = {}) {
  const data = normalizePayload(payloadData)
  const fmt = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  })
  const printedAt = formatDateLong(new Date())
  const logoPath = path.join(__dirname, '..', '..', 'resources', 'images', 'logo-old.png')
  const hasLogo = fs.existsSync(logoPath)

  const earningsTotal = data.visitEarnings.reduce((sum, item) => sum + num(item.amount), 0)
  const deductionItems = [
    { label: 'ADJ/DEDUCTION', amount: data.adjustment },
    { label: 'PO TELAT', amount: data.poTelat },
    { label: 'KASBON', amount: data.kasbon }
  ]
  const deductionsTotal = deductionItems.reduce((sum, item) => sum + num(item.amount), 0)
  const net = earningsTotal - deductionsTotal

  const row = (label, value, strong = false) => ([
    { text: label, style: 'label' },
    { text: value, style: strong ? 'valueStrong' : 'value', alignment: 'right' }
  ])

  const sectionTable = (title, items) => {
    const body = [
      [
        { text: title, style: 'tableHead', colSpan: 2, alignment: 'left' },
        {}
      ],
      ...items.map((item) => row(item.label || '-', fmt.format(num(item.amount)))),
      row('Subtotal', fmt.format(items.reduce((sum, item) => sum + num(item.amount), 0)), true)
    ]

    return {
      table: { headerRows: 1, widths: ['70%', '30%'], body },
      layout: tableLayout()
    }
  }

  const logoNode = hasLogo
    ? {
        width: 80,
        image: logoPath,
        fit: [70, 70],
        margin: [0, 0, 10, 0]
      }
    : {
        width: 80,
        text: 'EXEL',
        bold: true,
        color: '#0f766e',
        fontSize: 20,
        margin: [0, 8, 10, 0]
      }

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', color: '#1f2d3d', fontSize: 10 },
    content: [
      {
        columns: [
          logoNode,
          {
            stack: [
              { text: data.companyName, style: 'title' },
              { text: data.slipTitle, style: 'subtitle' },
              { text: data.period || '-', style: 'muted' },
              data.description ? { text: data.description, style: 'description' } : null
            ].filter(Boolean),
            width: '*'
          },
          {
            stack: [
              { text: 'Tanggal Cetak', style: 'muted', alignment: 'right' },
              { text: printedAt, style: 'valueStrong', alignment: 'right' }
            ],
            width: '35%'
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 16]
      },

      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dfe6ec' }],
        margin: [0, 0, 0, 12]
      },

      {
        columns: [
          {
            width: '50%',
            table: {
              widths: ['34%', '66%'],
              body: [
                row('Nama', data.employeeName || '-'),
                row('NIK', data.employeeId || '-'),
                row('Status', data.status || '-'),
                row('Area', data.area || '-')
              ]
            },
            layout: 'noBorders'
          },
          {
            width: '50%',
            table: {
              widths: ['40%', '60%'],
              body: [
                row('Jabatan', data.position || '-'),
                row('NPWP', data.npwp || '-'),
                row('Jumlah HK', data.jumlahHK || '-'),
                row('Periode', data.period || '-')
              ]
            },
            layout: 'noBorders'
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 18]
      },

      sectionTable('PENDAPATAN', data.visitEarnings),
      { text: '', margin: [0, 6, 0, 0] },
      sectionTable('POTONGAN', deductionItems),

      {
        table: {
          widths: ['70%', '30%'],
          body: [
            row('Total Pendapatan', fmt.format(earningsTotal)),
            row('Total Potongan', fmt.format(deductionsTotal)),
            row('Gaji Bersih (Net)', fmt.format(net), true)
          ]
        },
        layout: 'noBorders',
        margin: [0, 12, 0, 12]
      },

      {
        text: [
          'THIS IS COMPUTER GENERATED PRINTOUT AND NO SIGNATURE IS REQUIRED.\n\n',
          'PLEASE NOTE THAT THE CONTENTS OF THIS STATEMENT SHOULD BE TREATED WITH ABSOLUTE CONFIDENTIALITY.'
        ],
        style: 'footnote',
        margin: [0, 24, 0, 10]
      }
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, bold: true },
      description: { color: '#475569', fontSize: 9, margin: [0, 2, 0, 0] },
      muted: { color: '#95a5a6', fontSize: 9 },
      label: { color: '#7f8c8d', fontSize: 9 },
      value: { fontSize: 10 },
      valueStrong: { fontSize: 10, bold: true },
      tableHead: { fontSize: 10, bold: true, color: '#ffffff' },
      footnote: { fontSize: 8, color: '#666666' }
    }
  }
}

function normalizePayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const period = firstValue(source, ['period', 'periode']) || '-'
  const visitEarnings = normalizeVisitEarnings(source, period)

  return {
    companyName: firstValue(source, ['companyName', 'companyname', 'company_name']) || DEFAULT_COMPANY_NAME,
    slipTitle: (firstValue(source, ['slipTitle', 'sliptitle', 'slip_title']) || DEFAULT_SLIP_TITLE).toString().toUpperCase(),
    employeeName: firstValue(source, ['employeeName', 'employeename', 'employee_name', 'nama', 'namaKaryawan']),
    employeeId: firstValue(source, ['employeeId', 'employeeid', 'employee_id', 'nik', 'NIK']),
    status: firstValue(source, ['status', 'STATUS']),
    area: firstValue(source, ['area', 'AREA']),
    position: firstValue(source, ['position', 'jabatan', 'JABATAN']),
    npwp: firstValue(source, ['npwp', 'NPWP']),
    jumlahHK: firstValue(source, ['jumlahHK', 'jumlahhk', 'jumlah_hk', 'jumlah hk', 'JUMLAH HK']),
    period,
    description: firstValue(source, ['description', 'deskripsi', 'Deskripsi']),
    visitEarnings,
    adjustment: moneyValue(firstValue(source, ['adjustment', 'adjDeduction', 'adj_deduction', 'adj/deduction', 'ADJUSTMENT'])),
    poTelat: moneyValue(firstValue(source, ['poTelat', 'potTelat', 'po_telat', 'pot_telat', 'po telat', 'pot telat', 'POT TELAT'])),
    kasbon: moneyValue(firstValue(source, ['kasbon', 'KASBON']))
  }
}

function normalizeVisitEarnings(source, period) {
  const explicit = source.visitEarnings || source.visit_earnings || source.dailyEarnings || source.daily_earnings
  if (Array.isArray(explicit) && explicit.length) {
    const normalized = normalizeExplicitVisitEarnings(explicit)
    if (normalized.length) {
      return fillVisitItems(normalized, period, normalized.length)
    }
  }

  const dateKeyItems = Object.keys(source)
    .map((key) => ({ key, date: parseDateFromLabel(key) }))
    .filter((item) => item.date)
    .map((item) => ({
      label: formatDateShort(item.date),
      amount: moneyValue(source[item.key]),
      sort: item.date.getTime()
    }))
    .sort((left, right) => left.sort - right.sort)

  if (dateKeyItems.length) {
    return fillVisitItems(dateKeyItems, period, dateKeyItems.length)
  }

  const fallbackLength = VISIT_DAYS
  return fillVisitItems(Array.from({ length: fallbackLength }).map((_, index) => {
    const n = index + 1
    return {
      label: visitLabelForIndex(source, period, n),
      amount: moneyValue(firstValue(source, [
        `tgl${n}`,
        `tgl_${n}`,
        `TGL${n}`,
        `TGL ${n}`,
        `tgl${n}Amount`,
        `tgl${n}_amount`,
        `tgl${n} amount`
      ]))
    }
  }), period, fallbackLength)
}

function normalizeExplicitVisitEarnings(items) {
  return items
    .map((item, index) => {
      if (Array.isArray(item)) {
        return {
          label: formatDateValue(item[0]) || `TGL${index + 1}`,
          amount: moneyValue(item[1])
        }
      }
      if (item && typeof item === 'object') {
        return {
          label: formatDateValue(firstValue(item, ['tgl_date', 'tglDate', 'tgl date', 'date', 'tanggal', 'label', 'name'])) || `TGL${index + 1}`,
          amount: moneyValue(firstValue(item, ['tgl_value', 'tglValue', 'tgl value', 'amount', 'value', 'nominal', 'total']))
        }
      }
      return { label: `TGL${index + 1}`, amount: moneyValue(item) }
    })
    .filter((item) => item && String(item.label || '').trim() !== '')
}

function fillVisitItems(items, period, targetLength = VISIT_DAYS) {
  const start = parsePeriodStart(period)
  const out = Array.isArray(items) ? items.slice(0, targetLength) : []
  const hasRealValues = Array.isArray(items) && items.some((item) => item && String(item.label || '').trim() !== '')

  if (!hasRealValues) {
    for (let i = out.length; i < targetLength; i++) {
      out.push({
        label: start ? formatDateShort(addDays(start, i)) : `TGL${i + 1}`,
        amount: 0
      })
    }
  }

  return out.map((item, index) => ({
    label: item.label || `TGL${index + 1}`,
    amount: moneyValue(item.amount)
  }))
}

function visitLabelForIndex(source, period, n) {
  const explicit = firstValue(source, [
    `tgl${n}Date`,
    `tgl${n}_date`,
    `tgl${n} date`,
    `tanggal${n}`,
    `tanggal_${n}`,
    `tanggal ${n}`
  ])
  const formatted = formatDateValue(explicit)
  if (formatted) return formatted

  const start = parsePeriodStart(period)
  if (start) return formatDateShort(addDays(start, n - 1))
  return `TGL${n}`
}

function firstValue(obj, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    const value = obj[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    return value
  }
  return undefined
}

function num(value) {
  const parsed = moneyValue(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function moneyValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === undefined || value === null || value === '') return 0

  let str = String(value).trim()
  if (!str) return 0
  str = str.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '')

  const commaCount = (str.match(/,/g) || []).length
  const dotCount = (str.match(/\./g) || []).length
  if (commaCount > 0 && dotCount > 0) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(/,/g, '.')
    } else {
      str = str.replace(/,/g, '')
    }
  } else if (dotCount > 1) {
    str = str.replace(/\./g, '')
  } else if (commaCount > 0 && dotCount === 0) {
    str = str.replace(/,/g, '.')
  } else if (dotCount === 1 && /^\d{1,3}\.\d{3}$/.test(str)) {
    str = str.replace(/\./g, '')
  }

  const parsed = Number(str)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateFromLabel(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (match) {
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    const month = Number(match[2]) - 1
    const day = Number(match[1])
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function parsePeriodStart(period) {
  const raw = String(period || '')
  const match = raw.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/)
  return match ? parseDateFromLabel(match[1]) : null
}

function formatDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateShort(value)
  const parsed = parseDateFromLabel(value)
  return parsed ? formatDateShort(parsed) : (value ? String(value) : '')
}

function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

function formatDateShort(date) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear())
  ].join('/')
}

function formatDateLong(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function tableLayout() {
  return {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => '#dfe6ec',
    paddingLeft: () => 10,
    paddingRight: () => 10,
    paddingTop: () => 6,
    paddingBottom: () => 6,
    fillColor: (rowIndex) => rowIndex === 0 ? LOGO_BLUE : null
  }
}
