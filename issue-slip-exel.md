# Issue: Tambah Template `exel-payslip`

## Ringkasan

Tambahkan template PDF baru bernama `exel-payslip` untuk kebutuhan slip gaji PT. EXEL INTEGRASI SOLUSINDO.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Template baru harus mirip dengan template `payslip` yang sudah ada, dengan penyesuaian branding dan warna.

## Latar Belakang

Saat ini sistem sudah memiliki template slip gaji `payslip` yang dipakai oleh:

- Generate Single PDF
- Bulk Generate PDF via Excel
- Preview PDF
- Validasi `allowed_templates`

Kebutuhan baru adalah menyediakan variasi slip gaji untuk EXEL dengan key template `exel-payslip`.

## Scope

### Backend

1. Buat template legacy baru `exel-payslip`.
2. Template `exel-payslip` mengikuti struktur dan field `payslip`.
3. Logo default template memakai `resources/images/logo-old.png`.
4. Nama perusahaan default adalah `PT. EXEL INTEGRASI SOLUSINDO`.
5. Warna background header bagian `Pendapatan` dan `Potongan` adalah `#d92d2d`.
6. Template bisa dipakai di endpoint single generate.
7. Template bisa dipakai di endpoint bulk generate.
8. Template muncul di katalog template admin dan tetap mengikuti aturan `allowed_templates`.

### Frontend

1. Tambahkan opsi `Exel Payslip` di halaman `Generate Single PDF`.
2. Tambahkan opsi `Exel Payslip` di halaman `Bulk Generate PDF`.
3. Field input single generate sama seperti `payslip`.
4. Format kolom Excel bulk sama seperti `payslip`.
5. Sediakan file download template Excel untuk bulk generate jika pola existing mensyaratkan semua mode punya file template.

## Detail Perubahan Backend

### File yang Perlu Dibuat

#### `resources/pdf-templates/exel-payslip.js`

File legacy resolver membaca template dari folder `resources/pdf-templates`.

Isi yang disarankan:

- Require ke template implementation baru di `app/Templates/exel-payslip.js`.
- Polanya sama seperti `resources/pdf-templates/payslip.js`.

#### `app/Templates/exel-payslip.js`

Implementasi PDFMake untuk template baru.

Opsi implementasi:

- Copy dari `app/Templates/payslip.js`, lalu ubah bagian yang dibutuhkan.
- Atau buat wrapper kecil jika `payslip.js` nantinya di-refactor agar menerima opsi logo/default company/header color.

Untuk task ini, pendekatan paling aman untuk junior programmer adalah copy file `payslip.js` menjadi `exel-payslip.js`, lalu ubah:

- `companyName` default dari `Perusahaan` menjadi `PT. EXEL INTEGRASI SOLUSINDO`.
- `logoPath` dari `resources/images/tema-logo.png` menjadi `resources/images/logo-old.png`.
- `HEADER_BG` di `sectionTable()` dari `#12B7AD` menjadi `#d92d2d`.

Pastikan label section tetap:

- `Pendapatan`
- `Potongan`

### File yang Perlu Dimodifikasi

#### `app/Services/TemplateResolver.js`

Tambahkan required field legacy:

```js
'exel-payslip': ['employeeName', 'position', 'period']
```

Tujuannya agar endpoint single generate dan preview melakukan validasi field yang sama seperti `payslip`.

#### `app/Controllers/Http/BulkPdfController.js`

Tambahkan method controller:

```js
async exelPayslipFromExcel(ctx) {
  return this._handleExcel(ctx, 'exel-payslip')
}
```

Update helper terkait:

- `defaultSlipTitleForMode(mode)`: untuk `exel-payslip`, default bisa tetap `Payslip` kecuali product owner meminta wording lain.
- `buildPayloadForMode(lower, mode, opts)`: arahkan `exel-payslip` ke builder yang sama dengan `payslip`.
- `buildPayslipPayload(lower, opts)`: hati-hati karena saat ini `payload.template` diisi dari kolom Excel `template` atau fallback `payslip`. Untuk endpoint `/bulk/exel-payslip`, template final harus tetap `exel-payslip` jika kolom `template` tidak diisi.
- `isSlipMode(mode)`: tambahkan `exel-payslip` supaya bulk filename memakai format slip.

