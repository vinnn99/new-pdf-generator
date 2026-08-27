'use strict'

const path = require('path')
const fs = require('fs')
const NumberFormatService = use('App/Services/NumberFormatService')
const CooperationAgreementService = use('App/Services/CooperationAgreementService')

const NUMERIC_LIST_LEVELS = Object.freeze({
  1: { marginLeft: 0, numberWidth: 20 },
  2: { marginLeft: 18, numberWidth: 34 },
  3: { marginLeft: 52, numberWidth: 44 }
})
const INDENTED_CONTENT_MARGIN_LEFT = contentMarginForNumber('1.1')

module.exports = function cooperationAgreementTemplate(payloadData = {}) {
  const data = CooperationAgreementService.normalizeData(payloadData)
  const companyName = val(data.companyName, CooperationAgreementService.DEFAULT_COMPANY_NAME)
  const partnerName = val(data.partnerName)
  const firstPartyName = val(data.firstPartyName)
  const firstPartyTitle = val(data.firstPartyTitle)
  const styleText = createTextStyler(companyName)
  const letterDate = data.letterDate || data.agreementDate || new Date().toISOString()
  const brand = val(data.brand)
  const agreementDuration = NumberFormatService.formatNumberWithWords(data.agreementDuration, {
    unit: 'bulan',
    fieldName: 'lama perjanjian'
  })
  const workHoursPerDay = NumberFormatService.formatNumberWithWords(data.workHoursPerDay, {
    unit: 'jam',
    suffix: 'per hari',
    fieldName: 'jam kerja per hari'
  })
  const paymentItems = requirementPaymentItems(data, companyName)

  const directorSignature = firstRenderableImage(
    data.directorSignatureImage,
    data.signatureLeftImage,
    data.directorSignatureUrl,
    data.signatureLeftUrl
  )
  const partnerSignature = firstRenderableImage(
    data.partnerSignatureImage,
    data.signatureRightImage,
    data.partnerSignatureUrl,
    data.signatureRightUrl
  )
  const defaultLogo = path.join(__dirname, '..', '..', 'resources', 'images', 'origin-magna-inovasi.png')
  const logoImage = firstRenderableImage(
    data.logoImage,
    data.companyLogoImage,
    data.logoUrl,
    data.companyLogoUrl,
    data.logoPath,
    data.companyLogoPath,
    defaultLogo
  )

  const footerImage = path.join(__dirname, '..', '..', 'resources', 'images', 'footer_omi.png')
  const hasFooter = fs.existsSync(footerImage)
  const pageWidth = 595.28
  const pageHeight = 841.89

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [54, 88, 54, 78],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#111111', lineHeight: 1.18 },
    pageBreakBefore: keepArticleHeadingWithOpeningContent,
    background: (_currentPage, pageSize) => {
      const pw = pageSize.width || pageWidth
      const ph = pageSize.height || pageHeight
      const footerH = hasFooter ? 48 : 0
      const logoWidth = 190
      const background = logoImage
        ? [{
            image: logoImage,
            width: logoWidth,
            absolutePosition: { x: pw - 54 - logoWidth, y: 28 }
          }]
        : [{
          text: 'ORIGIN MAGDA INOVASI',
          width: logoWidth,
          alignment: 'right',
          absolutePosition: { x: pw - 54 - logoWidth, y: 30 },
          color: '#00a6a6',
          bold: true,
          fontSize: 15,
          characterSpacing: 0.8
        }]
      background.push(
        {
          canvas: [
            { type: 'line', x1: 54, y1: 58, x2: pw - 54, y2: 58, lineWidth: 1.2, lineColor: '#00a6a6' }
          ]
        }
      )
      if (hasFooter) {
        background.push({
          image: footerImage,
          width: pw,
          absolutePosition: { x: 0, y: ph - footerH }
        })
      }
      return background
    },
    content: [
      { text: 'PERJANJIAN KERJASAMA KEMITRAAN', style: 'title' },
      { text: 'ANTARA', style: 'titleSmall' },
      { text: upper(companyName), style: 'titleSmall' },
      { text: 'DENGAN', style: 'titleSmall' },
      { text: upper(partnerName), style: 'titleSmall' },
      { text: `Nomor: ${val(data.letterNo, '-')}`, style: 'letterNo' },
      p(`Perjanjian Kerjasama Kemitraan ("Perjanjian") ini dibuat pada tanggal ${formatDateLong(letterDate)} oleh dan antara:`),
      partyBlock('I.', [
        ['Nama', firstPartyName],
        ['Jabatan', firstPartyTitle],
        ['Perusahaan', [
          { text: companyName },
          { text: ' / TEMA Agency', bold: true }
        ]]
      ]),
      p(`Dalam hal ini bertindak mewakili secara sah untuk dan atas nama ${upper(companyName)}, yang selanjutnya disebut sebagai "${upper(companyName)}".`),
      partyBlock('II.', [
        ['Nama', partnerName],
        ['Warga Negara', val(data.partnerNationality)],
        ['No. KTP/SIM', val(data.partnerIdentityNumber)],
        ['Tempat, Tgl. Lahir', `${val(data.partnerBirthPlace)}, ${formatDateLong(data.partnerBirthDate)}`],
        ['Alamat', val(data.partnerAddress)],
        ['Telepon/HP', val(data.partnerPhone)],
        ['Email', val(data.partnerEmail)]
      ]),
      p('Dalam hal ini bertindak untuk selanjutnya disebut "MITRA".'),
      p(`Bahwa ${upper(companyName)} dan MITRA secara bersama-sama disebut "Para Pihak".`),
      p('Bahwa Para Pihak terlebih dahulu mengemukakan hal-hal, sebagai berikut:'),
      numbered([
        `Bahwa ${upper(companyName)} adalah badan hukum perseroan terbatas yang bergerak dalam bidang usaha produk dan servis, antara lain di bidang informasi teknologi atau sistem informasi yang berhubungan dengan kegiatan Agency, jasa penyedia tenaga kerja seperti Sales Promotion Girl (SPG), Sales Promotion Boy (SPB), dan penyedia pekerja alih daya (Outsourcing).`,
        'Bahwa MITRA adalah perorangan yang memberikan kemampuan pengetahuan dan jasa untuk melaksanakan kerja sama kemitraan sebagaimana dimaksud dalam Perjanjian ini.',
        `Bahwa MITRA adalah perorangan yang akan ditempatkan sesuai dengan kebutuhan dari pihak PRINCIPAL dan/atau BRAND yang sedang menjalankan program dengan ${upper(companyName)} dan/atau TEMA AGENCY.`,
        `Bahwa Para Pihak telah sepakat menjalin kerja sama kemitraan yang bermanfaat. Pelaksanaan Perjanjian ini tidak menciptakan hubungan ketenagakerjaan di antara ${upper(companyName)} dengan MITRA.`
      ]),
      article('Pasal 1', 'KETENTUAN UMUM', numbered([
        'Para Pihak sepakat untuk melakukan kerja sama yang bersifat kemitraan selama masa waktu yang telah ditentukan dalam Perjanjian ini.',
        'Perjanjian ini dilaksanakan dengan itikad baik oleh Para Pihak guna keberhasilan dan mencapai tujuan bersama yang secara khusus disepakati pada Perjanjian ini.',
        'Para Pihak sepakat untuk melakukan tujuan kemitraan dalam rangka pelaksanaan Brand "TEMA Agency".'
      ])),
      article('Pasal 2', 'PERSYARATAN KEMITRAAN', [
        ...numbered([
          `MITRA menjalankan kemitraan bersama dengan ${upper(companyName)} pada BRAND ${brand}.`,
          `Bahwa ${upper(companyName)} dan MITRA secara bersama-sama berkewajiban membina hubungan kemitraan yang harmonis dengan mitra lainnya agar tercipta hubungan kemitraan dan ketenangan usaha bisnis dengan sebaik-baiknya dengan penuh tanggung jawab serta memperhatikan petunjuk pimpinan atau ketentuan yang ada di dalam ${upper(companyName)}, dengan sebagai berikut:`
        ]),
        lettered([
          `MITRA wajib menjaga nama baik ${upper(companyName)} dengan penuh tanggung jawab;`,
          `Dapat menyimpan rahasia dan dokumen-dokumen serta data-data yang dianggap rahasia bagi ${upper(companyName)};`,
          `Harus menghindari diri dalam perbuatan pemborosan dan tindakan-tindakan yang merugikan ${upper(companyName)};`,
          `Dilarang memanfaatkan kemitraan untuk memanipulasi pembayaran, melaksanakan hubungan kemitraan di luar kepentingan ${upper(companyName)} untuk kepentingan pribadi dengan pihak ketiga lainnya; dan`,
          `MITRA wajib menaati tata tertib lainnya sesuai dengan operasional ${upper(companyName)} yang berlaku dan ketentuan lainnya yang dikeluarkan oleh pimpinan ${upper(companyName)}.`
        ]),
        ...numbered(['Dalam Perjanjian ini MITRA bersepakat dan menyetujui beberapa persyaratan, yakni sebagai berikut:'], 3),
        indented(paymentItems.beforeBankTable),
        tableRows([
          ['Nomor Rekening MITRA', val(data.partnerBankAccountNumber)],
          ['Nama Rekening MITRA', val(data.partnerBankAccountName)],
          ['Nama Bank', val(data.partnerBankName)]
        ], [170, '*'], { marginLeft: INDENTED_CONTENT_MARGIN_LEFT }),
        indented(paymentItems.afterBankTable),
        ...numbered(['Dalam Perjanjian ini MITRA bersedia untuk melaksanakan kewajiban-kewajiban yakni sebagai berikut:'], 4),
        indented([
          `4.1 Menaati segala peraturan dan/atau tata tertib yang diberikan oleh ${upper(companyName)} selama Masa Waktu Perjanjian ini berlaku.`,
          `4.2 Merahasiakan semua informasi mengenai ${upper(companyName)} yang diterima atau diketahui olehnya selama berlakunya Masa Waktu Perjanjian maupun setelah Perjanjian ini berakhir.`,
          `4.3 Menyerahkan semua informasi mengenai ${upper(companyName)} yang diterima atau diketahui olehnya, termasuk semua informasi maupun data dalam bentuk hard copy, soft copy, email, disket, CD, USB maupun media lainnya kepada pimpinan ${upper(companyName)}.`,
          `4.4 MITRA wajib memelihara dan menggunakan dengan penuh tanggung jawab alat-alat pendukung kemitraan serta inventaris ${upper(companyName)}.`,
          `4.5 Dalam menggunakan alat-alat kerja, MITRA harus mengindahkan petunjuk yang diarahkan oleh pimpinan unit atau pimpinan ${upper(companyName)}.`,
          '4.6 Apabila Masa Waktu Perjanjian selesai dan tidak diperpanjang, atau terjadi pemutusan hubungan kemitraan sebelum berakhirnya Perjanjian, MITRA wajib mengembalikan semua alat inventaris dalam keadaan baik dan terpelihara.'
        ])
      ]),
      article('PASAL 3', 'MASA WAKTU PERJANJIAN DAN LOKASI KEMITRAAN', numbered([
        `Perjanjian ini berlaku selama ${agreementDuration} dan terhitung efektif sejak tanggal ditandatangani Perjanjian ("Masa Waktu Perjanjian") sesuai dengan jadwal kerja yang sudah ditetapkan dengan perhitungan ${workHoursPerDay}.`,
        `Para Pihak sepakat melaksanakan kemitraan di area wilayah ${val(data.placementArea)} selama Masa Waktu Perjanjian ("Lokasi Kemitraan").`,
        'MITRA bersedia untuk melaksanakan kemitraan apabila ada perubahan Lokasi Kemitraan.',
        `Apabila diperlukan perpanjangan Masa Waktu Perjanjian, Para Pihak dapat melakukan Adendum Perjanjian sesuai kebutuhan ${upper(companyName)} yang akan ditentukan kemudian hari.`,
        `Apabila Masa Waktu Perjanjian telah selesai, maka hubungan kemitraan antara ${upper(companyName)} dengan MITRA dianggap berakhir tanpa kewajiban ${upper(companyName)} untuk memberikan uang pisah dan/atau pesangon, uang jasa, atau ganti kerugian lainnya kepada MITRA.`,
        `Apabila dalam Masa Waktu Perjanjian MITRA mengundurkan diri, MITRA wajib memberikan pemberitahuan tertulis lebih dahulu kepada ${upper(companyName)} dan memenuhi ketentuan ganti rugi sampai batas waktu Perjanjian berakhir sesuai ketentuan ${upper(companyName)}.`,
        `${upper(companyName)} dapat sewaktu-waktu mengakhiri Perjanjian ini secara sepihak apabila terbukti MITRA tidak bertanggung jawab atau tidak mematuhi ketentuan Perjanjian.`
      ])),
      article('Pasal 4', 'SAKIT DAN PERIJINAN LAINNYA', numbered([
        'MITRA yang tidak masuk kerja karena sakit wajib menyertakan dan/atau memberitahukan Surat Keterangan Dokter. Apabila tidak melampirkan Surat Keterangan Dokter maka dianggap mangkir.',
        'MITRA yang tidak masuk kerja karena izin wajib mendapatkan persetujuan dari supervisor. Apabila tidak ada persetujuan maka dianggap mangkir.'
      ])),
      article('Pasal 5', 'HAK KEKAYAAN INTELEKTUAL', numbered([
        `${upper(companyName)} tidak bertanggung jawab untuk memastikan materi yang digunakan dalam pelaksanaan Perjanjian ini tidak melanggar hak cipta dan/atau hak kekayaan intelektual pihak lain.`,
        `Apabila MITRA melakukan pelanggaran, maka MITRA bertanggung jawab penuh atas pelanggaran tersebut dan bersedia melepaskan ${upper(companyName)} dari semua tuntutan, klaim, tindakan, pertanggungjawaban, dan kerugian yang diajukan pihak lain.`,
        `${upper(companyName)} tidak dikenakan ganti rugi baik berupa materi dari pihak lain maupun pihak ketiga dalam Masa Waktu Perjanjian yang diakibatkan oleh MITRA.`
      ])),
      article('Pasal 6', 'BERAKHIRNYA KEMITRAAN', numbered([
        `Perjanjian ini berakhir ketika program dengan PRINCIPAL dan/atau BRAND berakhir dan dengan berakhirnya Perjanjian tersebut maka segala hak dan kewajiban MITRA kepada ${upper(companyName)} akan berakhir pada tanggal berakhirnya Perjanjian ini.`,
        `MITRA mendapatkan teguran sebanyak tiga (3) kali berturut - turut dan/atau telah melakukan pelanggaran berulang terhadap kepatuhan dan pelaksanaan pekerjaan yang mengakibatkan hasil evaluasi kinerja tidak baik. Maka Perjanjian ini dapat berkahir sebelum tenggat waktu.`,
        'Sehubungan dengan pengakhiran Perjanjian ini, Para Pihak sepakat mengesampingkan keberlakuan ketentuan Pasal 1266 KUHPerdata sepanjang mengenai keharusan adanya putusan Pengadilan untuk mengakhiri Perjanjian.'
      ])),
      article('Pasal 7', 'PERPANJANGAN MASA WAKTU KEMITRAAN', numbered([
        `Apabila ${upper(companyName)} akan melakukan perpanjangan Masa Waktu Perjanjian yang disetujui oleh MITRA, maka ${upper(companyName)} harus memberitahukan kepada MITRA paling lambat 14 hari kerja sebelum Perjanjian ini berakhir.`,
        'Dalam hal Perjanjian ini tidak diperpanjang oleh Para Pihak, maka Perjanjian ini akan putus demi hukum pada tanggal yang telah disepakati.'
      ])),
      article('Pasal 8', 'PENYELESAIAN PERSELISIHAN', numbered([
        'Bila terjadi perselisihan antara Para Pihak dalam melaksanakan Perjanjian ini, maka Para Pihak sepakat mengusahakan untuk bertemu, berdiskusi, dan bernegosiasi untuk mendapatkan penyelesaian.',
        'Para Pihak diberikan kesempatan untuk menyelesaikan secara musyawarah selama 30 (tiga puluh) hari kalender sejak timbulnya perselisihan sehubungan dengan Perjanjian ini.',
        'Apabila penyelesaian tidak berhasil, maka Para Pihak sepakat menyelesaikan perselisihan melalui Badan Arbitrase Nasional Indonesia (BANI) di Jakarta dengan menggunakan Prosedur BANI dan menunjuk Arbiter Tunggal.'
      ])),
      article('Pasal 9', 'SANKSI, MANGKIR DAN DENDA', numbered([
        `${upper(companyName)} berwenang memberikan teguran atau peringatan baik lisan maupun tulisan kepada MITRA apabila MITRA tidak memenuhi kewajiban-kewajiban dalam Perjanjian ini.`,
        `Sesuai dengan ketentuan mekanisme program yang berlaku, PT Origin Magda Inovasi berwenang untuk melakukan pemotongan terhadap biaya upah bulanan dan/atau insentif (jikalau ada).`
      ])),
      article('Pasal 10', 'PEMBERITAHUAN KORESPONDENSI', [
        ...numbered(['Setiap pemberitahuan yang timbul sehubungan dengan Perjanjian ini disampaikan secara tertulis dengan tanda terima dan/atau email kepada alamat berikut:']),
        correspondenceBlock(upper(companyName), [
          ['PIC', val(data.picName)],
          ['Jabatan', val(data.picTitle)],
          ['Email', val(data.picEmail)],
          ['Alamat', val(data.picAddress)]
        ]),
        correspondenceBlock('MITRA', [
          ['Nama', partnerName],
          ['Nomor KTP', val(data.partnerIdentityNumber)],
          ['Email', val(data.partnerEmail)],
          ['Alamat', val(data.partnerAddress)]
        ]),
        ...numbered([
          'Setiap perubahan informasi korespondensi wajib diberitahukan kepada masing-masing pihak secara tertulis selambat-lambatnya 14 (empat belas) hari kerja sejak perubahan tersebut dilakukan.',
          'Segala risiko yang timbul akibat perubahan korespondensi yang tidak diberitahukan secara tertulis menjadi tanggung jawab masing-masing pihak yang melakukan perubahan.'
        ], 2)
      ]),
      article('Pasal 11', 'WANPRESTASI (INGKAR JANJI)', numbered([
        'MITRA dinyatakan atau dianggap telah wanprestasi terhadap Perjanjian ini apabila tidak memenuhi sebagian atau seluruh kewajibannya sebagaimana diatur dalam Perjanjian ini.',
        'Pernyataan bahwa MITRA telah berada dalam keadaan wanprestasi cukup dibuktikan melalui surat pemberitahuan, surat teguran, atau surat peringatan resmi dan tertulis.'
      ])),
      article('Pasal 12', 'FORCE MAJEURE (KEADAAN KAHAR)', [
        ...numbered([
          'Jika terjadi keadaan Force Majeure, termasuk namun tidak terbatas pada gempa bumi, angin puyuh, tanah longsor, banjir, kebakaran, ledakan, bencana alam, perang, kerusuhan, terorisme, sabotase, embargo, mogok kerja massal, perubahan drastis politik dan ekonomi, epidemi, pandemi, atau peraturan baru yang mempengaruhi pelaksanaan Perjanjian ini, maka Para Pihak wajib:'
        ]),
        lettered([
          'Memberitahukan secara tertulis selambat-lambatnya 3 (tiga) hari kerja dan berusaha memulihkan kemampuannya dalam waktu sesingkat-singkatnya;',
          'Melakukan perundingan untuk menemukan solusi apabila keadaan Force Majeure berlangsung sampai menimbulkan halangan dan/atau keterlambatan dalam pelaksanaan Perjanjian selama 14 (empat belas) hari kerja;',
          'Membuat Adendum Perjanjian apabila ditemukan solusi penyelesaian oleh Para Pihak.'
        ]),
        ...numbered([
          'Dalam hal Perjanjian tidak dapat dilaksanakan karena Force Majeure, maka akibat yang timbul menjadi tanggung jawab masing-masing Pihak.',
          'Masing-masing Pihak yang terkena dampak Force Majeure harus memberikan laporan secara tertulis kepada Pihak lainnya atas ketidakmampuannya memenuhi kewajiban.'
        ], 2)
      ]),
      article('Pasal 13', 'LAIN-LAIN', numbered([
        'Hal-hal yang belum tercantum di dalam Perjanjian ini akan diatur kemudian dan dituangkan ke dalam Adendum yang disepakati oleh Para Pihak.',
        'Para Pihak sepakat bahwa Perjanjian ini menjadi keseluruhan kesepakatan di antara Para Pihak dan menggantikan seluruh perjanjian, kesepakatan, dan pernyataan sebelumnya baik lisan maupun tulisan.',
        'Ketentuan dalam Perjanjian ini yang berkaitan dengan kekayaan intelektual, kerahasiaan, ganti rugi atas pengakhiran atau berakhirnya Perjanjian ini akan tetap berlaku walau Perjanjian ini berakhir atau diakhiri.',
        'Perjanjian ini dapat ditandatangani dalam sejumlah salinan dan disampaikan dengan transmisi faksimile atau lainnya. Lampiran-lampiran dalam Perjanjian ini merupakan satu kesatuan yang tidak terpisahkan.'
      ])),
      {
        
        stack: [
          unbreakableParagraph('Demikianlah Perjanjian ini dibuat oleh Para Pihak dalam keadaan bermeterai cukup dan 2 (dua) rangkap. Para Pihak saat menandatangani Perjanjian ini dalam keadaan sehat jasmani dan rohani tanpa adanya paksaan ataupun tekanan dari pihak mana pun.'),
          signatureSection({
            companyName,
            partnerName,
            firstPartyName,
            firstPartyTitle,
            directorSignature,
            partnerSignature
          })
        ]
      }
    ],
    styles: {
      title: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
      titleSmall: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 1, 0, 1] },
      letterNo: { fontSize: 10.5, alignment: 'center', margin: [0, 6, 0, 14] },
      paragraph: { margin: [0, 0, 0, 7], alignment: 'justify' },
      articleNo: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 10, 0, 2] },
      articleTitle: { fontSize: 11.5, bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
      label: { bold: true },
      tableCell: { margin: [0, 2, 0, 2] }
    }
  }

  return stylizeDocDefinition(docDefinition, styleText)
}

