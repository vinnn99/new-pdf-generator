# Issue: Bulk Generate Event Weekly Payslip Mendukung Kolom Tanggal Dinamis

## Ringkasan

Update fitur **Bulk Generate PDF** mode endpoint **Event Weekly Payslip** agar file `.xlsx` dapat berisi kolom pendapatan tanggal kerja lebih dari 7 hari.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Target utama:

- Saat membaca Excel untuk `event_weekly_payslip`, sistem harus mendeteksi semua header yang berbentuk tanggal.
- Setiap header tanggal dianggap sebagai item pendapatan harian.
- Jumlah item pendapatan tidak lagi dibatasi 7 hari.
- Jika header tanggal kurang dari 7, tampilkan sesuai jumlah header tanggal yang ada.

## Latar Belakang

Saat ini contoh template Excel untuk **Bulk Generate PDF** mode **Event Weekly Payslip** memakai header:

```text
NIK
employeeName
STATUS
AREA
JABATAN
NPWP
JUMLAH HK
PERIODE
DESKRIPSI
25/07/2026
26/07/2026
27/07/2026
28/07/2026
29/07/2026
30/07/2026
31/07/2026
ADJUSTMENT
POT TELAT
KASBON
email
callback_url
callback_header
```

Kolom `25/07/2026` sampai `31/07/2026` adalah tanggal employee bekerja. Nilai pada baris data di bawah tanggal tersebut adalah nominal yang dibayarkan untuk tanggal itu.

Masalahnya, dalam implementasi real, periode kerja bisa lebih dari 7 hari. Contoh:

```text
25/07/2026
26/07/2026
27/07/2026
28/07/2026
29/07/2026
30/07/2026
31/07/2026
01/08/2026
02/08/2026
03/08/2026
```

Sistem harus tetap memproses semua tanggal tersebut sebagai pendapatan.

## Scope

### Backend

1. Update parser Excel bulk `event_weekly_payslip` agar mendeteksi header tanggal secara dinamis.
2. Hilangkan batas 7 hari untuk pendapatan yang berasal dari header tanggal.
3. Pertahankan fallback 7 hari hanya untuk kondisi lama yang tidak memakai header tanggal dan hanya memakai pola `tgl1`, `tgl2`, dst.
4. Pastikan `visitEarnings` berisi semua tanggal yang ditemukan di header Excel, urut berdasarkan tanggal.
5. Jika header tanggal yang ditemukan kurang dari 7, jangan auto-pad menjadi 7; jumlah `visitEarnings` harus mengikuti jumlah header tanggal.
6. Pastikan nilai pendapatan tiap tanggal tetap diparse sebagai angka dengan format Indonesia maupun angka polos.
7. Pastikan `ADJUSTMENT`, `POT TELAT`, dan `KASBON` tetap masuk sebagai potongan, bukan pendapatan.
8. Pastikan batch tracking dan match key `employeeId|employeeName` tidak berubah.

### Frontend

1. Update informasi/hint template Bulk Generate untuk `event_weekly_payslip`.
2. Update file template contoh `.xlsx` agar memberi contoh bahwa kolom tanggal boleh ditambah.
3. Tidak perlu membuat mode baru. Tetap gunakan key `event_weekly_payslip`.

## Temuan Awal di Kode Saat Ini

Beberapa titik yang perlu diperhatikan saat implementasi:

- `app/Controllers/Http/BulkPdfController.js`
  - `_handleExcel()` membaca file memakai `XLSX.utils.sheet_to_json(sheet, { defval: '' })`.
  - `normalizeRow(row)` mengubah key/header menjadi lowercase.
  - `buildEventWeeklyPayslipPayload()` membuat `visitEarnings` lewat `buildEventVisitEarnings(lower, period)`.
  - `fillEventVisitEarnings()` saat ini melakukan `.slice(0, 7)` dan mengisi fallback sampai 7 item.

