'use strict'

/**
 * Template: Slip THR (Tunjangan Hari Raya)
 *
 * Field yang diharapkan pada payload.data:
 * - employeeName   (string, wajib)
 * - employeeId     (string, opsional)
 * - position       (string, wajib)
 * - department     (string, opsional)
 * - period         (string, wajib, contoh: "Idul Fitri 2026" atau "Mei 2026")
 * - payoutDate     (string ISO / yyyy-mm-dd, wajib)
 * - baseSalary     (number, wajib)
 * - allowance      (number, opsional, default 0)
 * - bonus          (number, opsional, default 0)
 * - deductions     (number, opsional, default 0)
 * - note           (string, opsional)
 * - companyName    (string, biasanya diisi otomatis dari middleware)
 */

module.exports = function thrTemplate(payloadData = {}) {
  const {
    employeeName = '-',
    employeeId = '',
    position = '-',
    department = '',
    period = '-',
    payoutDate = '',
    baseSalary = 0,
    allowance = 0,
    bonus = 0,
    deductions = 0,
    note = '',
    companyName = 'Perusahaan',
  } = payloadData

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
  const toDate = (str) => {
    if (!str) return '-'
    const d = new Date(str)
    if (Number.isNaN(d.getTime())) return str
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
  }

  const total = Number(baseSalary) + Number(allowance) + Number(bonus) - Number(deductions)

  const row = (label, value, strong = false) => ([
    { text: label, style: 'label' },
    { text: value, style: strong ? 'valueStrong' : 'value' }
  ])

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', color: '#1f2d3d', fontSize: 10 },
    content: [
      // Header
      {
        columns: [
          {
            stack: [
              { text: companyName, style: 'title' },
              { text: 'Slip THR', style: 'subtitle' },
              { text: period, style: 'muted' }
            ],
            width: '*'
          },
          {
            stack: [
              { text: 'Tanggal Dibayarkan', style: 'muted', alignment: 'right' },
              { text: toDate(payoutDate), style: 'valueStrong', alignment: 'right' }
            ],
            width: '40%'
          }
        ],
        margin: [0, 0, 0, 16]
      },

      // Garis
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dfe6ec' }], margin: [0, 0, 0, 12] },

      // Data karyawan
      {
        columns: [
          { width: '50%', table: { widths: ['30%', '70%'], body: [
            row('Nama', employeeName),
            row('NIP', employeeId || '-'),
            row('Jabatan', position),
            row('Departemen', department || '-')
          ]}, layout: 'noBorders' },
          { width: '50%', table: { widths: ['45%', '55%'], body: [
            row('Periode', period),
            row('Tanggal Bayar', toDate(payoutDate))
          ]}, layout: 'noBorders' }
        ],
        margin: [0, 0, 0, 18]
      },

      // Rincian THR
      {
        table: {
          headerRows: 1,
          widths: ['*', '35%'],
          body: [
            [
              { text: 'Komponen', style: 'tableHead' },
              { text: 'Jumlah', style: 'tableHead', alignment: 'right' }
            ],
            row('Gaji Pokok', formatter.format(baseSalary)),
            row('Tunjangan', formatter.format(allowance)),
            row('Bonus/Insentif', formatter.format(bonus)),
            row('Potongan', formatter.format(deductions)),
            [
              { text: 'Total Diterima', style: 'tableFoot' },
              { text: formatter.format(total), style: 'tableFoot', alignment: 'right' }
            ]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#dfe6ec',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8,
          fillColor: (rowIndex, node) => {
            const lastRow = node.table.body.length - 1
            if (rowIndex === 0) return '#1f2d3d'
            if (rowIndex === lastRow) return '#f6fbff'
            return null
          },
          textColor: (rowIndex) => rowIndex === 0 ? '#ffffff' : '#1f2d3d'
        },
        margin: [0, 0, 0, 16]
      },

      note
        ? {
            stack: [
              { text: 'Catatan', style: 'subtitle', margin: [0, 0, 0, 6] },
              { text: note, style: 'value' }
            ]
          }
        : {},

      { text: '\nDisetujui,', style: 'muted', margin: [0, 24, 0, 40] },
      {
        columns: [
          { width: '50%', stack: [
            { text: 'Penerima', style: 'muted' },
            { text: '\n\n\n', style: 'muted' },
            { text: employeeName, style: 'valueStrong' }
          ]},
          { width: '50%', stack: [
            { text: 'HR / Finance', style: 'muted', alignment: 'right' },
            { text: '\n\n\n', style: 'muted' },
            { text: companyName, style: 'valueStrong', alignment: 'right' }
          ]}
        ]
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
      tableFoot: { fontSize: 11, bold: true }
    }
  }
}
