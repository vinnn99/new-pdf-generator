# Issue: Update Komponen Payroll dan Batch Tracking Template `exel-payslip`

## Informasi Umum

- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Template key yang digunakan: `exel-payslip`
- Dokumen ini adalah rencana implementasi. Belum termasuk perubahan source code.

> Catatan penamaan: pertahankan key `exel-payslip` karena key tersebut sudah dipakai oleh route, konfigurasi `allowed_templates`, nama file, dan frontend. Jangan menggantinya menjadi `excel-payslip` dalam task ini.

## Latar Belakang

Komponen payroll pada template `exel-payslip` saat ini adalah:

### Pendapatan saat ini

1. Gaji Pokok
2. Tunjangan Makan
3. Tunjangan Transport
4. Tunjangan Sewa Motor
5. Tunjangan Komunikasi
6. Tunjangan Jabatan
7. Tunjangan BPJS Ketenagakerjaan

### Potongan saat ini

1. BPJS Ketenagakerjaan
2. PPH21

Komponen tersebut harus diperbarui. Selain itu, hasil Bulk Generate PDF untuk `exel-payslip` harus tercatat sebagai batch dan dapat dilihat dari menu **Batch IDs**, dengan pembatasan akses sesuai company dan `allowed_templates`.

## Tujuan

Setelah implementasi:

1. Template `exel-payslip` memakai komponen payroll baru pada seluruh alur generate dan send single.
2. Bulk Generate PDF menerima header Excel baru dan menghasilkan payload yang sama dengan alur single.
3. Bulk Generate PDF non-`dryRun` membuat `batch_id`, batch summary, dan batch item untuk setiap baris.
4. Batch `exel-payslip` muncul di menu **Batch IDs** dan tetap mengikuti scope role/company.
5. Bulk Send Email tetap dapat menemukan dan mengirim PDF `exel-payslip` yang dihasilkan menggunakan format baru.
6. Template selain `exel-payslip` tidak berubah.

## Scope Komponen Baru

### Pendapatan

Urutan canonical yang diharapkan:

1. Gaji Pokok
2. Tunjangan Makan
3. Tunjangan Transport
4. Tunjangan Sewa Motor
5. Tunjangan Komunikasi
6. Tunjangan Jabatan
7. Insentif

### Potongan

Urutan canonical yang diharapkan:

1. BPJS Kesehatan
2. BPJS Ketenagakerjaan
3. PPH21

### Mapping field

| Jenis | Label PDF | Field frontend/API | Header Excel utama | Alias backend yang perlu diterima |
| --- | --- | --- | --- | --- |
| Earning | Gaji Pokok | `gajiPokok` | `Gaji Pokok` | `gaji_pokok`, `gaji pokok`, `baseSalary`, `base_salary` |
| Earning | Tunjangan Makan | `tunjanganMakan` | `Tunjangan Makan` | `tunjangan_makan`, `tunjangan makan` |
| Earning | Tunjangan Transport | `tunjanganTransport` | `Tunjangan Transport` | `tunjangan_transport`, `tunjangan transport` |
| Earning | Tunjangan Sewa Motor | `tunjanganSewaMotor` | `Tunjangan Sewa Motor` | alias sewa motor yang sudah didukung saat ini |
| Earning | Tunjangan Komunikasi | `tunjanganKomunikasi` | `Tunjangan Komunikasi` | `tunjangan_komunikasi`, `tunjangan komunikasi`; pertahankan typo legacy yang masih didukung jika diperlukan |
| Earning | Tunjangan Jabatan | `tunjanganJabatan` | `Tunjangan Jabatan` | `tunjangan_jabatan`, `tunjangan jabatan` |
| Earning | Insentif | `insentif` | `Insentif` | minimal `insentif`; boleh menerima `incentive` bila dibutuhkan integrasi lama |
| Deduction | BPJS Kesehatan | `bpjsKesehatan` | `BPJS Kesehatan` | `bpjs_kesehatan`, `bpjs kesehatan` |
| Deduction | BPJS Ketenagakerjaan | `bpjsKetenagakerjaan` | `BPJS Ketenagakerjaan` | `bpjs_ketenagakerjaan`, `bpjs ketenagakerjaan` |
| Deduction | PPH21 | `pph21` | `PPH21` | `pph_21`, `pph 21`, dan variasi kapitalisasi |

