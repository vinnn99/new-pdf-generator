'use strict'

module.exports = require('../../app/Templates/invoice')

// ─── Legacy stub kept for reference only (not used) ───────────────────────────
const _legacy = (payloadData) => {
  const {
    invoiceNumber = 'INV-001',
    invoiceDate = new Date().toLocaleDateString(),
    dueDate = new Date().toLocaleDateString(),
    clientName = 'Client Name',
    clientEmail = 'client@example.com',
    clientAddress = 'Client Address',
    items = [
      { description: 'Item 1', quantity: 1, unitPrice: 100, total: 100 }
    ],
    subtotal = 100,
    tax = 10,
    total = 110,
    companyName = 'Your Company',
    companyEmail = 'info@company.com'
  } = payloadData

  // Calculate items if not provided
  const processedItems = items.map(item => [
    item.description,
    item.quantity.toString(),
    'Rp ' + item.unitPrice.toLocaleString('id-ID'),
    'Rp ' + item.total.toLocaleString('id-ID')
  ])

  // Add total row
  processedItems.push([
    { text: 'TOTAL', bold: true, colSpan: 3, alignment: 'right' },
    {},
    {},
    { text: 'Rp ' + total.toLocaleString('id-ID'), bold: true, alignment: 'right' }
  ])

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: [
      // Header
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: companyName, style: 'companyName', border: [0, 0, 0, 0] },
              { text: 'INVOICE', style: 'invoiceTitle', alignment: 'right', border: [0, 0, 0, 0] }
            ]
          ]
        },
        margin: [0, 0, 0, 20]
      },

      // Company Info
      {
        text: `Email: ${companyEmail}`,
        style: 'companyInfo',
        margin: [0, 0, 0, 20]
      },

      // Invoice Details
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                table: {
                  body: [
                    [{ text: 'Invoice Number:', bold: true }, invoiceNumber],
                    [{ text: 'Invoice Date:', bold: true }, invoiceDate],
                    [{ text: 'Due Date:', bold: true }, dueDate]
                  ]
                },
                border: [0, 0, 0, 0]
              },
              {
                table: {
                  body: [
                    [{ text: 'Bill To:', bold: true, colSpan: 2 }, {}],
                    [clientName, ''],
                    [clientEmail, ''],
                    [clientAddress, '']
                  ]
                },
                border: [0, 0, 0, 0]
              }
            ]
          ]
        },
        margin: [0, 0, 0, 30]
      },

      // Items Table
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 120, 120],
          body: [
            [
              { text: 'Description', style: 'tableHeader' },
              { text: 'Qty', style: 'tableHeader', alignment: 'center' },
              { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
              { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...processedItems
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#d5d5d5',
          vLineColor: () => '#d5d5d5',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 20]
      },

      // Summary
      {
        table: {
          widths: ['*', 150],
          body: [
            [
              { text: 'Subtotal:', alignment: 'right', border: [0, 0, 0, 0] },
              { text: 'Rp ' + subtotal.toLocaleString('id-ID'), alignment: 'right', border: [0, 0, 0, 0] }
            ],
            [
              { text: 'Tax (10%):', alignment: 'right', border: [0, 0, 0, 0] },
              { text: 'Rp ' + tax.toLocaleString('id-ID'), alignment: 'right', border: [0, 0, 0, 0] }
            ],
            [
              { text: 'TOTAL:', bold: true, alignment: 'right', border: [0, 1, 0, 1], borderColor: '#000' },
              { text: 'Rp ' + total.toLocaleString('id-ID'), bold: true, alignment: 'right', border: [0, 1, 0, 1], borderColor: '#000' }
            ]
          ]
        },
        margin: [0, 0, 0, 40]
      },

      // Terms
      {
        text: 'Thank you for your business!',
        style: 'footer',
        alignment: 'center'
      }
    ],

    styles: {
      companyName: {
        fontSize: 20,
        bold: true,
        color: '#2c3e50'
      },
      invoiceTitle: {
        fontSize: 24,
        bold: true,
        color: '#3498db'
      },
      companyInfo: {
        fontSize: 10,
        color: '#666'
      },
      tableHeader: {
        background: '#3498db',
        color: 'white',
        bold: true,
        fontSize: 11
      },
      footer: {
        fontSize: 10,
        color: '#999',
        italics: true
      }
    },

    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10
    }
  }
}
