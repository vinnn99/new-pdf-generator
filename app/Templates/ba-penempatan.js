'use strict'

const path = require('path')
const fs = require('fs')

/**
 * Template: Berita Acara Penempatan MDS (Outlet)
 *
 * Field payload.data yang diharapkan:
 * - letterNo          (string, wajib)   : Nomor surat, contoh "075/OMI-TM/BAK/III/2026"
 * - region            (string, opsional): Wilayah/konteks outlet, default "Outlet Wilayah SMS"
 * - mdsName           (string, wajib)   : Nama MDS
 * - nik               (string, wajib)   : NIK MDS
 * - birthDate         (string/ISO)      : Tanggal lahir
 * - placementDate     (string/ISO)      : Tanggal penempatan
 * - status            (string)          : Status MDS, contoh "STAY"
 * - category          (string)          : Kategori MDS, contoh "BIR"
 * - outlet            (string, wajib)   : Nama outlet tujuan
 * - reason            (string)          : Alasan penempatan / catatan tambahan
 * - location          (string)          : Lokasi surat ditandatangani, default "Jakarta"
 * - letterDate        (string/ISO)      : Tanggal surat, default hari ini
 * - signerLeftName    (string)          : Nama penandatangan kiri
 * - signerLeftTitle   (string)          : Jabatan penandatangan kiri
 * - signerRightName   (string)          : Nama penandatangan kanan
 * - signerRightTitle  (string)          : Jabatan penandatangan kanan
 */