Ketentuan penting:

- `Tunjangan BPJS Ketenagakerjaan` dihapus dari earning `exel-payslip`.
- Jangan memindahkan nominal `Tunjangan BPJS Ketenagakerjaan` lama menjadi `Insentif` secara otomatis karena makna bisnisnya berbeda.
- Jika payload masih mengirim field atau item array berlabel `Tunjangan BPJS Ketenagakerjaan`, field tersebut tidak boleh tampil dan tidak boleh ikut total pendapatan `exel-payslip`.
- Pertahankan perilaku existing terhadap nilai kosong dan nilai nol, termasuk aturan khusus `Tunjangan Sewa Motor`, kecuali ada keputusan bisnis terpisah.
- Semua nominal harus tetap melalui normalisasi angka yang sudah ada agar nilai seperti `1000000`, `1.000.000`, atau nilai numeric Excel dihitung konsisten.
- Total pendapatan, total potongan, dan gaji bersih harus dihitung dari komponen hasil normalisasi baru.

## Temuan pada Implementasi Saat Ini

1. `app/Services/SlipPayloadNormalizer.js` sudah memiliki cabang khusus `exel-payslip`, tetapi masih menambahkan `Tunjangan BPJS Ketenagakerjaan` dan belum mengenali `Insentif` serta `BPJS Kesehatan`.
2. `buildExelPayslipPayload()` di `app/Controllers/Http/BulkPdfController.js` memakai `buildPayslipPayload()`, lalu menimpa `deductions` dengan `parseMoneyList(lower.deductions)`. Akibatnya, kolom potongan langsung seperti `BPJS Ketenagakerjaan` dan `PPH21` dapat hilang sebelum job dijalankan.
3. Bulk tracking saat ini hanya aktif untuk template BA, cooperation agreement, dan `event_weekly_payslip`. `exel-payslip` belum membuat batch.
4. `src/utils/templateFields.js` masih menampilkan field `tunjanganBpjsKetenagakerjaan` serta belum memiliki `insentif` dan `bpjsKesehatan` untuk `exel-payslip`.
5. Header `public/templates/exel-payslip.xlsx` masih menggunakan format komponen lama.
6. `SendSingleEmailForm.jsx` dapat memperoleh `exel-payslip` dari fallback `allowed_templates`, tetapi opsi statisnya belum ada.
7. Backend belum memiliki `POST /api/v1/send/exel-payslip` dan method `SingleEmailController.sendExelPayslip()`. Karena API frontend membentuk URL dari template, Send Single Email `exel-payslip` saat ini berpotensi mendapatkan 404.
8. `BatchHistoryPage.jsx` belum memiliki opsi/filter label `exel-payslip`.
9. Bulk Send Email `exel-payslip` saat ini adalah alur attachment: Excel email dipakai untuk mencari PDF yang sudah dihasilkan, bukan untuk membuat ulang komponen payroll.

## Rencana Implementasi Backend

### 1. Perbarui normalisasi payload khusus `exel-payslip`

File:

- `app/Services/SlipPayloadNormalizer.js`

Perubahan:

- Batasi perubahan pada cabang `normalizedTemplate === 'exel-payslip'`.
- Hapus mapping earning `Tunjangan BPJS Ketenagakerjaan`.
- Tambahkan mapping earning `Insentif`.
- Tambahkan mapping deduction `BPJS Kesehatan` sebelum `BPJS Ketenagakerjaan`.
- Canonical-kan label PPH menjadi `PPH21` untuk template ini.
- Hilangkan item legacy `Tunjangan BPJS Ketenagakerjaan` yang datang melalui `earnings` array/object agar tidak lolos ke renderer dan total.
- Hindari duplikasi ketika nilai yang sama dikirim melalui field langsung dan melalui `earnings`/`deductions`.
- Pastikan urutan output stabil sesuai daftar komponen baru. Bila membuat helper/konstanta daftar komponen, scope-kan khusus `exel-payslip` agar normalisasi `payslip`, `insentif`, `thr`, dan `event_weekly_payslip` tidak berubah.

