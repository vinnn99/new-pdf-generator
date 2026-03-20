'use strict'

const path = require('path')

/**
 * Template: Slip Gaji Bulanan
 *
 * Field yang diharapkan pada payload.data:
 * - employeeName   (string, wajib)
 * - employeeId     (string, opsional)
 * - position       (string, wajib)
 * - department     (string, opsional)
 * - period         (string, wajib, contoh: "Maret 2026")
 * - joinDate       (string ISO / yyyy-mm-dd, opsional)
 * - earnings       (array opsional) [{ label, amount }]
 * - deductions     (array opsional) [{ label, amount }]
 * - ptkp           (string, opsional)
 * - targetHK       (string/number, opsional)
 * - attendance     (string/number, opsional)
 * - slipTitle      (string, opsional, default: "Slip Gaji")
 * - note           (string, opsional)
 * - companyName    (string, otomatis dari middleware jika tersedia)
 */

module.exports = function payslipTemplate(payloadData = {}) {
  const {
    employeeName = '-',
    employeeId = '',
    position = '-',
    department = '',
    period = '-',
    joinDate = '',
    earnings = [],
    deductions = [],
    note = '',
    companyName = 'Perusahaan',
    ptkp = '',
    targetHK = '',
    attendance = '',
    slipTitle = 'Slip Gaji',
  } = payloadData

  const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
  const toDate = (str) => {
    if (!str) return '-'
    const d = new Date(str)
    if (Number.isNaN(d.getTime())) return str
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
  }
  const num = (val) => {
    if (val === null || val === undefined) return 0
    const cleaned = typeof val === 'string'
      ? val.replace(/[^0-9.-]/g, '')
      : val
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }

  const earningItems = Array.isArray(earnings) ? [...earnings] : []

  const earningsTotal = earningItems.reduce((s, it) => s + num(it.amount), 0)
  const deductionsTotal = (Array.isArray(deductions) ? deductions : []).reduce((s, it) => s + num(it.amount), 0)
  const net = earningsTotal - deductionsTotal
  const printedAt = toDate(new Date().toISOString())

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
      ...safeItems.map(it => row(it.label || '-', fmt.format(num(it.amount)))),
      row('Subtotal', fmt.format(
        safeItems.reduce((s, it) => s + num(it.amount), 0)
      ), true)
    ]

    const HEADER_BG = '#12B7AD'
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

  const logoPath = path.join(__dirname, '..', '..', 'resources', 'images', 'tema-logo.png')

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', color: '#1f2d3d', fontSize: 10 },
    content: [
      {
        columns: [
          {
            width: 80,
            image: logoPath,
            fit: [70, 70],
            margin: [0, 0, 10, 0]
          },
          {
            stack: [
              { text: companyName, style: 'title' },
              { text: slipTitle, style: 'subtitle' },
              { text: period, style: 'muted' }
            ],
            width: '*'
          },
          {
            stack: [
              { text: 'Tanggal Cetak', style: 'muted', alignment: 'right' },
              { text: printedAt, style: 'valueStrong', alignment: 'right' }
            ],
            width: '40%'
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 16]
      },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dfe6ec' }], margin: [0, 0, 0, 12] },

      {
        columns: [
          { width: '50%', table: { widths: ['30%', '70%'], body: [
            row('Nama', employeeName),
            row('NIP', employeeId || '-'),
            row('Jabatan', position),
            row('Departemen', department || '-'),
            row('Join Date', toDate(joinDate))
            
          ]}, layout: 'noBorders' },
          { width: '50%', table: { widths: ['45%', '55%'], body: [
            row('Periode', period),
            row('PTKP', ptkp || '-'),
            row('Target HK', targetHK || '-'),
            row('Kehadiran', attendance || '-')
          ]}, layout: 'noBorders' }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 18]
      },

      sectionTable('Pendapatan', earningItems, false),
      { text: '', margin: [0, 6, 0, 0] },
      sectionTable('Potongan', Array.isArray(deductions) ? deductions : [], true),

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

      note
        ? {
            stack: [
              { text: 'Catatan', style: 'subtitle', margin: [0, 0, 0, 4] },
              { text: note, style: 'value' }
            ],
            margin: [0, 0, 0, 16]
          }
        : {},

      // Footnotes & disclaimer
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
      footnoteBold: { fontSize: 9, bold: true, color: '#000000' },
    }
  }
}
