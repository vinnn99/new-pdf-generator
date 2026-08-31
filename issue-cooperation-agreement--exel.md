# Issue: Tambah Template `exel_cooperation_agreement` dan Lengkapi Bulk Send Email EXEL

## Ringkasan

Tambahkan template PDF baru bernama `exel_cooperation_agreement` untuk kebutuhan Perjanjian Kerjasama Kemitraan PT. EXEL INTEGRASI SOLUSINDO.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Template baru harus sama dengan `cooperation_agreement`, tetapi memakai branding EXEL:

- Logo default: `resources/images/logo-old.png`
- Nama perusahaan default: `PT. EXEL INTEGRASI SOLUSINDO`

Selain itu, lengkapi dukungan:

- `exel_cooperation_agreement` di Generate Single PDF
- `exel_cooperation_agreement` di Bulk Generate PDF
- `exel_cooperation_agreement` di Bulk Send Email
- `exel-payslip` di Bulk Send Email

## Latar Belakang

Saat ini sistem sudah memiliki template `cooperation_agreement` dengan alur khusus:

- Generate single memakai `POST /api/v1/generate-pdf`
- Bulk generate memakai `POST /api/v1/bulk/cooperation_agreement`
- Bulk send email memakai `POST /api/v1/send-cooperation-agreement-emails`
- Nomor PKM auto-generate lewat `CooperationAgreementLetterNoService`
- Attachment bulk send email dicari berdasarkan `batch_id + template + match_key`

Karena `cooperation_agreement` bukan template biasa, variant EXEL tidak cukup hanya ditambah file template. Variant baru harus ikut masuk ke jalur khusus Cooperation Agreement untuk validasi, normalisasi data, nomor PKM, batch history, dan lookup attachment.

## Scope

### Backend

1. Buat template legacy `exel_cooperation_agreement`.
2. Template memakai struktur dan field yang sama dengan `cooperation_agreement`.
3. Template memakai logo default `resources/images/logo-old.png`.
4. Template memakai default company name `PT. EXEL INTEGRASI SOLUSINDO`.
5. Single generate dapat menerima `template: "exel_cooperation_agreement"`.
6. Bulk generate dapat berjalan lewat endpoint baru.
7. Bulk send email dapat mengirim attachment dari batch `exel_cooperation_agreement`.
8. `exel-payslip` dapat dipilih/diproses di Bulk Send Email.
9. Semua tetap mengikuti `allowed_templates` company.

### Frontend

1. Tambahkan `Exel Cooperation Agreement` di Generate Single PDF.
2. Tambahkan `Exel Cooperation Agreement` di Bulk Generate PDF.
3. Tambahkan `Exel Cooperation Agreement` di Bulk Send Email.
4. Tambahkan `Exel Payslip` di Bulk Send Email.
5. Tambahkan template Excel download yang diperlukan.
6. Pastikan semua mode tetap mengikuti `allowed_templates`.

## Detail Perubahan Backend

### File yang Perlu Dibuat

#### `resources/pdf-templates/exel_cooperation_agreement.js`

File ini dibaca oleh `TemplateResolver` sebagai legacy template.

Isi yang disarankan:

```js
'use strict'

module.exports = require('../../app/Templates/exel_cooperation_agreement')
```

#### `app/Templates/exel_cooperation_agreement.js`

Implementasi template EXEL.

Pendekatan paling aman:

- Buat wrapper kecil yang memanggil template `cooperation_agreement`.
- Sebelum memanggil template existing, inject default berikut jika belum dikirim:
  - `companyName = "PT. EXEL INTEGRASI SOLUSINDO"`
  - `logoPath = path.join(__dirname, '..', '..', 'resources', 'images', 'logo-old.png')`

Contoh arah implementasi:

```js
'use strict'

const path = require('path')
const cooperationAgreementTemplate = require('./cooperation_agreement')

const EXEL_COMPANY_NAME = 'PT. EXEL INTEGRASI SOLUSINDO'
const EXEL_LOGO_PATH = path.join(__dirname, '..', '..', 'resources', 'images', 'logo-old.png')

module.exports = function exelCooperationAgreementTemplate(payloadData = {}) {
  return cooperationAgreementTemplate({
    ...payloadData,
    companyName: payloadData.companyName || EXEL_COMPANY_NAME,
    logoPath: payloadData.logoPath || payloadData.companyLogoPath || EXEL_LOGO_PATH
  })
}
```

Catatan:

- Jangan ubah output template `cooperation_agreement` existing.
- Jika `payloadData.logoUrl` dikirim, biarkan tetap bisa override sesuai pola existing.

### File yang Perlu Dimodifikasi

#### `app/Services/CooperationAgreementService.js`

Tambahkan pemahaman variant EXEL.

Rekomendasi:

- Tambahkan constant:

```js
const EXEL_TEMPLATE = 'exel_cooperation_agreement'
const EXEL_DEFAULT_COMPANY_NAME = 'PT. EXEL INTEGRASI SOLUSINDO'
```

- Tambahkan getter untuk constant tersebut.
- Update/atau tambah helper:

```js
static isTemplate(template) {
  return ['cooperation_agreement', 'exel_cooperation_agreement'].includes(String(template || '').trim().toLowerCase())
}

static isExelTemplate(template) {
  return String(template || '').trim().toLowerCase() === EXEL_TEMPLATE
}
```

- Pastikan `requiredFields()` tetap sama untuk dua template.
- Saat normalisasi data untuk variant EXEL, default `companyName` harus `PT. EXEL INTEGRASI SOLUSINDO`.

Catatan nomor PKM:

- Saat ini `CooperationAgreementLetterNoService` memakai counter dengan key `cooperation_agreement`.
- Jika bisnis belum meminta nomor terpisah, pakai counter PKM yang sama agar sequence tetap satu jalur.
- Jika bisnis meminta nomor EXEL terpisah, perlu update service counter dan format nomor surat secara eksplisit.

#### `app/Services/TemplateResolver.js`

Tambahkan required field legacy:

```js
exel_cooperation_agreement: CooperationAgreementService.requiredFields()
```

Tujuannya agar single generate dan preview memakai validasi field yang sama dengan `cooperation_agreement`.

#### `app/Services/PayloadDateNormalizer.js`

Tambahkan field date untuk variant baru:

```js
exel_cooperation_agreement: ['letterDate', 'partnerBirthDate']
```

#### `app/Controllers/Http/PdfController.js`

Cek semua branch `CooperationAgreementService.isTemplate(normalizedTemplate)`.

Pastikan `exel_cooperation_agreement` ikut:

- normalisasi data cooperation agreement
- validasi data
- generate nomor PKM
- record signature/logo history
- allowed templates check

Jika `CooperationAgreementService.isTemplate()` sudah menerima variant EXEL, perubahan di controller ini kemungkinan minimal.

#### `app/Controllers/Http/BulkPdfController.js`

Tambahkan method controller:

```js
async exelCooperationAgreementFromExcel(ctx) {
  return this._handleExcel(ctx, 'exel_cooperation_agreement')
}
```

Update helper terkait:

- `buildPayloadForMode(lower, mode, opts)`: arahkan mode `exel_cooperation_agreement` ke builder cooperation agreement.
- `buildCooperationAgreementPayload(...)`: pastikan template final dapat menjadi `exel_cooperation_agreement`, bukan selalu `cooperation_agreement`.
- `isCooperationAgreementMode` atau helper sejenis: pastikan variant EXEL dianggap batch tracked dan lettered batch.
- `buildBatchMatchKey(mode, lower, payload.data)`: variant EXEL harus memakai match key yang sama, yaitu `partnerName + partnerEmail/partnerIdentityNumber`.
- `getRequiredBatchMatchFields(mode)`: variant EXEL butuh field kunci yang sama.

