# Issue Planning: Template `event_weekly_payslip`

## Status
Draft perencanaan untuk diimplementasikan oleh junior programmer atau AI model biaya rendah.

## Informasi Umum
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Template baru: `event_weekly_payslip`
- Basis tampilan: mirip template `payslip` existing.
- Logo wajib: `core.pdf-generator.indinesia.id/resources/images/exel-logo.png`
- Default nama perusahaan: `PT. EXEL INTEGRASI SOLUSINDO`

## Tujuan
Membuat template PDF slip gaji mingguan event dengan komponen pendapatan harian selama 7 hari kerja, komponen potongan khusus event, dan dukungan penuh di flow generate PDF single, bulk generate, send single email, dan bulk send email.

## Scope Backend

### 1. Template PDF Baru
Buat template baru:
- `app/Templates/event_weekly_payslip.js`
- `resources/pdf-templates/event_weekly_payslip.js`

Gunakan `app/Templates/payslip.js` sebagai referensi awal, tetapi sesuaikan kebutuhan berikut:
- Gunakan logo `resources/images/exel-logo.png`.
- Default `companyName` menjadi `PT. EXEL INTEGRASI SOLUSINDO`.
- Teks judul slip di bawah nama perusahaan harus `SLIP GAJI`.
- Di bawah periode, tampilkan field `description` atau alias `deskripsi`.
- Bagian `PENDAPATAN` berisi tanggal kunjungan sebagai komponen penambah.
- Bagian `POTONGAN` berisi:
  - `ADJ/DEDUCTION`
  - `PO TELAT`
  - `KASBON`

Contoh tampilan bagian `PENDAPATAN`:

```text
25/07/2026 : 0
26/07/2026 : 0
27/07/2026 : 295.000
28/07/2026 : 295.000
...
sebanyak 7 hari kerja
```

Catatan implementasi:
- Gunakan format rupiah yang konsisten dengan payslip existing.
- Untuk input single/manual, tanggal kunjungan direpresentasikan sebagai array `visitEarnings`.
- Setiap item `visitEarnings` memakai field `tgl_date` dan `tgl_value`.
- Field datar seperti `tgl1`, `tgl2`, sampai `tgl7` hanya dipakai untuk parsing bulk Excel bila masih dibutuhkan sebagai kompatibilitas.
- Template tetap harus menghitung total pendapatan, total potongan, dan net pay.

### 2. Payload yang Disarankan
Payload single/template:

```json
{
  "template": "event_weekly_payslip",
  "email": "user@example.com",
  "data": {
    "companyName": "PT. EXEL INTEGRASI SOLUSINDO",
    "employeeName": "Nama Karyawan",
    "employeeId": "NIK",
    "status": "STATUS",
    "area": "AREA",
    "position": "JABATAN",
    "npwp": "NPWP",
    "jumlahHK": 7,
    "period": "25/07/2026 - 31/07/2026",
    "description": "Deskripsi event",
    "visitEarnings": [
      { "tgl_date": "2026-07-25", "tgl_value": 0 },
      { "tgl_date": "2026-07-26", "tgl_value": 0 },
      { "tgl_date": "2026-07-27", "tgl_value": 295000 }
    ],
    "adjustment": 0,
    "poTelat": 0,
    "kasbon": 0
  }
}
```

Field penting:
- `employeeName` untuk nama karyawan, wajib.
- `employeeId` atau `nik` untuk NIK.
- `status`, `area`, `position` atau `jabatan`, `npwp`.
- `jumlahHK` untuk jumlah hari kerja.
- `period` atau `periode`.
- `description` atau `deskripsi`.
- `visitEarnings` untuk daftar 7 tanggal kunjungan dan nominalnya.
- `adjustment`, `poTelat`, `kasbon` untuk potongan.

### 3. Normalisasi Payload
Cek dan sesuaikan service berikut:
- `app/Services/SlipPayloadNormalizer.js`
- `app/Services/PayloadDateNormalizer.js`
- `app/Services/TemplateResolver.js`

