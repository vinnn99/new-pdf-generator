'use strict'

/**
 * Invoice PDF Template
 *
 * Fields (payloadData):
 *   invoiceNo        - Nomor invoice (opsional, auto-generate jika kosong)
 *   companyName      - Nama perusahaan pengirim
 *   companyAddress   - Alamat perusahaan
 *   companyPhone     - No. telp perusahaan
 *   companyEmail     - Email perusahaan
 *   clientName       - Nama klien / penerima tagihan
 *   clientAddress    - Alamat klien
 *   clientEmail      - Email klien
 *   items            - Array of { description, qty, price }
 *   tax              - Persentase pajak (default: 11)
 *   bankName         - Nama bank untuk pembayaran
 *   accountNo        - Nomor rekening
 *   accountName      - Nama pemilik rekening
 *   notes            - Catatan tambahan
 *   dueDate          - Tanggal jatuh tempo (ISO string, opsional)
 *   createdAt        - Tanggal invoice dibuat (ISO string, opsional)
 */
module.exports = function invoiceTemplate(payloadData) {
  const {
    invoiceNo = '',
    companyName = '',
    companyAddress = '',
    companyPhone = '',
    companyEmail = '',
    clientName = '',
    clientAddress = '',
    clientEmail = '',
    items = [],
    tax = 11,
    bankName = '',
    accountNo = '',
    accountName = '',
    notes = '',
    dueDate = '',
    createdAt = new Date().toISOString(),
  } = payloadData

  // ── Helpers ─────────────────────────────────────────────────
  const _months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  function formatDate(isoStr) {
    const d = isoStr ? new Date(isoStr) : new Date()
    return `${d.getDate()} ${_months[d.getMonth()]} ${d.getFullYear()}`
  }

  function formatRupiah(amount) {
    return 'Rp ' + (Number(amount) || 0).toLocaleString('id-ID')
  }

  function generateInvoiceNo() {
    const now = new Date()
    const yy = now.getFullYear().toString().slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const seq = String(Math.floor(Math.random() * 9000) + 1000)
    return `INV/${yy}${mm}/${seq}`
  }

  // ── Computed ─────────────────────────────────────────────────
  const docInvoiceNo = invoiceNo || generateInvoiceNo()
  const docDate      = formatDate(createdAt)
  const docDueDate   = dueDate ? formatDate(dueDate) : formatDate(new Date(Date.now() + 14 * 86400000).toISOString())

  const parsedItems = Array.isArray(items) ? items : []
  const subtotal    = parsedItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const taxAmount   = Math.round(subtotal * (Number(tax) / 100))
  const grandTotal  = subtotal + taxAmount

  // ── Colors ───────────────────────────────────────────────────
  const PRIMARY    = '#1a3c5e'
  const ACCENT     = '#2980b9'
  const LIGHT_BG   = '#f0f4f8'
  const BORDER     = '#c8d6e5'
  const TEXT_MUTED = '#7f8c8d'

  // ── Table ────────────────────────────────────────────────────
  const tableHeader = [
    { text: 'No.',          style: 'tableHead', alignment: 'center' },
    { text: 'Deskripsi',    style: 'tableHead' },
    { text: 'Qty',          style: 'tableHead', alignment: 'center' },
    { text: 'Harga Satuan', style: 'tableHead', alignment: 'right' },
    { text: 'Subtotal',     style: 'tableHead', alignment: 'right' },
  ]

  const tableRows = parsedItems.length > 0
    ? parsedItems.map((it, idx) => {
        const lineTotal = (Number(it.qty) || 0) * (Number(it.price) || 0)
        return [
          { text: String(idx + 1),             alignment: 'center', style: 'tableCell' },
          { text: it.description || '-',       style: 'tableCell' },
          { text: String(Number(it.qty) || 0), alignment: 'center', style: 'tableCell' },
          { text: formatRupiah(it.price),      alignment: 'right',  style: 'tableCell' },
          { text: formatRupiah(lineTotal),     alignment: 'right',  style: 'tableCell' },
        ]
      })
    : [[{ text: '-', colSpan: 5, alignment: 'center', style: 'tableCell', color: TEXT_MUTED }, {}, {}, {}, {}]]

  // ── Document Definition ──────────────────────────────────────
  return {
    pageSize: 'A4',
    pageMargins: [45, 45, 45, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#2c3e50' },

    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Dicetak pada: ${formatDate(new Date().toISOString())}`, color: TEXT_MUTED, fontSize: 7.5, margin: [45, 0, 0, 0] },
        { text: `Halaman ${currentPage} dari ${pageCount}`, alignment: 'right', color: TEXT_MUTED, fontSize: 7.5, margin: [0, 0, 45, 0] },
      ],
      margin: [0, 15, 0, 0],
    }),

    content: [
      // Top bar
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 505.28, h: 6, color: PRIMARY }], margin: [0, 0, 0, 18] },

      // Company + Invoice title
      {
        columns: [
          {
            stack: [
              { text: companyName || 'Nama Perusahaan', style: 'companyName' },
              { text: companyAddress || '-', style: 'companyDetail', margin: [0, 2, 0, 0] },
              companyPhone ? { text: `Tel: ${companyPhone}`, style: 'companyDetail' } : {},
              companyEmail ? { text: `Email: ${companyEmail}`, style: 'companyDetail' } : {},
            ],
            width: '*',
          },
          {
            stack: [
              { canvas: [{ type: 'rect', x: 0, y: 0, w: 170, h: 44, color: PRIMARY, r: 4 }] },
              { text: 'INVOICE', fontSize: 22, bold: true, color: '#ffffff', relativePosition: { x: 0, y: -38 }, width: 170, alignment: 'center' },
            ],
            width: 170,
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Meta + Bill To
      {
        columns: [
          {
            stack: [
              { text: 'TAGIHAN KEPADA', fontSize: 7.5, bold: true, color: TEXT_MUTED, margin: [0, 0, 0, 4] },
              { text: clientName    || '-', style: 'clientName' },
              { text: clientAddress || '-', style: 'clientDetail' },
              clientEmail ? { text: clientEmail, style: 'clientDetail' } : {},
            ],
            width: '*',
          },
          {
            stack: [
              { columns: [{ text: 'No. Invoice',  style: 'metaLabel', width: 90 }, { text: `: ${docInvoiceNo}`, style: 'metaValue' }] },
              { columns: [{ text: 'Tanggal',      style: 'metaLabel', width: 90 }, { text: `: ${docDate}`,      style: 'metaValue' }] },
              { columns: [{ text: 'Jatuh Tempo',  style: 'metaLabel', width: 90 }, { text: `: ${docDueDate}`,   style: 'metaValue', color: '#c0392b', bold: true }] },
            ],
            width: 240,
          },
        ],
        margin: [0, 0, 0, 24],
      },

      // Items table
      {
        table: {
          headerRows: 1,
          widths: [28, '*', 40, 90, 90],
          body: [tableHeader, ...tableRows],
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: (i) => i === 1 ? ACCENT : BORDER,
          fillColor: (rowIndex) => rowIndex === 0 ? PRIMARY : (rowIndex % 2 === 0 ? LIGHT_BG : null),
          paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 0],
      },

      // Totals
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 240,
            table: {
              widths: ['*', 100],
              body: [
                [{ text: 'Subtotal',           style: 'totalLabel' }, { text: formatRupiah(subtotal),  style: 'totalValue' }],
                [{ text: `PPN ${tax}%`,         style: 'totalLabel' }, { text: formatRupiah(taxAmount), style: 'totalValue' }],
                [
                  { text: 'TOTAL', style: 'grandTotalLabel', fillColor: PRIMARY, color: '#ffffff' },
                  { text: formatRupiah(grandTotal), style: 'grandTotalValue', fillColor: PRIMARY, color: '#ffffff' },
                ],
              ],
            },
            layout: {
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
              vLineWidth: () => 0, hLineColor: () => BORDER,
              paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 5, paddingBottom: () => 5,
            },
          },
        ],
        margin: [0, 0, 0, 24],
      },

      // Divider
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 505.28, h: 1, color: BORDER }], margin: [0, 0, 0, 12] },

      // Payment info + Notes
      {
        columns: [
          {
            stack: [
              { text: 'INFORMASI PEMBAYARAN', fontSize: 7.5, bold: true, color: TEXT_MUTED, margin: [0, 0, 0, 6] },
              {
                table: {
                  widths: [80, '*'],
                  body: [
                    [{ text: 'Bank',         style: 'payLabel' }, { text: bankName    || '-', style: 'payValue' }],
                    [{ text: 'No. Rekening', style: 'payLabel' }, { text: accountNo   || '-', style: 'payValue', bold: true }],
                    [{ text: 'Atas Nama',    style: 'payLabel' }, { text: accountName || '-', style: 'payValue' }],
                  ],
                },
                layout: 'noBorders',
              },
            ],
            width: '*',
          },
          notes
            ? {
                stack: [
                  { text: 'CATATAN', fontSize: 7.5, bold: true, color: TEXT_MUTED, margin: [0, 0, 0, 6] },
                  { text: notes, fontSize: 8.5, color: '#34495e', italics: true },
                ],
                width: 220,
              }
            : { text: '', width: 220 },
        ],
        margin: [0, 0, 0, 30],
      },

      // Signature
      {
        columns: [
          { width: '*', text: '' },
          {
            stack: [
              { text: `${companyAddress ? companyAddress.split(',')[0] : ''}, ${docDate}`, fontSize: 8, alignment: 'center', color: TEXT_MUTED },
              { text: '\n\n\n\n', fontSize: 8 },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 0.75, lineColor: '#2c3e50' }] },
              { text: companyName || 'Nama Perusahaan', fontSize: 9, bold: true, alignment: 'center', margin: [0, 4, 0, 0] },
            ],
            width: 160,
            alignment: 'center',
          },
        ],
      },

      // Bottom accent
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 505.28, h: 4, color: ACCENT }], margin: [0, 24, 0, 0] },
    ],

    styles: {
      companyName:     { fontSize: 14, bold: true, color: PRIMARY },
      companyDetail:   { fontSize: 8.5, color: '#555', lineHeight: 1.35 },
      clientName:      { fontSize: 11, bold: true, color: '#2c3e50', margin: [0, 0, 0, 2] },
      clientDetail:    { fontSize: 8.5, color: '#555', lineHeight: 1.35 },
      metaLabel:       { fontSize: 8.5, color: TEXT_MUTED },
      metaValue:       { fontSize: 8.5, color: '#2c3e50' },
      tableHead:       { fontSize: 8.5, bold: true, color: '#ffffff' },
      tableCell:       { fontSize: 8.5, color: '#2c3e50', lineHeight: 1.3 },
      totalLabel:      { fontSize: 8.5, color: '#555' },
      totalValue:      { fontSize: 8.5, alignment: 'right', color: '#2c3e50' },
      grandTotalLabel: { fontSize: 10, bold: true },
      grandTotalValue: { fontSize: 10, bold: true, alignment: 'right' },
      payLabel:        { fontSize: 8.5, color: TEXT_MUTED },
      payValue:        { fontSize: 8.5, color: '#2c3e50' },
    },
  }
}