Expected response bulk:

```json
{
  "status": "ok",
  "mode": "exel_cooperation_agreement",
  "batch_id": "..."
}
```

#### `start/routes.js`

Tambahkan route bulk:

```js
Route.post('/bulk/exel_cooperation_agreement', 'BulkPdfController.exelCooperationAgreementFromExcel').middleware(['auth:jwt'])
```

Tambahkan route bulk send email:

```js
Route.post('/send-exel-cooperation-agreement-emails', 'BulkEmailController.sendExelCooperationAgreement').middleware(['auth:jwt'])
```

Endpoint single generate tidak perlu route baru karena memakai `POST /api/v1/generate-pdf`.

#### `app/Controllers/Http/BulkEmailController.js`

Tambahkan method bulk send email untuk EXEL cooperation agreement.

Disarankan reuse `_sendBaTemplate()` seperti `sendCooperationAgreement()`, tetapi `cfg.template` memakai `exel_cooperation_agreement`.

Contoh arah:

```js
async sendExelCooperationAgreement({ request, response, auth }) {
  const cfg = {
    template: CooperationAgreementService.EXEL_TEMPLATE,
    label: 'Exel Cooperation Agreement',
    context: 'bulk-exel-cooperation-agreement',
    extractFields: extractCooperationAgreementMatchFields,
    buildMatchKey: (fields) => CooperationAgreementService.buildMatchKey(fields),
    validateFields: ...,
    subject: ...,
    body: ...
  }
  return this._sendBaTemplate({ request, response, auth }, cfg)
}
```

Pastikan query batch memakai:

```js
.where('template', 'exel_cooperation_agreement')
```

Supaya attachment yang dikirim berasal dari batch EXEL, bukan batch `cooperation_agreement`.

Untuk `exel-payslip` di Bulk Send Email:

- Update `normalizeSlipTemplate(template)` agar menerima `exel-payslip`.
- Jika ada infer dari `slipTitle`, boleh tambahkan deteksi kata `exel`.
- Pastikan `/send-slip-emails` dapat menerima request form-data `template=exel-payslip`.
- Lookup attachment harus membaca filename pola slip:

```text
<periode>.exel-payslip.<employeeId>.<employeeName>.<unique>.pdf
```

#### `app/Jobs/GeneratePdfJob.js`

Tambahkan branch filename untuk `exel_cooperation_agreement`.

Pola disarankan mirip cooperation agreement existing:

```text
exel_cooperation_agreement.<partnerName>.<letterNo>.<unique>.pdf
```

Jika ada helper strict `template === CooperationAgreementService.TEMPLATE`, ubah agar variant EXEL ikut dianggap Cooperation Agreement.

#### `app/Services/BaPreviewService.js`

Pastikan preview `exel_cooperation_agreement`:

- normalisasi data cooperation agreement
- memakai default company EXEL jika companyName tidak dikirim
- memakai preview letter number yang sesuai
- menyimpan row preview dengan `template = "exel_cooperation_agreement"`

Catatan:

- Saat ini preview Cooperation Agreement memakai `CooperationAgreementService.buildPreviewLetterNo()`.
- Jika format nomor preview masih `PREVIEW/HRD-OMI/PKM/...`, minta konfirmasi bisnis apakah untuk EXEL harus berubah. Jika belum ada instruksi, boleh tetap memakai format existing agar scope tidak melebar.

#### `app/Controllers/Http/SingleEmailController.js`

Tidak diminta eksplisit untuk halaman Send Single Email, tetapi backend bisa lebih konsisten jika route single send juga didukung.

Opsional:

- Tambahkan `sendExelCooperationAgreement()`.
- Tambahkan route `/send/exel_cooperation_agreement`.
- Tambahkan required fields untuk variant EXEL.