Rencana:
- Tambahkan `event_weekly_payslip` sebagai slip-like template.
- Normalisasi alias umum:
  - `nik` -> `employeeId`
  - `jabatan` -> `position`
  - `periode` -> `period`
  - `deskripsi` -> `description`
  - `jumlah hk` atau `jumlah_hk` -> `jumlahHK`
  - `adjustment`, `adj/deduction`, `adj deduction` -> `adjustment`
  - `pot telat`, `po telat` -> `poTelat`
  - `kasbon` -> `kasbon`
- Pastikan angka dari Excel dapat dibaca meski berformat teks atau rupiah.
- Pastikan header tanggal Excel untuk kolom pendapatan tidak bergeser karena timezone.

### 4. Bulk Generate Excel
Tambahkan endpoint bulk baru:
- `POST /api/v1/bulk/event_weekly_payslip`

File yang kemungkinan disentuh:
- `start/routes.js`
- `app/Controllers/Http/BulkPdfController.js`
- `scripts/create-bulk-template.js` jika template Excel dibuat lewat script
- `resources/templates/*` jika backend menyimpan contoh template bulk

Header Excel yang diminta:

```text
| NIK | STATUS | AREA | JABATAN | NPWP | JUMLAH HK | PENDAPATAN                                      | POTONGAN                   |
|     |        |      |         |      |           | 25/07/2026 | 26/07/2026 | ... | 31/07/2026 | ADJUSTMENT | POT TELAT | KASBON |
| {{Row Data}} |
```

Catatan implementasi:
- Karena `xlsx.sheet_to_json` biasanya membaca header satu baris, implementor perlu menentukan strategi parsing header bertingkat.
- Opsi yang disarankan: buat template Excel dengan header teknis satu baris yang mudah dibaca backend, lalu beri baris visual/group header di atasnya jika diperlukan.
- Header teknis yang disarankan untuk parsing:
  - `NIK`
  - `STATUS`
  - `AREA`
  - `JABATAN`
  - `NPWP`
  - `JUMLAH HK`
  - `25/07/2026`
  - `26/07/2026`
  - `27/07/2026`
  - `28/07/2026`
  - `29/07/2026`
  - `30/07/2026`
  - `31/07/2026`
  - `ADJUSTMENT`
  - `POT TELAT`
  - `KASBON`
- Kolom pendapatan memakai tanggal sebagai header; nilai barisnya adalah nominal pendapatan pada tanggal tersebut.
- Pastikan hasil parsing menjadi `visitEarnings` berisi 7 item.

### 5. Generate PDF Single
Pastikan template bisa dipakai dari endpoint existing:
- `POST /api/v1/generate-pdf`
- `POST /api/v1/preview/event_weekly_payslip` jika preview mendukung static template seperti payslip.

Perlu dicek:
- `TemplateResolver` dapat menemukan file `resources/pdf-templates/event_weekly_payslip.js`.
- `allowed_templates` company bisa mengizinkan `event_weekly_payslip`.
- Nama file hasil generate memakai format slip-like agar mudah ditemukan untuk pengiriman email bulk.

### 6. Send Single Email
Tambahkan endpoint kirim single email:
- `POST /api/v1/send/event_weekly_payslip`

File yang kemungkinan disentuh:
- `start/routes.js`
- `app/Controllers/Http/SingleEmailController.js`

Rencana:
- Gunakan pola `cfgSlip` existing.
- Subject default dapat berupa `SLIP GAJI - {employeeName}`.
- Body default mirip payslip, tetapi menyebut slip gaji mingguan/event.
- Required field minimal mengikuti kebutuhan template, jangan terlalu ketat agar masih bisa dipakai lewat `data_json`.

### 7. Bulk Send Email
Tambahkan dukungan bulk send email untuk attachment `event_weekly_payslip`.

File yang kemungkinan disentuh:
- `app/Controllers/Http/BulkEmailController.js`
- `start/routes.js`
- `app/Jobs/GeneratePdfJob.js` jika pola filename slip perlu diperluas