function val(value, fallback = '-') {
  if (value === undefined || value === null) return fallback
  const str = String(value).trim()
  return str || fallback
}

function upper(value) {
  return val(value, '').toUpperCase()
}

function p(text) {
  return { text, style: 'paragraph' }
}

function unbreakableParagraph(text) {
  return {
    unbreakable: true,
    stack: [p(text)]
  }
}

function requirementPaymentItems(data, companyName) {
  const beforeBankTable = [
    `3.1 Dalam melakukan kemitraan ini, MITRA berhak mendapat nilai upah dasar dari ${upper(companyName)} sebesar ${NumberFormatService.formatRupiahWithWords(data.salary, 'salary/gaji')}, sesuai dengan UMP 2026, tidak termasuk pajak untuk setiap bulannya.`,
    '3.2 Para Pihak sepakat tidak mengubah pasal tersebut di atas selama Masa Waktu Perjanjian ini masih berlaku.'
  ]
  const allowanceItems = activeAllowanceItems(data)
  let nextSubNumber = 3

  if (allowanceItems.length) {
    const allowanceNumber = `3.${nextSubNumber}`
    beforeBankTable.push(`${allowanceNumber} MITRA sepakat mendapatkan upah dengan tunjangan sebagai berikut:`)
    allowanceItems.forEach((item, index) => {
      beforeBankTable.push(`${allowanceNumber}.${index + 1} ${item.label} sebesar ${formatAllowanceAmount(item)}.`)
    })
    beforeBankTable.push(continuationOf(allowanceNumber, `Seluruh pembayaran tersebut dilakukan setiap bulan dan dapat dilakukan pemotongan oleh ${upper(companyName)} untuk BPJS Ketenagakerjaan sesuai dengan aturan yang berlaku, jika MITRA mendapatkan Tunjangan BPJS dari pihak Principal dan/atau Brand.`))
    nextSubNumber += 1
  }

  beforeBankTable.push(`3.${nextSubNumber} Para Pihak sepakat seluruh pembayaran atas gaji hanya dengan menggunakan mata uang rupiah dan dilakukan melalui transfer antar rekening yang telah ditentukan dalam Perjanjian, yakni sebagai berikut:`)

  return {
    beforeBankTable,
    afterBankTable: [
      `3.${nextSubNumber + 1} MITRA berhak mendapatkan upah yang dimaksud pasal di atas pada tanggal yang sudah disepakati.`,
      `3.${nextSubNumber + 2} MITRA melaksanakan kemitraan sesuai jasa keterampilan yang dimiliki secara patuh dan efisien.`
    ]
  }
}

