'use strict'

const path = require('path')
const fs = require('fs')

/**
 * Template: Berita Acara Terminasi MDS
 *
 * Field payload.data yang diharapkan:
 * - letterNo        (string, wajib)   : Nomor surat, contoh "084/OMI-TM/BAK/III/2026"
 * - region          (string, wajib)   : Wilayah, contoh "LPB"
 * - terminateDate   (string/ISO)      : Tanggal terminasi, contoh "2026-04-01"
 * - mdsName         (string, wajib)   : Nama MDS
 * - mdsCode         (string, wajib)   : Kode MDS
 * - status          (string)          : Status MDS, contoh "STAY"
 * - outlet          (string)          : Outlet penempatan
 * - reasons         (string/array)    : Alasan terminasi; bisa string atau array string
 * - location        (string)          : Lokasi surat ditandatangani, default "Jakarta"
 * - letterDate      (string/ISO)      : Tanggal surat, default hari ini
 * - signerLeftName  (string)          : Nama penandatangan kiri
 * - signerLeftTitle (string)          : Jabatan penandatangan kiri
 * - signerRightName (string)          : Nama penandatangan kanan
 * - signerRightTitle(string)          : Jabatan penandatangan kanan
 */
module.exports = function baTerminatedTemplate(payloadData = {}) {
  const {
    letterNo = '',
    region = '',
    terminateDate = '',
    mdsName = '',
    mdsCode = '',
    status = '',
    outlet = '',
    reasons = '',
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

  const reasonsList = () => {
    if (Array.isArray(reasons)) {
      const clean = reasons.filter(Boolean).map(r => String(r).trim()).filter(Boolean)
      if (clean.length) return clean
    }
    const str = String(reasons || '').trim()
    if (!str) return []
    // Split by newline or bullet markers
    const parts = str.split(/\r?\n|\r|;|•|-/).map(s => s.trim()).filter(Boolean)
    return parts.length ? parts : [str]
  }

  const headerImage = path.join(__dirname, '..', '..', 'resources', 'images', 'header_omi.png')
  const footerImage = path.join(__dirname, '..', '..', 'resources', 'images', 'footer_omi.png')
  const signatureLeftImage = path.join(__dirname, '..', '..', 'resources', 'images', 'signature_adi.jpeg')
  const signatureRightImage = path.join(__dirname, '..', '..', 'resources', 'images', 'signature_kiki.jpeg')
  const pageWidth = 595.28
  const pageHeight = 841.89

  const pngSize = (filePath) => {
    try {
      const buf = fs.readFileSync(filePath)
      if (buf.length < 24) return null
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
    pageMargins: [50, defaultHeaderHeight + 30, 50, defaultFooterHeight + 30],
    defaultStyle: { font: 'Roboto', color: '#1f2d3d', fontSize: 11 },
    background: (currentPage, pageSize) => {
      const pw = pageSize.width || pageWidth
      const ph = pageSize.height || pageHeight
      const headerH = scaleHeight(headerImage, pw)
      const footerH = scaleHeight(footerImage, pw)
      return [
        { image: headerImage, width: pw, absolutePosition: { x: 0, y: 0 } },
        { image: footerImage, width: pw, absolutePosition: { x: 0, y: ph - footerH } },
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
          'Pemberitahuan Terminasi MDS untuk Wilayah ',
          { text: upper(region) || '-', bold: true },
          ' per tanggal ',
          { text: formatDateUpper(terminateDate), bold: true },
          ' dengan rincian sebagai berikut :'
        ],
        style: 'intro',
        margin: [0, 0, 0, 12],
      },

      {
        table: {
          widths: [190, 8, '*'],
          body: [
            detailRow('Nama MDS', upper(mdsName)),
            detailRow('Code MDS', upper(mdsCode)),
            detailRow('Status', upper(status)),
            detailRow('Outlet Penempatan', upper(outlet)),
            [
              { text: 'Alasan Terminasi', style: 'detailLabel' },
              { text: ':', width: 8, alignment: 'center', style: 'detailLabel' },
              reasonsList().length
                ? { ul: reasonsList(), style: 'detailValue', margin: [0, 2, 0, 0] }
                : { text: '-', style: 'detailValue' },
            ],
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
              { image: signatureLeftImage, width: 120, height: 60, alignment: 'center', margin: [0, 8, 0, 8] },
              { image: signatureRightImage, width: 120, height: 60, alignment: 'center', margin: [0, 8, 0, 8] },
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