Jika scope ingin dijaga ketat, boleh skip bagian ini dan fokus pada Generate Single PDF, Bulk Generate PDF, Bulk Send Email.

#### `API_DOCUMENTATION.md`

Update dokumentasi backend:

- Daftar template single generate.
- Daftar endpoint bulk generate.
- Daftar endpoint bulk send email.
- Required field `exel_cooperation_agreement`.
- Contoh payload single.
- Contoh request bulk generate.
- Contoh request bulk send email.
- Catatan allowed templates.
- Catatan `exel-payslip` dapat dikirim via Bulk Send Email.

### File Excel Backend

#### `resources/templates/exel_cooperation_agreement-bulk-template.xlsx`

Buat dari `resources/templates/cooperation_agreement-bulk-template.xlsx`.

Kolom sama seperti `cooperation_agreement`.

#### Template email backend

Jika project memakai master template untuk email di backend, siapkan juga file setara:

```text
resources/templates/send-exel-cooperation-agreement-emails.xlsx
```

Jika tidak ada mekanisme backend untuk download file ini, cukup pastikan file frontend tersedia.

## Detail Perubahan Frontend

### File yang Perlu Dimodifikasi

#### `src/utils/templateFields.js`

Tambahkan template:

```js
{ value: 'exel_cooperation_agreement', label: 'Exel Cooperation Agreement' }
```

Tambahkan field map:

```js
exel_cooperation_agreement: [
  // sama seperti cooperation_agreement
]
```

Field required sama seperti `cooperation_agreement`.

Catatan:

- `GeneratePdfForm.jsx` memakai `templates` dan `templateFieldMap`, jadi kemungkinan cukup update file ini untuk Generate Single PDF.
- Cek special handling signature/logo. Jika logic hanya mengenali `cooperation_agreement`, tambahkan `exel_cooperation_agreement`.

#### `src/components/forms/GeneratePdfForm.jsx`

Cek constant/helper:

- `COOPERATION_AGREEMENT_TEMPLATE`
- `isCooperationAgreementMode`
- `isSignatureTemplateMode`
- `COOPERATION_SIGNATURE_HIDDEN_FIELDS`

Pastikan `exel_cooperation_agreement` diperlakukan seperti `cooperation_agreement`, terutama untuk:

- field logo/signature
- preview PDF
- data JSON/custom fallback
- allowed templates filtering

#### `src/components/forms/BulkGenerateForm.jsx`

Tambahkan mode:

```js
{ value: 'exel_cooperation_agreement', label: 'Exel Cooperation Agreement' }
```

Tambahkan mapping download:

```js
exel_cooperation_agreement: '/templates/exel_cooperation_agreement.xlsx'
```

Tambahkan `columnHintsByMode.exel_cooperation_agreement` sama seperti `cooperation_agreement`.

Pastikan submit mengarah otomatis ke:

```text
/api/v1/bulk/exel_cooperation_agreement
```

Karena `bulkGenerate()` memakai `/v1/bulk/${payload.mode}`.

#### `src/components/forms/SendEmailsForm.jsx`

Tambahkan mode Bulk Send Email:

```js
{ value: 'exel_cooperation_agreement', label: 'Exel Cooperation Agreement', endpoint: '/api/v1/send-exel-cooperation-agreement-emails' }
```

Tambahkan mode `Exel Payslip`:

```js
{ value: 'exel-payslip', label: 'Exel Payslip', endpoint: '/api/v1/send-slip-emails' }
```

Update `downloadByMode`:

```js
exel_cooperation_agreement: '/templates/send-exel-cooperation-agreement-emails.xlsx',
'exel-payslip': '/templates/send-exel-payslip-emails.xlsx'
```

Update `columnHints`:

- `exel_cooperation_agreement`: sama seperti `cooperation_agreement`.
- `exel-payslip`: sama seperti `slip`, dengan catatan attachment dicari memakai template segment `exel-payslip`.