Catatan penting:

- Saat bulk, `_handleExcel()` sudah set `payload.filenameTemplate = mode` untuk slip mode. Jika `exel-payslip` masuk `isSlipMode`, nama file akan menjadi pola:

```text
<periode>.exel-payslip.<employeeId>.<employeeName>.<unique>.pdf
```

#### `start/routes.js`

Tambahkan route bulk:

```js
Route.post('/bulk/exel-payslip', 'BulkPdfController.exelPayslipFromExcel').middleware(['auth:jwt'])
```

Endpoint single generate tidak perlu route baru karena memakai `POST /api/v1/generate-pdf` dengan body `template: "exel-payslip"`.

#### `app/Services/SlipPayloadNormalizer.js`

Cek apakah normalizer hanya memproses template tertentu (`payslip`, `insentif`, `thr`, dll).

Jika ada kondisi eksplisit untuk slip template, tambahkan `exel-payslip` supaya alias field seperti `departement`, `periode`, `gajiPokok`, `tunjanganMakan`, dan field uang lain tetap dinormalisasi sama seperti `payslip`.

#### `app/Jobs/GeneratePdfJob.js`

Cek helper `isSlipFilenameTemplate()` dan `normalizeFilenameTemplate()`.

Jika daftar slip filename template hardcoded, tambahkan `exel-payslip` supaya hasil generate single dan bulk memakai pola nama file slip, bukan fallback generic:

```text
<periode>.exel-payslip.<employeeId>.<employeeName>.<unique>.pdf
```

#### `app/Services/BaPreviewService.js`

Cek apakah preview mendukung semua legacy template via `TemplateResolver`, atau ada allowlist manual di `supportsTemplate()`.

Jika ada allowlist, tambahkan `exel-payslip` agar tombol Preview PDF di frontend single generate bisa berjalan.

#### `API_DOCUMENTATION.md`

Update dokumentasi:

- Daftar template single generate.
- Daftar endpoint bulk generate.
- Required field template.
- Contoh payload `exel-payslip`.
- Catatan filename slip.

### File Excel Backend

#### `resources/templates/exel-payslip-bulk-template.xlsx`

Jika folder `resources/templates` dipakai sebagai master template Excel backend, buat file baru dari `payslip-bulk-template.xlsx`.

Kolom disamakan dengan `payslip`:

- `employeeId`
- `employeeName`
- `position`
- `departement`
- `periode`
- `joinDate`
- `ptkp`
- `targetHK`
- `attendance`
- `Gaji Pokok`
- `Tunjangan makan`
- `Tunjangan Transport`
- `Tunjangan Komunikasi`
- `Tunjangan Jabatan`
- `Tunjangan BPJS Ketenagakerjaan`
- `BPJS Ketenagakerjaan`
- `PPH 21`
- `email` opsional
- `callback_url` opsional
- `callback_header` opsional
- `data_json` opsional

## Detail Perubahan Frontend

### File yang Perlu Dimodifikasi

#### `src/utils/templateFields.js`

Tambahkan opsi template:

```js
{ value: 'exel-payslip', label: 'Exel Payslip' }
```

Tambahkan field map:

```js
'exel-payslip': [
  // sama seperti payslip
]
```

Pastikan field required sama:

- `employeeName`
- `position`
- `period`

#### `src/components/forms/BulkGenerateForm.jsx`

Tambahkan mode:

```js
{ value: 'exel-payslip', label: 'Exel Payslip' }
```

Tambahkan mapping file template:

```js
'exel-payslip': '/templates/exel-payslip.xlsx'
```

Tambahkan `columnHintsByMode['exel-payslip']` dengan daftar kolom yang sama seperti `payslip`.

Pastikan mode baru tetap tunduk ke `allowed_templates` company. Jika company memiliki restriction, `exel-payslip` hanya muncul jika value ini ada di `allowed_templates`.