function activeAllowanceItems(data) {
  return [
    { label: 'Tunjangan transport', amount: allowanceAmount(data.transportAllowance, 'tunjangan transport'), fieldName: 'tunjangan transport', unit: data.transportAllowanceUnit },
    { label: 'Tunjangan makan', amount: allowanceAmount(data.mealAllowance, 'tunjangan makan'), fieldName: 'tunjangan makan', unit: data.mealAllowanceUnit },
    { label: 'Tunjangan pulsa', amount: allowanceAmount(data.phoneAllowance, 'tunjangan pulsa'), fieldName: 'tunjangan pulsa', unit: data.phoneAllowanceUnit },
    { label: 'Tunjangan biaya operasional', amount: allowanceAmount(data.operationalCostAllowance, 'tunjangan biaya operasional'), fieldName: 'tunjangan biaya operasional', unit: data.operationalCostAllowanceUnit },
    { label: 'Tunjangan TL', amount: allowanceAmount(data.tlAllowance, 'tunjangan TL'), fieldName: 'tunjangan TL', unit: data.tlAllowanceUnit }
  ].filter((item) => item.amount > 0)
}

function formatAllowanceAmount(item) {
  const amount = NumberFormatService.formatRupiahWithWords(item.amount, item.fieldName)
  const unit = allowanceUnitSuffix(item.unit)
  return unit ? `${amount} ${unit}` : amount
}