Output normalizer yang perlu dicapai, secara konseptual:

```js
{
  earnings: [
    { label: 'Gaji Pokok', amount: 5000000 },
    { label: 'Tunjangan Makan', amount: 500000 },
    { label: 'Tunjangan Transport', amount: 300000 },
    { label: 'Tunjangan Sewa Motor', amount: 250000 },
    { label: 'Tunjangan Komunikasi', amount: 200000 },
    { label: 'Tunjangan Jabatan', amount: 400000 },
    { label: 'Insentif', amount: 600000 }
  ],
  deductions: [
    { label: 'BPJS Kesehatan', amount: 100000 },
    { label: 'BPJS Ketenagakerjaan', amount: 150000 },
    { label: 'PPH21', amount: 125000 }
  ]
}
```

### 2. Perbaiki builder Bulk Generate `exel-payslip`

File:

- `app/Controllers/Http/BulkPdfController.js`

Perubahan:

- Perbaiki `buildExelPayslipPayload()` agar membaca seluruh header komponen baru.
- Jangan mengubah daftar komponen di `buildPayslipPayload()` karena fungsi tersebut dipakai template lain.
- Pendekatan yang aman adalah membentuk ulang `earnings` dan `deductions` khusus `exel-payslip`, atau memfilter hasil builder umum lalu menambahkan komponen khusus. Pastikan hasil akhirnya tidak membawa `Tunjangan BPJS Ketenagakerjaan`.
- Jangan menimpa hasil potongan direct-column dengan `parseMoneyList(lower.deductions)` yang kosong. Gabungkan array opsional dengan kolom direct secara deduplicated.
- Baca `Insentif`, `BPJS Kesehatan`, `BPJS Ketenagakerjaan`, dan `PPH21` dari normalized header Excel.
- Pertahankan field identitas, periode, join date, PTKP, jumlah HK, attendance, note, callback, dan filename template yang sudah ada.
- Pertahankan validasi wajib `employeeName`, `position`, dan `period`.
- Untuk bulk final yang akan dicatat sebagai batch, `employeeId` perlu tersedia sebagai identitas item dan sebagai kunci lookup Bulk Send Email. Bila kosong, kembalikan error per baris yang jelas tanpa menggagalkan baris lain.

### 3. Aktifkan batch tracking untuk Bulk Generate `exel-payslip`

File utama:

- `app/Controllers/Http/BulkPdfController.js`

File yang perlu diverifikasi, tetapi kemungkinan tidak perlu diubah:

- `app/Jobs/GeneratePdfJob.js`
- `app/Controllers/Http/BatchController.js`

Perubahan:

- Masukkan `mode === 'exel-payslip'` ke kondisi `isBatchTrackedMode`.
- Buat satu `generation_batches` record untuk satu upload non-`dryRun`.
- Simpan `template: 'exel-payslip'`, `company_id` dari user login, `created_by`, total row, status, queued, dan failed menggunakan mekanisme batch existing.
- Buat `generation_batch_items` untuk setiap row, termasuk row yang gagal.
- Gunakan `employeeId` yang sudah dinormalisasi sebagai `match_key` untuk `exel-payslip`. Jangan gunakan nama karyawan sebagai satu-satunya kunci karena nama bisa sama atau berubah.
- Kirim `batchId` dan `batchItemId` ke `GeneratePdfJob` sehingga job existing dapat mengubah item menjadi success/failed dan menyimpan metadata file.
- Response non-`dryRun` harus berisi `batch_id`. Response `dryRun` tidak membuat record batch dan mengembalikan `batch_id: null`.
- Jangan membuat nomor surat untuk `exel-payslip`; logic `letterNo` tetap khusus template surat.
- Gunakan tabel batch existing. Tidak diperlukan migration atau tabel baru selama schema `generation_batches` dan `generation_batch_items` saat ini mencukupi.

### 4. Tambahkan dukungan Send Single Email `exel-payslip`

