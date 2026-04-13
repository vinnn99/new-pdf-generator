const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const projectRoot = __dirname.includes('scripts') ? path.join(__dirname, '..') : __dirname;
const fontsDir = path.join(projectRoot, 'app', 'Fonts');
const printer = new PdfPrinter({
  Roboto: {
    normal: path.join(fontsDir, 'Roboto_Condensed-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto_Condensed-Bold.ttf'),
    italics: path.join(fontsDir, 'Roboto_Condensed-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto_Condensed-BoldItalic.ttf'),
  },
});

const tpl = (name) => require(path.join(projectRoot, 'resources', 'pdf-templates', name));
const templates = {
  'ba-penempatan': tpl('ba-penempatan'),
  'ba-request-id': tpl('ba-request-id'),
  'ba-hold': tpl('ba-hold'),
  'ba-rolling': tpl('ba-rolling'),
  'ba-hold-activate': tpl('ba-hold-activate'),
  'ba-takeout': tpl('ba-takeout'),
  'ba-terminated': tpl('ba-terminated'),
};

const today = '2026-04-11';
const signer = {
  signerLeftName: 'Tester Kiri',
  signerLeftTitle: 'QA Lead',
  signerRightName: 'Tester Kanan',
  signerRightTitle: 'QA Manager',
};

const payloads = {
  'ba-penempatan': {
    letterNo: '001/TEST/BA/PEN/IV/2026',
    mdsName: 'Contoh Penempatan',
    nik: '1234567890123456',
    placementDate: '2026-04-05',
    outlet: 'OUTLET CONTOH',
    region: 'JKT',
    status: 'STAY',
    category: 'BIR',
    reason: 'Uji coba penempatan',
    letterDate: today,
    location: 'Jakarta',
    ...signer,
  },
  'ba-request-id': {
    letterNo: '002/TEST/BA/REQID/IV/2026',
    area: 'BDG',
    mdsName: 'Contoh Request ID',
    nik: '9876543210987654',
    birthDate: '1995-12-12',
    joinDate: '2026-03-15',
    status: 'MOBILE',
    stores: ['TOKO A', 'TOKO B'],
    reason: 'Uji coba request ID',
    letterDate: today,
    location: 'Bandung',
    ...signer,
  },
  'ba-hold': {
    letterNo: '003/TEST/BA/HOLD/IV/2026',
    region: 'SMG',
    holdDate: '2026-04-02',
    mdsName: 'Contoh Hold',
    mdsCode: 'MDS001',
    status: 'HOLD',
    outlet: 'TOKO HOLD',
    reason: 'Uji coba hold',
    letterDate: today,
    location: 'Semarang',
    ...signer,
  },
  'ba-rolling': {
    letterNo: '004/TEST/BA/ROLL/IV/2026',
    region: 'SBY',
    rollingDate: '2026-04-03',
    mdsName: 'Contoh Rolling',
    mdsCode: 'MDS002',
    status: 'ROLLING',
    outletFrom: 'TOKO LAMA',
    outletTo: 'TOKO BARU',
    reason: 'Uji coba rolling',
    letterDate: today,
    location: 'Surabaya',
    ...signer,
  },
  'ba-hold-activate': {
    letterNo: '005/TEST/BA/HOLD-ACT/IV/2026',
    region: 'MDN',
    reactivateDate: '2026-04-04',
    mdsName: 'Contoh Re-Active',
    mdsCode: 'MDS003',
    status: 'ACTIVE',
    outlet: 'TOKO ACTIVE',
    holdReason: 'Sudah selesai hold',
    letterDate: today,
    location: 'Medan',
    ...signer,
  },
  'ba-takeout': {
    letterNo: '006/TEST/BA/TAKEOUT/IV/2026',
    region: 'DPS',
    takeoutDate: '2026-04-06',
    mdsName: 'Contoh Takeout',
    mdsCode: 'MDS004',
    status: 'TAKEOUT',
    outlet: 'TOKO TAKEOUT',
    reason: 'Uji coba takeout',
    letterDate: today,
    location: 'Denpasar',
    ...signer,
  },
  'ba-terminated': {
    letterNo: '007/TEST/BA/TERM/IV/2026',
    region: 'MLG',
    terminateDate: '2026-04-07',
    mdsName: 'Contoh Terminasi',
    mdsCode: 'MDS005',
    status: 'TERMINATED',
    outlet: 'TOKO TERMINATED',
    reasons: ['Uji coba terminasi', 'Dokumentasi QA'],
    letterDate: today,
    location: 'Malang',
    ...signer,
  },
};

async function generateOne(key) {
  const fn = templates[key];
  const data = payloads[key];
  const def = fn(data);
  const pdfDoc = printer.createPdfKitDocument(def);
  const outPath = path.join(projectRoot, 'output', 'ba-previews', `${key}.pdf`);
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

(async () => {
  for (const key of Object.keys(templates)) {
    const out = await generateOne(key);
    console.log('Generated', out);
  }
})();