function allowanceUnitSuffix(value) {
  const unit = String(value || '').trim().replace(/\s+/g, ' ')
  if (!unit) return ''
  return /^per\s+/i.test(unit) ? unit : `per ${unit}`
}

function allowanceAmount(value, fieldName) {
  if (value === undefined || value === null) return 0
  if (typeof value === 'string' && !value.trim()) return 0
  return NumberFormatService.parseInteger(value, { fieldName })
}

function continuationOf(number, text) {
  return { continuationOf: number, text }
}

function partyBlock(prefix, rows) {
  return {
    columns: [
      { width: 24, text: prefix, bold: true },
      {
        width: '*',
        table: {
          widths: [110, 10, '*'],
          body: rows.map(([label, value]) => [
            { text: label, style: 'tableCell' },
            { text: ':', style: 'tableCell' },
            { text: Array.isArray(value) ? value : val(value), style: 'tableCell' }
          ])
        },
        layout: 'noBorders'
      }
    ],
    margin: [0, 0, 0, 6]
  }
}

function numbered(items, start = 1) {
  return items.map((text, idx) => numberedItem(`${idx + start}`, text))
}

function lettered(items) {
  return items.map((text, idx) => ({
    columns: [
      { width: 36, text: `${String.fromCharCode(97 + idx)}.`, alignment: 'right', margin: [0, 0, 8, 0] },
      { width: '*', text, alignment: 'justify' }
    ],
    margin: [0, 0, 0, 5]
  }))
}