Files:

- `app/Controllers/Http/SingleEmailController.js`
- `start/routes.js`

Perubahan:

- Tambahkan method `sendExelPayslip(ctx)` yang memanggil alur generic dengan `cfgSlip('exel-payslip')`.
- Tambahkan route authenticated `POST /api/v1/send/exel-payslip`.
- Tambahkan required fields `employeeName`, `position`, dan `period` pada mapping `requiredFields()` untuk `exel-payslip`.
- Gunakan normalizer yang sama dengan Generate Single dan Bulk Generate agar komponen baru konsisten.
- Pastikan subject/body default menyebut slip gaji dan tidak jatuh ke perilaku template lain yang tidak sesuai.
- Sebelum generate dan enqueue email, pastikan `exel-payslip` diizinkan oleh `allowed_templates` company. Ikuti arti existing bahwa array kosong berarti semua template diizinkan.
- Jangan mengubah endpoint single email template lain kecuali refactor kecil yang benar-benar diperlukan untuk memakai validasi bersama.

### 5. Renderer PDF

File untuk diverifikasi:

- `app/Templates/exel-payslip.js`
- `resources/pdf-templates/exel-payslip.js`

Renderer saat ini sudah membaca `data.earnings` dan `data.deductions`, lalu menghitung subtotal dan net. Karena itu, perubahan renderer seharusnya tidak diperlukan apabila normalizer menghasilkan array canonical dengan benar.

Ubah `app/Templates/exel-payslip.js` hanya jika hasil verifikasi menunjukkan urutan/label masih berubah di renderer. Wrapper `resources/pdf-templates/exel-payslip.js` tidak perlu diubah selama masih me-require implementation yang sama.

### 6. Perbarui dokumentasi API

File:

- `API_DOCUMENTATION.md`

Update dokumentasi API wajib menjadi bagian dari implementasi, bukan pekerjaan opsional. Sesuaikan bagian-bagian berikut:

1. Daftar template yang didukung dan required fields untuk `exel-payslip`.
2. Contoh payload Generate Single PDF/preview dengan field payroll baru.
3. Dokumentasi endpoint baru `POST /api/v1/send/exel-payslip` beserta autentikasi, request body, required fields, dan contoh response queued.
4. Dokumentasi `POST /api/v1/bulk/exel-payslip`, termasuk form-data, header workbook baru, perilaku `dryRun`, error per row, dan response `batch_id`.
5. Dokumentasi Batch IDs untuk menjelaskan bahwa batch `exel-payslip` dapat diakses melalui:
   - `GET /api/v1/batches?template=exel-payslip`
   - `GET /api/v1/batches/:batch_id`
   - `GET /api/v1/batches/:batch_id/download`
6. Aturan akses batch: user/admin hanya untuk company sendiri, superadmin sesuai scope existing, dan request template tetap mengikuti `allowed_templates`.
7. Dokumentasi Bulk Send Email `exel-payslip` untuk menegaskan bahwa endpoint tetap `/api/v1/send-slip-emails`, menggunakan spreadsheet attachment-email existing, dan tidak menerima kolom komponen payroll untuk membuat ulang PDF.
8. Daftar komponen canonical baru serta penegasan bahwa `Tunjangan BPJS Ketenagakerjaan` tidak lagi menjadi earning.

Contoh data `exel-payslip` pada dokumentasi harus menggunakan key berikut:

```json
{
  "employeeName": "Budi",
  "employeeId": "EMP-001",
  "position": "Sales",
  "period": "September 2026",
  "gajiPokok": 5000000,
  "tunjanganMakan": 500000,
  "tunjanganTransport": 300000,
  "tunjanganSewaMotor": 250000,
  "tunjanganKomunikasi": 200000,
  "tunjanganJabatan": 400000,
  "insentif": 600000,
  "bpjsKesehatan": 100000,
  "bpjsKetenagakerjaan": 150000,
  "pph21": 125000
}
```

Ketentuan dokumentasi:

- Jangan meninggalkan contoh/header lama yang masih memuat `Tunjangan BPJS Ketenagakerjaan` sebagai earning `exel-payslip`.
- Bedakan dengan jelas `exel-payslip`, `payslip`, dan `event_weekly_payslip`; jangan mengubah kontrak template lain saat memperbarui contoh.
- Pastikan nama route, template key, kapitalisasi header Excel, dan bentuk response sama dengan source code hasil implementasi.
- Jika `README.md` memuat kontrak yang sama, sinkronkan ringkasannya agar tidak bertentangan dengan `API_DOCUMENTATION.md`; sumber dokumentasi API utama tetap `API_DOCUMENTATION.md`.

## Rencana Implementasi Frontend

### 1. Shared field map untuk Generate Single dan Send Single

File:

- `D:\eis\ui-pdf-generator\src\utils\templateFields.js`

Pada `templateFieldMap['exel-payslip']`:

- Hapus field `tunjanganBpjsKetenagakerjaan`.
- Tambahkan `{ name: 'insentif', label: 'Insentif', type: 'number' }` setelah Tunjangan Jabatan.
- Tambahkan `{ name: 'bpjsKesehatan', label: 'BPJS Kesehatan', type: 'number' }` sebelum BPJS Ketenagakerjaan.
- Gunakan label `PPH21` agar konsisten dengan format baru.
- Pertahankan field non-payroll dan required fields yang sudah ada.

Perubahan ini otomatis menjadi sumber field untuk `DynamicTemplateForm`, Generate Single PDF, dan Send Single Email. Jangan menambahkan field baru secara hard-coded secara terpisah pada kedua form.

### 2. Generate Single PDF

Files untuk diverifikasi:

- `D:\eis\ui-pdf-generator\src\components\forms\GeneratePdfForm.jsx`
- `D:\eis\ui-pdf-generator\src\components\forms\DynamicTemplateForm.jsx`

Expected behavior:

- Saat `exel-payslip` dipilih, form menampilkan tujuh field earning dan tiga field deduction baru sesuai urutan.
- Field `Tunjangan BPJS Ketenagakerjaan` tidak muncul.
- Preview dan submit mengirim key baru dari shared field map.
- Pilihan template tetap mengikuti `allowed_templates` company.

Tidak perlu mengubah kedua file ini apabila update shared field map sudah menghasilkan behavior tersebut.

### 3. Send Single Email

File:

- `D:\eis\ui-pdf-generator\src\components\forms\SendSingleEmailForm.jsx`

Perubahan:

- Tambahkan opsi statis `{ value: 'exel-payslip', label: 'Exel Payslip' }`.
- Tetap filter opsi berdasarkan `allowed_templates`; bila company memakai daftar kosong/unrestricted, opsi tetap harus muncul.
- Pastikan submit menuju endpoint generic `/api/v1/send/exel-payslip`.
- Form data payroll berasal dari `templateFieldMap['exel-payslip']`, sehingga field baru sama dengan Generate Single PDF.
- Preview harus tetap menggunakan `/api/v1/preview/exel-payslip` dan menampilkan komponen yang sama sebelum email dikirim.

`src/api/sendApi.js` sudah membentuk endpoint berdasarkan template dan seharusnya tidak perlu diubah.

### 4. Bulk Generate PDF dan template Excel

Files:

- `D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx`
- `D:\eis\ui-pdf-generator\public\templates\exel-payslip.xlsx`

Update `columnHintsByMode['exel-payslip']` dan baris header workbook menjadi:

```text
employeeId | employeeName | position | departement | periode | joinDate | ptkp | targetHK | attendance | Gaji Pokok | Tunjangan Makan | Tunjangan Transport | Tunjangan Sewa Motor | Tunjangan Komunikasi | Tunjangan Jabatan | Insentif | BPJS Kesehatan | BPJS Ketenagakerjaan | PPH21 | email
```

Ketentuan update workbook:

- Hapus header `Tunjangan BPJS Ketenagakerjaan`.
- Tambahkan `Insentif` pada kelompok earning.
- Tambahkan `BPJS Kesehatan` sebagai deduction pertama.
- Gunakan satu baris header dan pertahankan sheet name serta format workbook existing bila ada.
- Jangan mengubah file template Excel untuk mode lain.
- Link download `/templates/exel-payslip.xlsx` harus tetap sama agar bookmark/deployment existing tidak rusak.
- Field `email` tetap dipertahankan untuk kompatibilitas file existing, walaupun backend Bulk Generate saat ini menyimpan hasil pada folder email user login.

Saat backend mengembalikan `batch_id`, komponen hasil di `BulkGenerateForm.jsx` harus menampilkan tombol **Lihat Batch**. Mekanisme link sudah tersedia; verifikasi URL berisi `template=exel-payslip` dan `batch_id` yang baru.

### 5. Menu Batch IDs dan role/company scope

File:

- `D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx`

File backend untuk verifikasi akses:

- `app/Controllers/Http/BatchController.js`

Perubahan frontend:

- Tambahkan `{ value: 'exel-payslip', label: 'Exel Payslip' }` ke daftar filter batch.
- Pastikan deep link dari Bulk Generate membuka batch yang tepat.
- Untuk user/admin, pilihan template mengikuti `allowed_templates` company: tampilkan `exel-payslip` jika diizinkan, atau jika daftar allowed kosong yang berarti unrestricted.
- Untuk superadmin, pertahankan kemampuan melihat batch lintas company sesuai behavior endpoint existing.

Kontrak akses yang harus dipertahankan:

- User dan admin hanya dapat melihat detail/download batch milik `company_id` mereka.
- Superadmin dapat melihat batch lintas company dan memakai filter company yang tersedia di backend.
- Request Bulk Generate ditolak bila `exel-payslip` tidak ada pada `allowed_templates` company yang restricted.
- Data historis tetap terikat ke `company_id` saat batch dibuat. Mengubah `allowed_templates` tidak boleh memindahkan batch ke company lain.
- Akses langsung ke batch company lain harus tetap menghasilkan 403 meskipun user mengetahui `batch_id`.

Jika `BatchHistoryPage.jsx` membutuhkan data company untuk memfilter opsi, gunakan sumber konfigurasi company yang sama dengan form lain (`fetchCompanyApiKey`) atau ekstrak helper parser `allowed_templates` yang sudah berulang ke utility bersama. Jangan mengandalkan filtering UI sebagai pengamanan; backend tetap menjadi sumber otorisasi.

### 6. Bulk Send Email

Files untuk diverifikasi/diubah seperlunya:

- `D:\eis\ui-pdf-generator\src\components\forms\SendEmailsForm.jsx`
- `D:\eis\ui-pdf-generator\public\templates\send-exel-payslip-emails.xlsx`
- `app/Controllers/Http/BulkEmailController.js`

Keputusan scope:

- Bulk Send Email hanya mengirim PDF `exel-payslip` yang sudah dibuat. Fitur ini tidak membuat ulang payslip dari komponen payroll.
- Karena itu, jangan menambahkan kolom `Insentif`, `BPJS Kesehatan`, atau komponen payroll lain ke `send-exel-payslip-emails.xlsx`.
- Pertahankan kolom email existing: `sentTo`, `employeeId`, `employeeName`, `slipTitle`, `body`, `cc`, dan `bcc`.
- Pertahankan request `template=exel-payslip` ke `/api/v1/send-slip-emails`, kecuali ada task terpisah yang secara eksplisit memigrasikan email slip ke lookup berbasis batch.
- Update hint UI bila perlu agar menjelaskan bahwa attachment harus berasal dari Bulk/Single Generate `exel-payslip`.
- Pastikan lookup backend tetap mengenali filename `<periode>.exel-payslip.<employeeId>.<employeeName>.<unique>.pdf` dan hanya mencari di folder company/user login yang benar.
- Opsi `Exel Payslip` hanya tersedia bila sesuai `allowed_templates` company.

Batch tracking pada issue ini dipakai untuk histori/audit melalui menu **Batch IDs**. `batch_id` tidak dijadikan field wajib Bulk Send Email `exel-payslip` agar tidak mengubah workflow pengiriman slip existing tanpa requirement tambahan.

## File yang Diperkirakan Dimodifikasi