#### `src/components/forms/GeneratePdfForm.jsx`

Kemungkinan tidak perlu modifikasi langsung jika komponen ini sudah memakai `templates` dan `templateFieldMap` dari `src/utils/templateFields.js`.

Tetap cek behavior berikut:

- Dropdown template menampilkan `Exel Payslip`.
- Form field dinamis muncul sama seperti `payslip`.
- Payload single generate terkirim dengan `template: "exel-payslip"`.
- Preview PDF memakai endpoint `/api/v1/preview/exel-payslip`.

#### `public/templates/exel-payslip.xlsx`

Buat file Excel bulk frontend dari `public/templates/payslip.xlsx`.

Kolom harus sama dengan `payslip`, karena backend builder akan memakai field yang sama.

#### `API_DOCUMENTATION.md`

Jika frontend repo memiliki copy dokumentasi API, update juga agar konsisten dengan backend.

## Catatan Allowed Templates

Sistem memakai `allowed_templates` di company.

Setelah implementasi, admin/superadmin perlu menambahkan value berikut ke company yang boleh memakai template ini:

```text
exel-payslip
```

Jika tidak ditambahkan pada company yang restricted, endpoint single/bulk/preview akan mengembalikan 403.

## Acceptance Criteria

1. `POST /api/v1/generate-pdf` dengan `template: "exel-payslip"` berhasil enqueue PDF jika payload valid.
2. PDF `exel-payslip` memakai logo `resources/images/logo-old.png`.
3. Jika payload tidak mengirim `data.companyName`, PDF menampilkan `PT. EXEL INTEGRASI SOLUSINDO`.
4. Header section `Pendapatan` dan `Potongan` memakai warna `#d92d2d`.
5. Required field sama seperti `payslip`: `employeeName`, `position`, `period`.
6. `POST /api/v1/bulk/exel-payslip` berhasil membaca Excel format payslip dan enqueue job.
7. Bulk result mengembalikan `mode: "exel-payslip"`.
8. Nama file PDF slip memakai segmen `exel-payslip`.
9. Halaman `Generate Single PDF` menampilkan opsi `Exel Payslip` dan field yang sama seperti payslip.
10. Halaman `Bulk Generate PDF` menampilkan opsi `Exel Payslip`, kolom hint yang sesuai, dan link unduh template Excel.
11. Jika `allowed_templates` company tidak berisi `exel-payslip`, fitur ditolak/tersembunyi sesuai pola existing.

## Skenario Test yang Perlu Dilakukan

### Backend

- Generate single `exel-payslip` dengan payload minimal valid.
- Generate single `exel-payslip` tanpa `employeeName`, `position`, atau `period` untuk memastikan validasi berjalan.
- Preview `exel-payslip` dari user admin yang company-nya mengizinkan template tersebut.
- Bulk generate `exel-payslip` memakai file Excel hasil copy dari payslip.
- Bulk generate `exel-payslip` saat company restricted dan template belum diizinkan, pastikan response 403.
- Cek output PDF secara visual: logo, nama perusahaan default, warna `Pendapatan` dan `Potongan`, total pendapatan, total potongan, dan net salary.

### Frontend

- Di `Generate Single PDF`, pilih `Exel Payslip`, isi field minimal, lalu submit.
- Di `Generate Single PDF`, klik Preview PDF dan pastikan preview tampil.
- Di `Bulk Generate PDF`, pilih `Exel Payslip`, pastikan hint kolom muncul.
- Download template Excel `Exel Payslip` dari halaman bulk.
- Upload file Excel valid dan submit bulk dry run.
- Login sebagai company dengan `allowed_templates` terbatas dan pastikan `Exel Payslip` hanya muncul jika diizinkan.

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

- Gunakan key template persis `exel-payslip`, bukan `excel-payslip`.
- Jangan mengubah behavior template `payslip` existing.
- Jangan mengubah logo global atau asset existing.
- Hindari refactor besar kecuali memang diperlukan; target issue ini adalah menambahkan variasi template dengan risiko rendah.