function indented(items) {
  let previousNumber = ''

  return items.map((value) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.continuationOf) {
      previousNumber = normalizeListNumber(value.continuationOf)
      return {
        text: value.text,
        margin: [contentMarginForNumber(previousNumber), 0, 0, 6],
        alignment: 'justify'
      }
    }

    const text = String(value)
    const match = text.match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/)

    if (match) {
      previousNumber = match[1]
      return numberedItem(match[1], match[2])
    }

    return {
      text,
      margin: [previousNumber ? contentMarginForNumber(previousNumber) : INDENTED_CONTENT_MARGIN_LEFT, 0, 0, 6],
      alignment: 'justify'
    }
  })
}

function numberedItem(number, text) {
  const layout = numericListLayout(number)

  return {
    columns: [
      { width: layout.numberWidth, text: displayListNumber(number) },
      { width: '*', text, alignment: 'justify' }
    ],
    margin: [layout.marginLeft, 0, 0, 6]
  }
}

function numericListLayout(number) {
  return NUMERIC_LIST_LEVELS[numericListLevel(number)] || NUMERIC_LIST_LEVELS[3]
}

function numericListLevel(number) {
  const normalized = normalizeListNumber(number)
  if (!normalized) return 1
  return Math.min(normalized.split('.').length, 3)
}