- `app/Services/SlipPayloadNormalizer.js`
  - Ada constant `EVENT_WEEKLY_VISIT_DAYS = 7`.
  - `normalizeEventVisitEarnings()` untuk key tanggal masih melakukan `dateKeyItems.slice(0, EVENT_WEEKLY_VISIT_DAYS)`.
  - Ini bisa ikut membatasi input tanggal jika alur normalizer dipakai di luar bulk controller.

- `app/Templates/event_weekly_payslip.js`
  - Template PDF sudah membangun tabel pendapatan dari `data.visitEarnings`.
  - Perlu tetap dicek visual PDF saat item pendapatan lebih dari 7, terutama page break dan total pendapatan.

## Detail Rencana Perubahan Backend

### 1. Buat helper deteksi header tanggal

File utama:

```text
app/Controllers/Http/BulkPdfController.js
```

Tambahkan helper yang tugasnya mendeteksi apakah sebuah header Excel adalah tanggal kerja.

Kriteria yang perlu didukung:

- String format `DD/MM/YYYY`, contoh `25/07/2026`.
- String format `DD-MM-YYYY`, contoh `25-07-2026`.
- String format ISO `YYYY-MM-DD`, contoh `2026-07-25`.
- Header dari Excel yang terbaca sebagai serial date number, jika memungkinkan.

Rekomendasi implementasi:

- Gunakan helper date yang sudah ada, misalnya `ExcelDateService.parse()`, lalu format kembali menjadi label `DD/MM/YYYY`.
- Tetap validasi ketat agar header seperti `JUMLAH HK`, `PERIODE`, `KASBON`, atau angka biasa yang bukan tanggal tidak ikut dianggap pendapatan.
- Batasi deteksi ini hanya untuk mode `event_weekly_payslip`.

Nama helper bebas, contoh:

```js
function parseEventWeeklyDateHeader(header) {
  // return { sort, label } jika valid tanggal
  // return null jika bukan tanggal
}
```

### 2. Update `buildEventVisitEarnings()`

File:

```text
app/Controllers/Http/BulkPdfController.js
```

Ubah logic:

- Ambil semua key dari `lower`.
- Filter key yang valid sebagai header tanggal.
- Map menjadi item:

```js
{
  date: '25/07/2026',
  amount: toNumber(lower[key]),
  sort: timestampTanggal
}
```

- Sort ascending berdasarkan tanggal.
- Jika ada minimal 1 header tanggal, return semua item tanggal tersebut.
- Jangan panggil helper yang memotong menjadi 7 item.

Expected behavior:

```text
Header tanggal 7 hari  -> visitEarnings.length = 7
Header tanggal 10 hari -> visitEarnings.length = 10
Header tanggal 14 hari -> visitEarnings.length = 14
Header tanggal 3 hari  -> visitEarnings.length = 3
```

Fallback lama tetap boleh:

- Jika tidak ada header tanggal, sistem boleh membentuk fallback dari `tgl1` sampai `tgl7`.
- Fallback ini boleh tetap 7 karena hanya untuk backward compatibility.

### 3. Update `fillEventVisitEarnings()`

File:

```text
app/Controllers/Http/BulkPdfController.js
```

Saat ini helper ini memotong:

```js
slice(0, 7)
```

Perubahan yang disarankan:

- Tambahkan parameter `targetLength`.
- Untuk data yang berasal dari header tanggal, `targetLength` harus mengikuti jumlah header tanggal.
- Untuk fallback `tgl1` sampai `tgl7`, `targetLength` tetap 7.
- Jangan auto-pad data header tanggal menjadi 7 atau memotongnya menjadi 7.
- Jika header tanggal hanya 3 kolom, hasil pendapatan hanya 3 baris.

### 4. Samakan normalizer service

File:

```text
app/Services/SlipPayloadNormalizer.js
```

Update bagian `normalizeEventVisitEarnings()` agar behavior-nya konsisten dengan bulk controller:

- Jika `visitEarnings` eksplisit dikirim, jumlah item mengikuti input.
- Jika source data berisi key tanggal, ambil semua key tanggal, bukan hanya 7.
- Hapus atau hindari `dateKeyItems.slice(0, EVENT_WEEKLY_VISIT_DAYS)` untuk jalur header tanggal.
- Constant `EVENT_WEEKLY_VISIT_DAYS = 7` masih boleh dipakai untuk fallback ketika tidak ada tanggal eksplisit.

Tujuannya agar single generate, preview, atau alur lain yang memakai normalizer juga tidak memotong pendapatan lebih dari 7 tanggal.

### 5. Cek template PDF

File:

```text
app/Templates/event_weekly_payslip.js
```

Pastikan template tetap benar saat `visitEarnings.length > 7`:

- Semua tanggal tampil di section `PENDAPATAN`.
- Subtotal pendapatan menghitung semua tanggal.
- Total pendapatan, total potongan, dan gaji bersih memakai semua item.
- PDF tetap readable jika pendapatan 10-14 baris.

Jika layout sudah aman, tidak perlu refactor besar. Jika tabel terlalu panjang, cukup pastikan pdfmake dapat memecah halaman secara natural.

### 6. Update dokumentasi backend

File yang perlu dicek:

```text
API_DOCUMENTATION.md
README.md
```

Update bagian Bulk Generate `event_weekly_payslip`:

- Jelaskan bahwa header tanggal tidak dibatasi 7 hari.
- Jelaskan format tanggal header yang didukung.
- Jelaskan bahwa setiap header tanggal menjadi item pendapatan.
- Jelaskan bahwa kolom non-tanggal tetap memakai field tetap seperti `ADJUSTMENT`, `POT TELAT`, `KASBON`, `callback_url`, dan `callback_header`.

### 7. Update generator template Excel backend

File:

```text
scripts/create-bulk-template.js
resources/templates/event_weekly_payslip-bulk-template.xlsx
```

Update contoh agar lebih jelas:

- Template contoh boleh tetap memakai 7 tanggal supaya tidak terlalu lebar.
- Tambahkan catatan di dokumentasi bahwa user boleh menambah kolom tanggal setelah tanggal terakhir.
- Jika ingin contoh eksplisit, tambahkan 1-2 tanggal tambahan di template contoh, misalnya `01/08/2026` dan `02/08/2026`.

Jangan hardcode jumlah maksimal tanggal di generator.

## Detail Rencana Perubahan Frontend

### 1. Update hint kolom Bulk Generate

File:

```text
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
```

Bagian `columnHintsByMode.event_weekly_payslip` saat ini menampilkan contoh 7 tanggal.

Update hint agar user paham kolom tanggal boleh ditambah:

- Tetap tampilkan contoh tanggal.
- Tambahkan hint seperti:

```text
Kolom tanggal pendapatan boleh ditambah sesuai periode, contoh 01/08/2026, 02/08/2026, dst.
```

Pastikan hint tidak membuat user mengira hanya 7 tanggal yang didukung.

### 2. Update file template download frontend

File:

```text
D:\eis\ui-pdf-generator\public\templates\event_weekly_payslip.xlsx
```

Update template download:

- Header dasar tetap sama.
- Kolom tanggal tetap diletakkan setelah `DESKRIPSI`.
- Boleh tambahkan contoh lebih dari 7 tanggal, atau tetap 7 tanggal dengan catatan di UI/dokumentasi.
- Kolom `ADJUSTMENT`, `POT TELAT`, `KASBON`, `email`, `callback_url`, `callback_header` tetap setelah semua kolom tanggal.

## File yang Kemungkinan Perlu Dimodifikasi

Backend:

```text
app/Controllers/Http/BulkPdfController.js
app/Services/SlipPayloadNormalizer.js
app/Templates/event_weekly_payslip.js
scripts/create-bulk-template.js
API_DOCUMENTATION.md
README.md
resources/templates/event_weekly_payslip-bulk-template.xlsx
```