Update `attachmentHint`:

- `exel_cooperation_agreement`: attachment dicari dari batch berdasarkan `partnerName` dan `partnerEmail/partnerIdentityNumber`.
- `exel-payslip`: attachment dicari di folder download user login dengan pola filename slip `exel-payslip`.

Update `modeAllowedKeys(mode)`:

- `exel-payslip` harus dianggap allowed jika `allowed_templates` berisi `exel-payslip`.
- `exel_cooperation_agreement` harus dianggap allowed jika `allowed_templates` berisi `exel_cooperation_agreement`.

Update `slipAttachmentModes`:

```js
const slipAttachmentModes = new Set(['slip', 'exel-payslip', 'event_weekly_payslip'])
```

Update mutation submit:

- Untuk `mode === 'exel-payslip'`, panggil `sendSlipEmails({ file, periode, template: 'exel-payslip' })`.
- Untuk `mode === 'exel_cooperation_agreement'`, panggil `sendBatchAttachmentEmails({ template: 'exel_cooperation_agreement', file, batchId })`.

#### `src/api/bulkApi.js`

Tambahkan endpoint map:

```js
exel_cooperation_agreement: '/v1/send-exel-cooperation-agreement-emails'
```

Untuk `exel-payslip`, tidak wajib masuk `batchAttachmentEmailEndpointMap` karena dikirim via `sendSlipEmails()` dan bukan batch mode.

Pastikan `sendSlipEmails()` sudah mengirim field `template` jika payload memilikinya. Saat ini pola itu sudah ada, tinggal dipakai dari `SendEmailsForm.jsx`.

#### `src/pages/BatchHistoryPage.jsx`

Tambahkan pilihan filter batch:

```js
{ value: 'exel_cooperation_agreement', label: 'Exel Cooperation Agreement' }
```

Tujuannya agar user bisa mencari batch hasil bulk generate EXEL cooperation agreement.

### File yang Perlu Dibuat di Frontend

#### `public/templates/exel_cooperation_agreement.xlsx`

Buat dari `public/templates/cooperation_agreement.xlsx`.

#### `public/templates/send-exel-cooperation-agreement-emails.xlsx`

Buat dari `public/templates/send-cooperation-agreement-emails.xlsx`.

Kolom minimal:

- `sentTo`
- `partnerName`
- `partnerEmail`
- `partnerIdentityNumber`
- `subject`
- `body`
- `cc`
- `bcc`

#### `public/templates/send-exel-payslip-emails.xlsx`

Buat dari `public/templates/send-slip-emails.xlsx`.

Kolom minimal:

- `sentTo`
- `employeeId`
- `employeeName`
- `periode`
- `slipTitle`
- `body`
- `cc`
- `bcc`

## Catatan Allowed Templates

Company restricted harus punya value berikut agar fitur muncul/diizinkan:

```text
exel_cooperation_agreement
exel-payslip
```

Jika `allowed_templates` kosong, sistem existing biasanya mengizinkan semua template.

Jika `allowed_templates` berisi daftar terbatas:

- Generate Single PDF harus menyembunyikan/menolak template yang tidak ada.
- Bulk Generate PDF harus menyembunyikan/menolak mode yang tidak ada.
- Bulk Send Email harus menyembunyikan/menolak mode yang tidak ada.
- Backend tetap harus validasi 403 meskipun frontend menyembunyikan mode.

## Acceptance Criteria