function normalizeListNumber(number) {
  return String(number || '').trim().replace(/\.$/, '')
}

function displayListNumber(number) {
  const normalized = normalizeListNumber(number)
  const level = numericListLevel(normalized)
  if (!normalized) return ''
  return level <= 2 ? `${normalized}.` : normalized
}

function contentMarginForNumber(number) {
  const layout = numericListLayout(number)
  return layout.marginLeft + layout.numberWidth
}

function article(no, title, body) {
  const id = articleId(no)
  const bodyItems = Array.isArray(body) ? body : [body]

  return {
    stack: [
      { id: `article-heading-${id}`, text: no, style: 'articleNo', headlineLevel: 1 },
      { id: `article-title-${id}`, text: title, style: 'articleTitle', headlineLevel: 2 },
      ...markArticleOpeningContent(bodyItems, id)
    ]
  }
}

function markArticleOpeningContent(bodyItems, id) {
  return bodyItems.map((item, index) => {
    if (index !== 0 || !item || typeof item !== 'object' || Array.isArray(item)) return item
    return { ...item, id: `article-body-${id}` }
  })
}

function keepArticleHeadingWithOpeningContent(currentNode, followingNodesOnPage) {
  if (!currentNode || currentNode.headlineLevel !== 1) return false

  const nodeId = String(currentNode.id || '')
  if (!nodeId.startsWith('article-heading-')) return false

  const id = nodeId.replace('article-heading-', '')
  const following = Array.isArray(followingNodesOnPage) ? followingNodesOnPage : []
  const hasTitleOnPage = following.some((node) => node && node.id === `article-title-${id}`)
  const hasOpeningContentOnPage = following.some((node) => node && node.id === `article-body-${id}`)
  const verticalRatio = currentNode.startPosition && currentNode.startPosition.verticalRatio

  if (typeof verticalRatio === 'number' && verticalRatio > 0.82) return true
  return !hasTitleOnPage || !hasOpeningContentOnPage
}

