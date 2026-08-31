'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_COMPANY_NAME = 'PT. EXEL INTEGRASI SOLUSINDO'
const DEFAULT_SLIP_TITLE = 'SLIP GAJI'
const HEADER_BG = '#d92d2d'

module.exports = function exelPayslipTemplate(payloadData = {}) {
  const data = normalizePayload(payloadData)
  const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
  const printedAt = formatDateLong(new Date())
  const logoPath = path.join(__dirname, '..', '..', 'resources', 'images', 'logo-old.png')
  const hasLogo = fs.existsSync(logoPath)

  const earnings = Array.isArray(data.earnings) ? data.earnings : []
  const deductions = Array.isArray(data.deductions) ? data.deductions : []
  const earningsTotal = earnings.reduce((sum, item) => sum + num(item.amount), 0)
  const deductionsTotal = deductions.reduce((sum, item) => sum + num(item.amount), 0)
  const net = earningsTotal - deductionsTotal

  const row = (label, value, strong = false) => ([
    { text: label, style: 'label' },
    { text: value, style: strong ? 'valueStrong' : 'value', alignment: 'right' }
  ])

  const sectionTable = (title, items, isDeduction = false) => {
    const safeItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ label: isDeduction ? 'Potongan lain-lain' : 'Tunjangan', amount: 0 }]

    const body = [
      [
        { text: title, style: 'tableHead', colSpan: 2, alignment: 'left' },
        {}
      ],
      ...safeItems.map((item) => row(item.label || '-', fmt.format(num(item.amount)))),
      row('Subtotal', fmt.format(safeItems.reduce((sum, item) => sum + num(item.amount), 0)), true)
    ]

    return {
      table: { headerRows: 1, widths: ['70%', '30%'], body },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => '#dfe6ec',
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 6,
        paddingBottom: () => 6,
        fillColor: (rowIndex) => rowIndex === 0 ? HEADER_BG : null,
        textColor: (rowIndex) => rowIndex === 0 ? '#ffffff' : '#1f2d3d'
      }
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
        color: '#d92d2d',
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
              { text: data.period || '-', style: 'muted' }
            ],
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
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dfe6ec' }], margin: [0, 0, 0, 12] },
      {
        columns: [
          {
            width: '50%',
            table: {
              widths: ['30%', '70%'],
              body: [
                row('Nama', data.employeeName || '-'),
                row('NIP', data.employeeId || '-'),
                row('Jabatan', data.position || '-'),
                row('Departemen', data.department || '-'),
                row('Join Date', formatDateLong(data.joinDate || ''))
              ]
            },
            layout: 'noBorders'
          },
          {
            width: '50%',
            table: {
              widths: ['45%', '55%'],
              body: [
                row('Periode', data.period || data.periode || '-'),
                row('PTKP', data.ptkp || '-'),
                row('Jumlah HK', data.jumlahHK || data.targetHK || '-'),
                row('Kehadiran', data.attendance || '-')
              ]
            },
            layout: 'noBorders'
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 18]
      },
      sectionTable('Pendapatan', earnings, false),
      { text: '', margin: [0, 6, 0, 0] },
      sectionTable('Potongan', deductions, true),
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
      data.note
        ? {
            stack: [
              { text: 'Catatan', style: 'subtitle', margin: [0, 0, 0, 4] },
              { text: data.note, style: 'value' }
            ],
            margin: [0, 0, 0, 16]
          }
        : {},
      { text: '*These are the benefits you will get from the company, but not included in your take-home pay (THP).', style: 'footnote', margin: [0, 24, 0, 8] },
      { text: 'NOTE: For overtime detail, please confirm to HR.', style: 'footnoteBold', margin: [0, 0, 0, 12] },
      {
        text: [
          'THIS IS COMPUTER GENERATED PRINTOUT AND NO SIGNATURE IS REQUIRED.\n\n',
          'PLEASE NOTE THAT THE CONTENTS OF THIS STATEMENT SHOULD BE TREATED WITH ABSOLUTE CONFIDENTIALITY. ANY BREACH OF THIS OBLIGATION WILL BE DEALT WITH SERIOUSLY AND MAY INVOLVE DISCIPLINARY ACTION.\n\n',
          'HARAP DIPERHATIKAN, ISI PERNYATAAN INI ADALAH RAHASIA KECUALI UNTUK KEPERLUAN PAJAK ATAU HUKUM. SETIAP PELANGGARAN ATAS KEWAJIBAN MENJAGA KERAHASIAAN INI AKAN DIKENAKAN SANKSI.'
        ],
        style: 'footnote',
        margin: [0, 0, 0, 10]
      }
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, bold: true },
      muted: { color: '#95a5a6', fontSize: 9 },
      label: { color: '#7f8c8d', fontSize: 9 },
      value: { fontSize: 10 },
      valueStrong: { fontSize: 10, bold: true },
      tableHead: { fontSize: 10, bold: true, color: '#ffffff' },
      footnote: { fontSize: 8, color: '#666666' },
      footnoteBold: { fontSize: 9, bold: true, color: '#000000' }
    }
  }
}

function normalizePayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  return {
    companyName: firstValue(source, ['companyName', 'company_name', 'company']) || DEFAULT_COMPANY_NAME,
    slipTitle: (firstValue(source, ['slipTitle', 'slip_title', 'title', 'judul']) || DEFAULT_SLIP_TITLE).toString().toUpperCase(),
    employeeName: firstValue(source, ['employeeName', 'employee_name', 'nama', 'namaKaryawan']),
    employeeId: firstValue(source, ['employeeId', 'employee_id', 'nip', 'nik']),
    status: firstValue(source, ['status', 'STATUS']),
    area: firstValue(source, ['area', 'AREA']),
    department: firstValue(source, ['department', 'departement', 'departemen']),
    position: firstValue(source, ['position', 'jabatan', 'JABATAN']),
    npwp: firstValue(source, ['npwp', 'NPWP']),
    joinDate: firstValue(source, ['joinDate', 'join_date', 'tanggalMasuk', 'tglMasuk']),
    ptkp: firstValue(source, ['ptkp', 'PTKP']),
    targetHK: firstValue(source, ['targetHK', 'target_hk', 'jumlahHK', 'jumlah_hk', 'jumlah hk', 'jumlahhk']),
    attendance: firstValue(source, ['attendance', 'kehadiran']),
    note: firstValue(source, ['note', 'catatan']),
    periode: firstValue(source, ['periode', 'period']) || '-',
    jumlahHK: firstValue(source, ['jumlahHK', 'jumlah_hk', 'jumlah hk', 'JUMLAH HK', 'jumlahhk', 'targetHK', 'target_hk']) || '-',
    period: formatPeriodValue(firstValue(source, ['period', 'periode'])) || '-',
    earnings: normalizeMoneyList(firstValue(source, ['earnings', 'earningItems', 'items']) || source.earnings || []),
    deductions: normalizeMoneyList(firstValue(source, ['deductions', 'deductionItems']) || source.deductions || [])
  }
}

function normalizeMoneyList(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    label: item && item.label ? item.label : '-',
    amount: moneyValue(item && item.amount !== undefined ? item.amount : item)
  }))
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

function formatDateLong(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatPeriodValue(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim()
  if (!raw) return ''

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (iso) {
    const month = Number(iso[2])
    const year = Number(iso[1])
    if (month >= 1 && month <= 12) return `${months[month - 1]} ${year}`
  }

  const slash = raw.match(/^(\d{1,2})[/-](\d{4})$/)
  if (slash) {
    const month = Number(slash[1])
    const year = Number(slash[2])
    if (month >= 1 && month <= 12) return `${months[month - 1]} ${year}`
  }

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) {
    const month = Number(ymd[2])
    const year = Number(ymd[1])
    if (month >= 1 && month <= 12) return `${months[month - 1]} ${year}`
  }

  const monthName = raw.match(/^(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})$/i)
  if (monthName) {
    const monthIndex = months.findIndex((m) => m.toLowerCase() === monthName[1].toLowerCase())
    if (monthIndex >= 0) return `${months[monthIndex]} ${monthName[2]}`
  }

  return raw
}