### Backend — wajib

1. `app/Services/SlipPayloadNormalizer.js`
2. `app/Controllers/Http/BulkPdfController.js`
3. `app/Controllers/Http/SingleEmailController.js`
4. `start/routes.js`
5. `test/unit/exel_payslip_template.spec.js`
6. `test/functional/api_endpoint_matrix.spec.js` atau functional test yang setara untuk route single/bulk
7. `API_DOCUMENTATION.md`

### Backend — verifikasi atau update dokumentasi

1. `app/Templates/exel-payslip.js`
2. `app/Jobs/GeneratePdfJob.js`
3. `app/Controllers/Http/BatchController.js`
4. `app/Controllers/Http/BulkEmailController.js`
5. `README.md`

### Frontend — wajib

1. `D:\eis\ui-pdf-generator\src\utils\templateFields.js`
2. `D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx`
3. `D:\eis\ui-pdf-generator\src\components\forms\SendSingleEmailForm.jsx`
4. `D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx`
5. `D:\eis\ui-pdf-generator\public\templates\exel-payslip.xlsx`
6. `D:\eis\ui-pdf-generator\src\utils\templateFields.test.js`
7. `D:\eis\ui-pdf-generator\src\components\forms\SendEmailsForm.test.jsx`

### Frontend — verifikasi/ubah bila behavior belum tercapai

1. `D:\eis\ui-pdf-generator\src\components\forms\GeneratePdfForm.jsx`
2. `D:\eis\ui-pdf-generator\src\components\forms\DynamicTemplateForm.jsx`
3. `D:\eis\ui-pdf-generator\src\components\forms\SendEmailsForm.jsx`
4. `D:\eis\ui-pdf-generator\src\api\sendApi.js`
5. `D:\eis\ui-pdf-generator\src\api\batchApi.js`

### File baru yang direkomendasikan bila coverage belum tersedia

Nama file boleh menyesuaikan konvensi test project:

1. `D:\eis\ui-pdf-generator\src\components\forms\SendSingleEmailForm.test.jsx`
2. `D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.test.jsx`
3. Backend functional/unit test khusus batch bulk `exel-payslip`, bila sulit dimasukkan ke file test existing.

Tidak ada production file atau migration baru yang diwajibkan.

## Urutan Implementasi yang Disarankan

1. Perbarui kontrak field dan normalizer backend.
2. Perbaiki builder Bulk Generate serta lakukan dry-run menggunakan header baru.
3. Aktifkan batch tracking dan verifikasi lifecycle batch item.
4. Tambahkan route/controller Send Single Email.
5. Perbarui shared field map frontend.
6. Perbarui hint Bulk Generate dan file `exel-payslip.xlsx`.
7. Tambahkan `exel-payslip` pada Send Single Email dan menu Batch IDs.
8. Verifikasi Bulk Send Email terhadap file PDF hasil generate baru.
9. Perbarui `API_DOCUMENTATION.md` dan sinkronkan ringkasan terkait di `README.md` bila ada.
10. Jalankan regression test template lain dan periksa ulang dokumentasi terhadap behavior aktual.

## Skenario Pengujian

Detail implementasi test diserahkan kepada programmer yang mengerjakan. Minimal skenario yang harus tercakup:

### Normalisasi dan PDF

- Payload `exel-payslip` dengan semua komponen baru menghasilkan tujuh earning dan tiga deduction dalam urutan yang benar.
- `Tunjangan BPJS Ketenagakerjaan` lama tidak muncul dan tidak ikut total.
- `Insentif` menambah total pendapatan.
- `BPJS Kesehatan` menambah total potongan.
- Gaji bersih sama dengan total pendapatan dikurangi total potongan.
- Angka dari field camelCase, header Excel, dan alias underscore menghasilkan nominal yang sama.
- Tidak ada label ganda ketika field direct dan array membawa komponen yang sama.

### Bulk Generate PDF