function articleId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section'
}

function tableRows(rows, widths, options = {}) {
  const marginLeft = options.marginLeft === undefined ? 20 : options.marginLeft

  return {
    table: {
      widths,
      body: rows.map(([label, value]) => [
        { text: label, style: label === upper(label) && !value ? ['tableCell', 'label'] : 'tableCell' },
        { text: value ? `: ${value}` : '', style: 'tableCell' }
      ])
    },
    layout: 'noBorders',
    margin: [marginLeft, 0, 0, 8]
  }
}

function correspondenceBlock(title, rows) {
  return {
    unbreakable: true,
    table: {
      widths: [130, '*'],
      body: [
        [
          { text: val(title), style: ['tableCell', 'label'], colSpan: 2 },
          {}
        ],
        ...rows.map(([label, value]) => [
          { text: label, style: 'tableCell' },
          { text: `: ${val(value)}`, style: 'tableCell' }
        ])
      ]
    },
    layout: 'noBorders',
    margin: [20, 0, 0, 6]
  }
}

function signatureSection({ companyName, partnerName, firstPartyName, firstPartyTitle, directorSignature, partnerSignature }) {
  return {
    margin: [0, 24, 0, 0],
    table: {
      widths: ['50%', '50%'],
      body: [
        [
          { text: 'PIHAK PERTAMA', alignment: 'center', bold: true },
          { text: 'PIHAK KEDUA', alignment: 'center', bold: true }
        ],
        [
          { text: upper(companyName), alignment: 'center', bold: true, margin: [0, 2, 0, 8] },
          { text: 'MITRA', alignment: 'center', bold: true, margin: [0, 2, 0, 8] }
        ],
        [
          signatureCell(directorSignature),
          signatureCell(partnerSignature)
        ],
        [
          { text: `Nama : ${val(firstPartyName)}`, alignment: 'center', margin: [0, 2, 0, 0] },
          { text: `Nama : ${val(partnerName)}`, alignment: 'center', margin: [0, 2, 0, 0] }
        ],
        [
          { text: `Jabatan : ${val(firstPartyTitle)}`, alignment: 'center' },
          { text: '', alignment: 'center' }
        ]
      ]
    },
    layout: 'noBorders'
  }
}