1. `POST /api/v1/generate-pdf` dengan `template: "exel_cooperation_agreement"` berhasil jika payload valid.
2. PDF `exel_cooperation_agreement` memakai logo `resources/images/logo-old.png` jika logo tidak dioverride.
3. PDF `exel_cooperation_agreement` memakai default company name `PT. EXEL INTEGRASI SOLUSINDO` jika `companyName` tidak dikirim.
4. Required fields `exel_cooperation_agreement` sama dengan `cooperation_agreement`.
5. `POST /api/v1/bulk/exel_cooperation_agreement` berhasil memproses Excel format cooperation agreement.
6. Bulk generate `exel_cooperation_agreement` menghasilkan `batch_id`.
7. Batch item `exel_cooperation_agreement` memiliki `match_key` berbasis `partnerName` dan `partnerEmail/partnerIdentityNumber`.
8. `POST /api/v1/send-exel-cooperation-agreement-emails` dapat mengirim attachment dari batch `exel_cooperation_agreement`.
9. Bulk Send Email dapat memilih `Exel Payslip` dan mengirim `/send-slip-emails` dengan `template=exel-payslip`.
10. Lookup attachment `exel-payslip` menemukan file dengan pola `<periode>.exel-payslip.<employeeId>.<employeeName>.<unique>.pdf`.
11. Generate Single PDF menampilkan opsi `Exel Cooperation Agreement`.
12. Bulk Generate PDF menampilkan opsi dan template download `Exel Cooperation Agreement`.
13. Bulk Send Email menampilkan opsi `Exel Cooperation Agreement` dan `Exel Payslip`.
14. Semua fitur tetap tunduk pada `allowed_templates`.

## Skenario Test yang Perlu Dilakukan

### Backend

- Generate single `exel_cooperation_agreement` dengan payload valid.
- Generate single `exel_cooperation_agreement` dengan field wajib kosong untuk memastikan validasi berjalan.
- Preview `exel_cooperation_agreement` dari user admin yang company-nya mengizinkan template.
- Bulk generate `exel_cooperation_agreement` dengan Excel hasil copy dari cooperation agreement.
- Bulk generate `exel_cooperation_agreement` memastikan `batch_id`, `generation_batches`, dan `generation_batch_items` memakai template EXEL.
- Bulk send email `exel_cooperation_agreement` memakai batch valid dan file email valid.
- Bulk send email `exel_cooperation_agreement` dengan `batch_id` template lain harus tidak menemukan batch/attachment.
- Bulk send email `exel-payslip` dengan PDF hasil generate bulk `exel-payslip`.
- Allowed templates restricted: pastikan request ditolak 403 jika `exel_cooperation_agreement` atau `exel-payslip` tidak diizinkan.
- Cek visual PDF: logo EXEL, nama perusahaan EXEL, isi dokumen sama seperti template cooperation agreement.

### Frontend

- Generate Single PDF: pilih `Exel Cooperation Agreement`, isi field minimal valid, lalu submit.
- Generate Single PDF: preview `Exel Cooperation Agreement`.
- Bulk Generate PDF: pilih `Exel Cooperation Agreement`, pastikan hint kolom dan link download Excel muncul.
- Bulk Generate PDF: submit dry run dan submit normal untuk mendapatkan `batch_id`.
- Bulk Send Email: pilih `Exel Cooperation Agreement`, pilih batch, upload file email, lalu submit.
- Bulk Send Email: pilih `Exel Payslip`, isi periode opsional, upload file email, lalu submit.
- Login sebagai company restricted dan pastikan mode hanya muncul jika ada di `allowed_templates`.

## Perintah Verifikasi yang Disarankan

Backend:

```bash
npm test
```

Frontend:

```bash
npm test
npm run build
```

## Catatan Implementasi

- Gunakan key template persis `exel_cooperation_agreement`.
- Jangan memakai `exel-cooperation-agreement` untuk template key ini, karena kebutuhan menyebut format underscore.
- Jangan mengubah behavior `cooperation_agreement` existing.
- Jangan mengubah behavior `exel-payslip` yang sudah ada selain menambahkan dukungan Bulk Send Email.
- Hindari refactor besar; target issue ini adalah variant template dan wiring UI/API.
- Jika ada partial implementation sebelumnya, jangan diasumsikan selesai. Tetap cek seluruh file di atas dan jalankan skenario test.