module.exports = function baPenempatanTemplate(payloadData = {}) {
  const {
    letterNo = '',
    region = 'SMS',
    mdsName = '',
    nik = '',
    birthDate = '',
    placementDate = '',
    status = '',
    category = '',
    outlet = '',
    reason = '',
    location = 'Jakarta',
    letterDate = new Date().toISOString(),
    signerLeftName = 'Adi Anto',
    signerLeftTitle = 'Team Leader TEMA Agency',
    signerRightName = 'Rizqi Arumdhita',
    signerRightTitle = 'Project Manager Tema Agency',
  } = payloadData

  const monthsUpper = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']
  const monthsTitle = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  const upper = (val) => {
    if (typeof val === 'string') return val.toUpperCase()
    if (val === null || val === undefined) return ''
    return String(val).toUpperCase()
  }

  const formatDateUpper = (val) => {
    if (!val) return '-'
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val).toUpperCase()
    return `${String(d.getDate()).padStart(2, '0')} ${monthsUpper[d.getMonth()]} ${d.getFullYear()}`
  }

  const formatDateTitle = (val) => {
    if (!val) return '-'
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return `${d.getDate()} ${monthsTitle[d.getMonth()]} ${d.getFullYear()}`
  }

  const detailRow = (label, value) => ([
    { text: label, style: 'detailLabel' },
    { text: ':', width: 8, alignment: 'center', style: 'detailLabel' },
    { text: value || '-', style: 'detailValue' },
  ])

  const headerImage = path.join(__dirname, '..', '..', 'resources', 'images', 'header_omi.png')
  const footerImage = path.join(__dirname, '..', '..', 'resources', 'images', 'footer_omi.png')
  const signatureLeftImage = path.join(__dirname, '..', '..', 'resources', 'images', 'signature_adi.jpeg')
  const signatureRightImage = path.join(__dirname, '..', '..', 'resources', 'images', 'signature_kiki.jpeg')
  const signatureLeftSource = payloadData.signatureLeftImage || payloadData.signatureLeftUrl || signatureLeftImage
  const signatureRightSource = payloadData.signatureRightImage || payloadData.signatureRightUrl || signatureRightImage
  const pageWidth = 595.28  // A4 width in points (72 DPI)
  const pageHeight = 841.89 // A4 height in points

  const pngSize = (filePath) => {
    try {
      const buf = fs.readFileSync(filePath)
      if (buf.length < 24) return null
      // PNG signature check
      if (buf.readUInt32BE(0) !== 0x89504e47) return null
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      return { width, height }
    } catch (err) {
      return null
    }
  }

  const scaleHeight = (filePath, targetWidth) => {
    const meta = pngSize(filePath)
    if (!meta || !meta.width || !meta.height) return 140
    return (targetWidth * meta.height) / meta.width
  }

  const defaultHeaderHeight = scaleHeight(headerImage, pageWidth)
  const defaultFooterHeight = scaleHeight(footerImage, pageWidth)

  return {
    pageSize: 'A4',
    pageMargins: [50, defaultHeaderHeight + 30, 50, defaultFooterHeight + 30], // disesuaikan agar konten aman
    defaultStyle: { font: 'Roboto', color: '#1f2d3d', fontSize: 11 },
    background: (currentPage, pageSize) => {
      const pw = pageSize.width || pageWidth
      const ph = pageSize.height || pageHeight
      const headerH = scaleHeight(headerImage, pw)
      const footerH = scaleHeight(footerImage, pw)
      return [
        {
          image: headerImage,
          width: pw,
          absolutePosition: { x: 0, y: 0 },
        },
        {
          image: footerImage,
          width: pw,
          absolutePosition: {
            x: 0,
            y: ph - footerH,
          },
        },
      ]
    },
    content: [
      {
        stack: [
          { text: 'BERITA ACARA', style: 'title', alignment: 'center' },
          letterNo ? { text: letterNo, style: 'letterNo', alignment: 'center', margin: [0, 4, 0, 0] } : {},
        ],
        margin: [0, 0, 0, 16],
      },

      {
        text: [
          'Pemberitahuan Penempatan MDS untuk Outlet Wilayah ',
          { text: upper(region) || '-', bold: true },
          ' : '
        ],
        style: 'intro',
        margin: [0, 0, 0, 12],
      },

      {
        table: {
          widths: [180, 8, '*'],
          body: [
            detailRow('Nama MDS', upper(mdsName)),
            detailRow('NIK', nik),
            detailRow('Tanggal Lahir', formatDateUpper(birthDate)),
            detailRow('Tanggal Penempatan', formatDateUpper(placementDate)),
            detailRow('Wilayah', upper(region)),
            detailRow('Status', upper(status)),
            detailRow('Kategori MDS', upper(category)),
            detailRow('Ke Outlet', upper(outlet)),
            detailRow('Alasan Penempatan', reason || '-'),
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 12],
      },

      {
        text: 'Demikian Berita Acara ini kami sampaikan, atas perhatian dan kerja samanya kami ucapkan terima kasih.',
        style: 'paragraph',
        margin: [0, 8, 0, 24],
      },

      {
        columns: [
          { width: '50%', text: '' },
          {
            width: '50%',
            text: `${location}, ${formatDateTitle(letterDate)}`,
            alignment: 'center',
            style: 'detailValue',
          },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 30],
      },

      {
        columns: [
          { width: '50%', text: '' },
          {
            width: '50%',
            text: 'Hormat Kami,',
            alignment: 'center',
            style: 'paragraph',
          },
        ],
        columnGap: 40,
        margin: [0, 0, 0, 8]
      },

      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              signatureCell(signatureLeftSource),
              signatureCell(signatureRightSource),
            ],
            [
              { text: signerLeftName, style: 'signName', alignment: 'center' },
              { text: signerRightName, style: 'signName', alignment: 'center' },
            ],
            [
              { text: signerLeftTitle, style: 'signTitle', alignment: 'center' },
              { text: signerRightTitle, style: 'signTitle', alignment: 'center' },
            ],
          ],
        },
        layout: 'noBorders',
      },
    ],

    styles: {
      title: { fontSize: 18, bold: true, color: '#000000', letterSpacing: 0.5 },
      letterNo: { fontSize: 11, color: '#4a4a4a' },
      intro: { fontSize: 11, bold: true, color: '#1f2d3d' },
      detailLabel: { fontSize: 11, bold: true },
      detailValue: { fontSize: 11 },
      paragraph: { fontSize: 11, alignment: 'justify', lineHeight: 1.3 },
      signName: { fontSize: 11, bold: true, decoration: 'underline' },
      signTitle: { fontSize: 10, color: '#4a4a4a' },
    },
  }
}

function signatureCell(source) {
  if (source) {
    return { image: source, width: 120, height: 60, alignment: 'center', margin: [0, 8, 0, 8] }
  }
  return { text: '', margin: [0, 24, 0, 24] }
}