Frontend:

```text
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
D:\eis\ui-pdf-generator\public\templates\event_weekly_payslip.xlsx
```

File test yang kemungkinan perlu diupdate atau ditambah:

```text
test/unit/event_weekly_payslip_template.spec.js
test/unit/excel_date_normalizer.spec.js
test/functional/api_endpoint_matrix.spec.js
```

Tidak wajib membuat file service baru. Jika implementer ingin merapikan parsing tanggal agar reusable, boleh buat helper kecil, misalnya:

```text
app/Services/EventWeeklyPayslipExcelService.js
```

Namun jangan buat abstraksi besar jika perubahan cukup selesai di controller dan normalizer.

## Acceptance Criteria

1. Bulk generate `event_weekly_payslip` berhasil memproses Excel dengan 7 kolom tanggal seperti format lama.
2. Bulk generate `event_weekly_payslip` berhasil memproses Excel dengan kurang dari 7 kolom tanggal.
3. Bulk generate `event_weekly_payslip` berhasil memproses Excel dengan lebih dari 7 kolom tanggal.
4. Semua header tanggal pada Excel masuk ke `payload.data.visitEarnings`.
5. Jika Excel hanya punya 3 header tanggal, `visitEarnings.length = 3` dan PDF hanya menampilkan 3 baris pendapatan tanggal.
6. Urutan `visitEarnings` mengikuti urutan tanggal ascending, bukan urutan random object key.
7. Nominal di bawah header tanggal masuk sebagai amount pendapatan tanggal tersebut.
8. `ADJUSTMENT`, `POT TELAT`, dan `KASBON` tetap dihitung sebagai potongan.
9. Total pendapatan di PDF menghitung seluruh tanggal, bukan hanya 7 tanggal pertama.
10. Batch generate tetap membuat `batch_id` untuk `event_weekly_payslip`.
11. `generation_batch_items.match_key` tetap memakai `employeeId|employeeName`.
12. Existing format lama dengan 7 tanggal tidak berubah behavior-nya.
13. UI Bulk Generate tidak lagi memberi kesan bahwa tanggal pendapatan dibatasi atau harus tepat 7 hari.
14. Template Excel download tetap kompatibel dengan backend.

## Skenario Test yang Perlu Dilakukan

Backend:

- Bulk generate `event_weekly_payslip` dengan Excel 7 tanggal.
- Bulk generate `event_weekly_payslip` dengan Excel 3 tanggal.
- Bulk generate `event_weekly_payslip` dengan Excel 10 tanggal.
- Bulk generate `event_weekly_payslip` dengan Excel 14 tanggal.
- Header tanggal campuran format `DD/MM/YYYY`, `DD-MM-YYYY`, dan `YYYY-MM-DD`.
- Nilai pendapatan memakai format `295000`, `295.000`, dan kosong.
- Kolom potongan tetap diproses benar setelah jumlah tanggal bertambah.
- Batch history dan match key tetap terbentuk.
- PDF hasil generate menampilkan semua tanggal dan totalnya benar.

Frontend:

- Bulk Generate menampilkan mode `Event Weekly Payslip`.
- Hint kolom menjelaskan bahwa kolom tanggal bisa lebih dari 7.
- File template download bisa dipakai untuk generate bulk.
- Upload Excel dengan lebih dari 7 tanggal dari UI berhasil sampai backend.

## Catatan Implementasi

- Gunakan template key existing: `event_weekly_payslip`.
- Jangan membuat endpoint baru.
- Jangan mengubah format field utama selain logic pendeteksian header tanggal.
- Jangan hardcode maksimal 7 tanggal untuk data yang berasal dari header tanggal.
- Jangan hardcode minimal 7 tanggal untuk data yang berasal dari header tanggal.
- Pertahankan fallback 7 hari hanya untuk pola lama tanpa header tanggal.
- Hindari refactor besar karena target issue ini spesifik pada dynamic date earnings di bulk Excel.