Rencana:
- Tentukan apakah `event_weekly_payslip` masuk flow `send-slip-emails` existing atau dibuat mode/endpoint khusus.
- Rekomendasi: jadikan `event_weekly_payslip` sebagai slip-like template, sehingga attachment bisa dicari bersama slip lain berdasarkan periode, template, NIK, dan nama.
- Pastikan pencarian attachment mengenali nama file dengan template `event_weekly_payslip`.
- Jika perlu endpoint khusus, gunakan nama yang jelas:
  - `POST /api/v1/send-event-weekly-payslip-emails`

## Scope Frontend

### 1. Template Field Map
Tambahkan template baru di:
- `src/utils/templateFields.js`

Rencana field untuk Generate Single PDF dan Send Single Email:
- `employeeName` wajib
- `employeeId` atau `nik`
- `status`
- `area`
- `position` atau `jabatan`
- `npwp`
- `jumlahHK`
- `period` atau `periode`
- `description` atau `deskripsi`
- `visitEarnings` berupa array item `{ tgl_date, tgl_value }`
- `adjustment`
- `poTelat`
- `kasbon`

Pastikan label yang tampil ramah untuk user, misalnya:
- `NIK`
- `STATUS`
- `AREA`
- `JABATAN`
- `NPWP`
- `JUMLAH HK`
- `PENDAPATAN`, dengan input baris tanggal kunjungan dan nominal
- `ADJ/DEDUCTION`
- `PO TELAT`
- `KASBON`

### 2. Bulk Generate PDF
Tambahkan pilihan mode di:
- `src/components/forms/BulkGenerateForm.jsx`

Rencana:
- Tambah mode `event_weekly_payslip`.
- Tambah link template Excel:
  - `/templates/event_weekly_payslip.xlsx`
- Tambah column hints sesuai header Excel yang diminta.
- Pastikan filter `allowed_templates` tetap bekerja.

### 3. Generate Single PDF
Pastikan template muncul dan bisa dipakai di:
- `src/components/forms/GeneratePdfForm.jsx`

Rencana:
- Jika form mengambil opsi dari `templateFields`, cukup pastikan template baru masuk `templates` dan `templateFieldMap`.
- Pastikan preview PDF tetap bekerja untuk template baru.
- Pastikan payload yang dikirim memakai `template: "event_weekly_payslip"`.

### 4. Send Single Email
Tambahkan dukungan di:
- `src/components/forms/SendSingleEmailForm.jsx`
- `src/api/sendApi.js` jika ada mapping endpoint khusus

Rencana:
- Tambah pilihan template `event_weekly_payslip`.
- Kirim ke endpoint `/v1/send/event_weekly_payslip`.
- Pastikan data form masuk ke `data` dengan struktur yang diterima backend.

### 5. Bulk Send Email
Tambahkan dukungan di:
- `src/components/forms/SendEmailsForm.jsx`
- `src/api/bulkApi.js`

Rencana:
- Jika memakai mode slip existing, pastikan user bisa memilih atau mengirim template `event_weekly_payslip`.
- Jika backend membuat endpoint khusus, tambah mode `event_weekly_payslip`, endpoint, template download, dan column hints.
- Tambah template Excel untuk bulk send:
  - `/templates/send-event-weekly-payslip-emails.xlsx` jika endpoint khusus dibuat.
- Pastikan flow pencarian batch/attachment jelas bagi user.

## File yang Kemungkinan Disentuh

Backend:
- `app/Templates/event_weekly_payslip.js`
- `resources/pdf-templates/event_weekly_payslip.js`
- `resources/images/exel-logo.png`
- `app/Services/SlipPayloadNormalizer.js`
- `app/Services/PayloadDateNormalizer.js`
- `app/Services/TemplateResolver.js`
- `app/Controllers/Http/BulkPdfController.js`
- `app/Controllers/Http/SingleEmailController.js`
- `app/Controllers/Http/BulkEmailController.js`
- `app/Jobs/GeneratePdfJob.js`
- `start/routes.js`
- `scripts/create-bulk-template.js`
- `resources/templates/event_weekly_payslip.xlsx`
- `public/download/*` hanya untuk output generate manual