- File template Excel baru dapat diunduh dan diproses.
- Dry-run membaca seluruh header baru, tetapi tidak membuat batch.
- Generate final membuat satu `batch_id` dan item untuk semua row, termasuk metadata error untuk row gagal.
- Kolom deduction langsung dari Excel tidak hilang dari payload.
- `employeeId` kosong menghasilkan error row yang jelas.
- Response menampilkan `batch_id` dan tombol **Lihat Batch** membuka batch yang sesuai.

### Generate Single PDF dan Send Single Email

- Kedua form menampilkan `Insentif` dan `BPJS Kesehatan` serta tidak menampilkan `Tunjangan BPJS Ketenagakerjaan`.
- Preview, generate single, dan send single menghasilkan komponen serta total yang sama.
- `POST /api/v1/send/exel-payslip` menghasilkan PDF dan mengantrekan email ketika data valid.
- Company yang tidak diizinkan memakai `exel-payslip` tidak dapat mengirim request single secara langsung.

### Batch IDs dan otorisasi

- Batch `exel-payslip` muncul pada daftar/filter Batch IDs.
- User/admin hanya melihat batch company sendiri.
- Superadmin dapat melihat batch sesuai scope yang berlaku.
- User tidak dapat membuka atau mengunduh batch company lain dengan menebak `batch_id`.
- Filter/deep link `template=exel-payslip` bekerja.

### Bulk Send Email

- Opsi `Exel Payslip` mengikuti `allowed_templates`.
- File email existing menemukan attachment PDF `exel-payslip` hasil generate format baru berdasarkan employee ID/periode.
- Email tidak dikirim bila attachment tidak ditemukan dan error per row tetap informatif.
- Spreadsheet Bulk Send Email tidak membutuhkan kolom komponen payroll.

### Regression

- Generate dan email template `payslip`, `insentif`, `thr`, `event_weekly_payslip`, BA, dan cooperation agreement tetap berfungsi.
- Komponen baru `Insentif` generik dan `BPJS Kesehatan` tidak otomatis masuk ke template lain.
- Batch tracking template yang sudah ada tidak berubah.
- Nama file dan lookup attachment template lain tidak berubah.

## Acceptance Criteria

- [x] `exel-payslip` hanya memakai tujuh earning dan tiga deduction baru yang ditentukan pada issue ini.
- [x] `Tunjangan BPJS Ketenagakerjaan` tidak tampil dan tidak dihitung sebagai earning.
- [x] Bulk Generate PDF menerima workbook dengan header baru.
- [x] Generate Single PDF dan preview memakai field baru.
- [x] Send Single Email memiliki opsi, route backend, preview, dan payload `exel-payslip` yang berfungsi.
- [x] Bulk Send Email tetap dapat mengirim attachment `exel-payslip` tanpa menambahkan kolom payroll ke file email.
- [x] Bulk Generate non-`dryRun` mengembalikan `batch_id` dan mencatat seluruh item.
- [x] Batch dapat dilihat dari menu Batch IDs menggunakan filter/deep link `exel-payslip`.
- [x] Akses batch tetap company-scoped untuk user/admin dan sesuai hak superadmin.
- [x] `allowed_templates` tetap diberlakukan pada pilihan UI dan endpoint backend terkait.
- [x] `API_DOCUMENTATION.md` mendokumentasikan komponen baru, endpoint Send Single Email, header Bulk Generate, response batch, akses Batch IDs, dan behavior Bulk Send Email `exel-payslip`.
- [x] Tidak ada contoh `exel-payslip` yang masih mendokumentasikan `Tunjangan BPJS Ketenagakerjaan` sebagai earning.
- [x] Tidak ada migration baru karena tabel batch existing masih mencukupi.
- [x] Regression test template lain lulus.

## Out of Scope

- Mengganti key `exel-payslip` menjadi `excel-payslip`.
- Mengubah desain visual umum PDF selain yang diperlukan untuk label/urutan komponen.
- Mengubah schema database batch.
- Memigrasikan Bulk Send Email `exel-payslip` menjadi wajib memakai `batch_id`.
- Mengubah komponen payroll template selain `exel-payslip`.
- Mengubah aturan perhitungan pajak/BPJS; sistem hanya menerima nominal yang diberikan dan menghitung subtotal/net.