function signatureCell(source) {
  if (source) {
    return { image: source, width: 130, height: 64, alignment: 'center', margin: [0, 6, 0, 6] }
  }
  return { text: '_______________________', alignment: 'center', margin: [0, 52, 0, 8] }
}

function firstRenderableImage(...candidates) {
  for (const item of candidates) {
    if (!item) continue
    const source = String(item)
    if (/^data:image\//i.test(source)) return source
    if (/^https?:\/\//i.test(source)) continue
    const filePath = resolveImagePath(source)
    if (filePath) return filePath
  }
  return ''
}

function resolveImagePath(source) {
  if (!source) return ''
  if (fs.existsSync(source)) return source
  const fromRoot = path.join(process.cwd(), source)
  if (fs.existsSync(fromRoot)) return fromRoot
  return ''
}

function formatDateLong(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function stylizeDocDefinition(node, styleText) {
  if (!node || typeof node !== 'object') return node

  if (Array.isArray(node)) {
    for (let idx = 0; idx < node.length; idx++) {
      node[idx] = stylizeDocDefinition(node[idx], styleText)
    }
    return node
  }

  for (const key of Object.keys(node)) {
    const value = node[key]
    if (key === 'text' && typeof value === 'string') {
      node[key] = styleText(value)
      continue
    }
    if (value && typeof value === 'object') {
      node[key] = stylizeDocDefinition(value, styleText)
    }
  }

  return node
}

function createTextStyler(companyName) {
  const terms = buildBoldTerms(companyName)

  return function styleText(text) {
    const source = String(text)
    const ranges = collectBoldRanges(source, terms)
    if (!ranges.length) return text

    const fragments = []
    let cursor = 0

    for (const range of ranges) {
      if (range.start > cursor) fragments.push({ text: source.slice(cursor, range.start) })
      fragments.push({ text: source.slice(range.start, range.end), bold: true })
      cursor = range.end
    }

    if (cursor < source.length) fragments.push({ text: source.slice(cursor) })
    return fragments
  }
}

function buildBoldTerms(companyName) {
  const terms = []
  const add = (text, caseSensitive = false) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim()
    if (value.length < 3) return
    terms.push({ text: value, caseSensitive })
  }

  for (const variant of companyNameVariants(companyName)) add(variant)
  for (const variant of companyNameVariants(CooperationAgreementService.DEFAULT_COMPANY_NAME)) add(variant)
  add('PT Origin Magda Inovasi')
  add('PT. Origin Magda Inovasi')
  add('ORIGIN MAGDA INOVASI')
  // add('TEMA Agency')
  add('MITRA', true)

  const seen = new Set()
  return terms
    .filter((term) => {
      const key = `${term.caseSensitive ? 'cs' : 'ci'}:${term.caseSensitive ? term.text : term.text.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => right.text.length - left.text.length)
}

function companyNameVariants(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim()
  if (!raw) return []

  const variants = [raw]
  if (/^PT\.\s*/i.test(raw)) variants.push(raw.replace(/^PT\.\s*/i, 'PT '))
  if (/^PT\s+/i.test(raw)) variants.push(raw.replace(/^PT\s+/i, 'PT. '))

  const withoutPt = raw.replace(/^PT\.?\s*/i, '').trim()
  if (withoutPt && withoutPt !== raw) variants.push(withoutPt)

  return variants
}

function collectBoldRanges(text, terms) {
  const ranges = []

  for (const term of terms) {
    const flags = term.caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(term.text)})(?=$|[^A-Za-z0-9_])`, flags)
    let match

    while ((match = regex.exec(text)) !== null) {
      const start = match.index + match[1].length
      const end = start + match[2].length
      ranges.push({ start, end })
      if (match.index === regex.lastIndex) regex.lastIndex++
    }
  }

  ranges.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start
    return (right.end - right.start) - (left.end - left.start)
  })

  const selected = []
  let lastEnd = 0
  for (const range of ranges) {
    if (range.start < lastEnd) continue
    selected.push(range)
    lastEnd = range.end
  }

  return selected
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