Frontend:
- `src/utils/templateFields.js`
- `src/components/forms/BulkGenerateForm.jsx`
- `src/components/forms/GeneratePdfForm.jsx`
- `src/components/forms/SendSingleEmailForm.jsx`
- `src/components/forms/SendEmailsForm.jsx`
- `src/api/bulkApi.js`
- `src/api/sendApi.js`
- `public/templates/event_weekly_payslip.xlsx`
- `public/templates/send-event-weekly-payslip-emails.xlsx` jika endpoint bulk send khusus dibuat

## Contoh PDF
Setelah implementasi selesai, buat contoh PDF hasil generate untuk validasi manual.

Output yang disarankan:
- `output/event_weekly_payslip.sample.pdf`

Data contoh:
- Company: `PT. EXEL INTEGRASI SOLUSINDO`
- Judul: `SLIP GAJI`
- Periode: `25/07/2026 - 31/07/2026`
- Deskripsi: isi contoh bebas yang representatif
- Tanggal pendapatan:
  - `25/07/2026`: `0`
  - `26/07/2026`: `0`
  - `27/07/2026`: `295000`
  - `28/07/2026`: `295000`
  - lanjutkan sampai total 7 hari kerja
- Potongan:
  - `ADJ/DEDUCTION`
  - `PO TELAT`
  - `KASBON`

## Skenario Test
Bagian ini sengaja hanya berisi skenario high-level. Detail mock, assertion granular, fixture, dan struktur test diserahkan ke implementor.

- Generate single PDF `event_weekly_payslip` berhasil dan memakai logo Exel.
- PDF menampilkan default company `PT. EXEL INTEGRASI SOLUSINDO` saat `companyName` tidak dikirim.
- PDF menampilkan judul `SLIP GAJI`, periode, dan deskripsi.
- Bagian `PENDAPATAN` menampilkan 7 tanggal kunjungan dan nominal masing-masing.
- Bagian `POTONGAN` menampilkan `ADJ/DEDUCTION`, `PO TELAT`, dan `KASBON`.
- Total pendapatan, total potongan, dan net pay dihitung benar.
- Bulk generate membaca Excel event weekly payslip dan menghasilkan payload yang benar.
- Generate bulk tetap menghormati `allowed_templates`.
- Send single email menghasilkan PDF dan enqueue email dengan attachment.
- Bulk send email bisa menemukan attachment hasil generate dan mengirim ke penerima.
- Frontend menampilkan `event_weekly_payslip` di Bulk Generate PDF, Generate Single PDF, Send Single Email, dan Bulk Send Email.
- Link download template Excel tersedia dan file-nya ada.
- Perubahan tidak merusak template `payslip`, `insentif`, dan `thr` existing.

## Acceptance Criteria
- Template `event_weekly_payslip` tersedia di backend.
- Logo pada PDF memakai `resources/images/exel-logo.png`.
- Default nama perusahaan adalah `PT. EXEL INTEGRASI SOLUSINDO`.
- Judul slip tampil sebagai `SLIP GAJI`.
- Deskripsi tampil di bawah periode.
- Komponen pendapatan berasal dari 7 tanggal kunjungan.
- Komponen potongan adalah `ADJ/DEDUCTION`, `PO TELAT`, dan `KASBON`.
- Bulk generate Excel untuk `event_weekly_payslip` tersedia.
- Hasil bulk generate `event_weekly_payslip` tersedia di halaman Batch IDs.
- Frontend mendukung template baru di semua flow yang diminta.
- Contoh PDF `output/event_weekly_payslip.sample.pdf` tersedia untuk validasi manual.
- Instruksi test di dokumen ini tetap berupa skenario high-level, bukan detail implementasi unit test.
