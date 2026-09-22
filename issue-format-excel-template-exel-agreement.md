# Issue: Tambahkan Format dan Download Template Excel `exel_cooperation_agreement` di Bulk Generate

## Ringkasan

Lengkapi halaman frontend `/bulk-generate` agar saat pengguna memilih **Exel Cooperation Agreement**:

- panel **Format kolom Excel - Exel Cooperation Agreement** tampil;
- daftar kolom yang ditampilkan sama dengan format `cooperation_agreement`;
- tombol **Unduh template Exel Cooperation Agreement** tampil dan mengunduh file Excel yang valid;
- file hasil download dapat langsung dipakai untuk dry run maupun bulk generate `exel_cooperation_agreement`.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Gunakan key template persis `exel_cooperation_agreement`. Penulisan **Exel** mengikuti nama template dan label yang sudah digunakan aplikasi saat ini.

## Masalah

Pada `/bulk-generate`, pilihan **Exel Cooperation Agreement** sudah tersedia, tetapi pengguna belum mendapatkan panel format kolom dan download template Excel seperti pada pilihan **Cooperation Agreement**.

Hasil pemeriksaan kondisi kode saat issue dibuat:

- `src/components/forms/BulkGenerateForm.jsx` sudah memiliki opsi `exel_cooperation_agreement`;
- mapping URL download sudah menunjuk ke `/templates/exel_cooperation_agreement.xlsx`;
- `columnHintsByMode` baru memiliki key `cooperation_agreement`, belum memiliki `exel_cooperation_agreement`;
- panel format dan tombol download hanya dirender jika `columnHintsByMode[selectedMode]` tersedia, sehingga tombol EXEL tidak muncul walaupun URL-nya sudah dimapping;
- file `ui-pdf-generator/public/templates/exel_cooperation_agreement.xlsx` belum tersedia, sehingga URL tersebut juga akan menghasilkan file tidak ditemukan jika diakses langsung;
- endpoint backend `POST /api/v1/bulk/exel_cooperation_agreement` dan parser payload-nya sudah tersedia serta memakai struktur data cooperation agreement;
- generator template backend baru memiliki definisi `cooperation_agreement`, belum memiliki definisi/artefak khusus `exel_cooperation_agreement`.

## Tujuan

1. Menampilkan informasi format kolom Excel untuk `exel_cooperation_agreement` di `/bulk-generate`.
2. Menyediakan file Excel yang dapat diunduh dari halaman tersebut.
3. Menjaga header EXEL sama dengan kontrak input bulk `cooperation_agreement`.
4. Menggunakan contoh/default EXEL tanpa mengubah perilaku `cooperation_agreement` yang sudah ada.
5. Mengurangi duplikasi daftar kolom agar perubahan format cooperation agreement berikutnya lebih mudah disinkronkan ke varian EXEL.

## Di Luar Scope

- Mengubah layout atau isi PDF Cooperation Agreement.
- Mengubah mekanisme penomoran surat.
- Mengubah proses Bulk Send Email atau template Excel email.
- Mengubah endpoint bulk yang sudah ada.
- Refactor besar halaman `/bulk-generate`.

## Kontrak Format Excel

Header template `exel_cooperation_agreement` harus sama dan berurutan seperti template `cooperation_agreement` yang aktif saat implementasi. Berdasarkan kontrak saat issue dibuat, header-nya adalah:

```text
companyName
logoUrl
logoPath
firstPartyName
firstPartyTitle
partnerName
partnerNationality
partnerIdentityNumber
partnerBirthPlace
partnerBirthDate
partnerAddress
partnerPhone
partnerEmail
brand
salary
transportAllowance
transportAllowanceUnit
mealAllowance
mealAllowanceUnit
phoneAllowance
phoneAllowanceUnit
operationalCostAllowance
operationalCostAllowanceUnit
tlAllowance
tlAllowanceUnit
partnerBankAccountNumber
partnerBankAccountName
partnerBankName
agreementDuration
workHoursPerDay
placementArea
picName
picTitle
picEmail
picAddress
letterDate
location
directorSignatureUrl
partnerSignatureUrl
email
callback_url
callback_header
data_json
```

### Kolom wajib

Backend saat ini memvalidasi kolom data berikut sebagai wajib:

```text
firstPartyName
firstPartyTitle
partnerName
partnerNationality
partnerIdentityNumber
partnerBirthPlace
partnerBirthDate
partnerAddress
partnerPhone
partnerEmail
brand
salary
partnerBankAccountNumber
partnerBankAccountName
partnerBankName
agreementDuration
workHoursPerDay
placementArea
picName
picTitle
picEmail
picAddress
```

Kolom tunjangan boleh kosong, tetapi jika diisi nilainya harus dapat diproses sebagai angka. Kolom satuan tunjangan mengikuti pasangan kolom tunjangan masing-masing.

### Default dan contoh data EXEL

- `companyName` boleh kosong karena backend memiliki default `PT. EXEL INTEGRASI SOLUSINDO`; pada baris contoh sebaiknya isi nilai tersebut agar pengguna memahami konteks template.
- `logoUrl` dan `logoPath` boleh kosong. Jika keduanya kosong, backend menggunakan logo default EXEL `resources/images/logo-old.png`.
- Contoh tanggal gunakan format yang tidak ambigu, misalnya `2026-01-31`.
- Nomor identitas, nomor telepon, dan nomor rekening pada baris contoh sebaiknya disimpan sebagai teks agar leading zero atau digit panjang tidak berubah.
- `callback_header` dan `data_json`, bila diisi, harus berupa JSON string yang valid, misalnya `{}`.
- Jangan menambah `letterNo` ke header file. Nomor surat untuk flow ini dibuat oleh backend. UI boleh tetap menampilkan catatan bahwa `letterNo` tidak perlu diisi.

## Rencana Implementasi

### 1. Frontend: tampilkan format kolom EXEL

File:

```text
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
```

Perubahan:

- Tambahkan `columnHintsByMode.exel_cooperation_agreement`.
- Gunakan daftar field yang sama dengan `cooperation_agreement`.
- Sesuaikan teks default yang bersifat branding:
  - company default: `PT. EXEL INTEGRASI SOLUSINDO`;
  - logo default: `resources/images/logo-old.png`.
- Pertahankan mapping yang sudah ada:

```js
exel_cooperation_agreement: '/templates/exel_cooperation_agreement.xlsx'
```

- Disarankan mengekstrak daftar kolom cooperation agreement ke konstanta bersama agar kedua mode tidak mempunyai dua array panjang yang mudah berbeda. Teks hint branding dapat dibuat melalui factory/helper kecil atau override dua item pertama.
- Pastikan kondisi render panel tetap aman untuk mode lain dan tidak mengubah filter `allowed_templates`.

Contoh arah struktur, tidak wajib diikuti persis:

```js
const cooperationAgreementColumnHints = (companyName, logoPath) => [
  `companyName (default: ${companyName})`,
  `logoUrl/logoPath (opsional; default ${logoPath})`,
  // field lainnya tetap sama
];

const columnHintsByMode = {
  // mode lain
  cooperation_agreement: cooperationAgreementColumnHints(
    'PT. ORIGIN MAGDA INOVASI',
    'resources/images/origin-magna-inovasi.png'
  ),
  exel_cooperation_agreement: cooperationAgreementColumnHints(
    'PT. EXEL INTEGRASI SOLUSINDO',
    'resources/images/logo-old.png'
  )
};
```

### 2. Frontend: buat file download Excel

File baru:

```text
D:\eis\ui-pdf-generator\public\templates\exel_cooperation_agreement.xlsx
```

Perubahan:

- Buat dari `public/templates/cooperation_agreement.xlsx` atau salin dari artefak generator backend yang sudah disesuaikan untuk EXEL.
- Pertahankan nama sheet `Sheet1` agar sesuai default upload backend.
- Header dan urutan kolom harus identik dengan kontrak di atas.
- Ubah baris contoh `companyName` menjadi `PT. EXEL INTEGRASI SOLUSINDO`.
- Biarkan `logoUrl`/`logoPath` kosong pada contoh agar default logo EXEL dipakai, kecuali tim memang ingin memberikan contoh override yang valid.
- Pertahankan tipe cell yang aman untuk nomor identitas, telepon, rekening, tanggal, angka, dan JSON.
- Pastikan file berada di `public/templates`, sehingga ikut disalin ke hasil build frontend dan tersedia pada URL `/templates/exel_cooperation_agreement.xlsx`.

### 3. Backend: tambahkan definisi generator untuk menjaga source of truth

File yang dimodifikasi:

```text
D:\eis\core.pdf-generator.indinesia.id\scripts\create-bulk-template.js
```

Tambahkan definisi `exel_cooperation_agreement` ke `TEMPLATE_DEFINITIONS` dengan ketentuan:

- header menggunakan daftar yang sama dengan `cooperation_agreement`;
- filename `exel_cooperation_agreement-bulk-template.xlsx`;
- contoh company memakai `PT. EXEL INTEGRASI SOLUSINDO`;
- contoh logo kosong agar backend memilih default EXEL;
- contoh field lain boleh menggunakan data yang sama dengan cooperation agreement.

Hindari menduplikasi array header dan sample panjang secara penuh bila dapat menggunakan helper/clone yang tetap mudah dibaca. Yang penting, perubahan pada format dasar tidak membuat varian EXEL tertinggal tanpa disadari.

File baru hasil generator:

```text
D:\eis\core.pdf-generator.indinesia.id\resources\templates\exel_cooperation_agreement-bulk-template.xlsx
```

Artefak tersebut dapat dibuat dengan:

```bash
node scripts/create-bulk-template.js --template exel_cooperation_agreement
```

Setelah dibuat, salin/hasilkan versi yang sama ke `ui-pdf-generator/public/templates/exel_cooperation_agreement.xlsx`. Bandingkan header kedua file agar tidak ada perbedaan.

### 4. Backend: verifikasi kontrak yang sudah ada, tanpa perubahan jika tidak diperlukan

File untuk diperiksa:

```text
D:\eis\core.pdf-generator.indinesia.id\start\routes.js
D:\eis\core.pdf-generator.indinesia.id\app\Controllers\Http\BulkPdfController.js
D:\eis\core.pdf-generator.indinesia.id\app\Services\CooperationAgreementService.js
```

Kondisi yang diharapkan sudah tersedia:

- route `POST /api/v1/bulk/exel_cooperation_agreement`;
- controller memanggil builder cooperation agreement dengan template `exel_cooperation_agreement`;
- alias/header yang diterima sama dengan cooperation agreement;
- normalisasi memberi default company dan logo EXEL;
- validasi field wajib sama dengan cooperation agreement.

Jangan mengubah file runtime backend tersebut bila hasil verifikasi menunjukkan kontraknya sudah benar. Perubahan backend pada issue ini terutama untuk generator dan artefak template Excel.

### 5. Dokumentasi (bila daftar template bulk dipelihara di dokumentasi)

File yang mungkin dimodifikasi:

```text
D:\eis\core.pdf-generator.indinesia.id\README.md
D:\eis\core.pdf-generator.indinesia.id\API_DOCUMENTATION.md
```

Tambahkan `exel_cooperation_agreement` pada daftar mode/template bulk yang didukung dan jelaskan bahwa format kolomnya sama dengan `cooperation_agreement`, dengan default branding EXEL. Jangan menduplikasi dokumentasi panjang jika cukup merujuk ke format utama.

## Daftar File yang Diperkirakan Berubah

### Wajib

| Repository | Aksi | File |
|---|---|---|
| Frontend | Modify | `src/components/forms/BulkGenerateForm.jsx` |
| Frontend | Create | `public/templates/exel_cooperation_agreement.xlsx` |
| Backend | Modify | `scripts/create-bulk-template.js` |
| Backend | Create | `resources/templates/exel_cooperation_agreement-bulk-template.xlsx` |

### Test dan dokumentasi

| Repository | Aksi | File |
|---|---|---|
| Frontend | Create/Modify | `src/components/forms/BulkGenerateForm.test.jsx` atau file test form bulk yang digunakan project |
| Backend | Create/Modify | test generator/template bulk yang sesuai struktur test project |
| Backend | Modify bila relevan | `README.md` |
| Backend | Modify bila relevan | `API_DOCUMENTATION.md` |

### Hanya diverifikasi; tidak perlu dimodifikasi jika sudah sesuai

| Repository | File |
|---|---|
| Backend | `start/routes.js` |
| Backend | `app/Controllers/Http/BulkPdfController.js` |
| Backend | `app/Services/CooperationAgreementService.js` |
| Frontend | `src/api/bulkApi.js` |

`src/api/bulkApi.js` sudah membentuk endpoint secara dinamis dari mode (`/v1/bulk/${payload.mode}`), sehingga tidak dibutuhkan mapping endpoint baru selama perilaku ini tidak berubah.

## Acceptance Criteria

1. Saat `Exel Cooperation Agreement` dipilih di `/bulk-generate`, panel **Format kolom Excel - Exel Cooperation Agreement** tampil.
2. Panel menampilkan daftar kolom yang sama dengan `cooperation_agreement` dan informasi default branding EXEL yang benar.
3. Tombol **Unduh template Exel Cooperation Agreement** tampil.
4. Tombol mengunduh `exel_cooperation_agreement.xlsx` dengan response berhasil, bukan halaman 404/fallback HTML.
5. Workbook dapat dibuka, mempunyai sheet `Sheet1`, serta header dan urutan kolom yang sama dengan template `cooperation_agreement`.
6. Baris contoh menggunakan `PT. EXEL INTEGRASI SOLUSINDO`; kolom logo kosong menggunakan default logo EXEL saat diproses backend.
7. File hasil download dapat diunggah kembali untuk dry run `POST /api/v1/bulk/exel_cooperation_agreement` tanpa error karena nama header/template.
8. Dengan data wajib valid, bulk generate normal berhasil diproses sebagai template `exel_cooperation_agreement`.
9. Template `cooperation_agreement` existing tetap dapat ditampilkan, diunduh, dan diproses seperti sebelumnya.
10. Company dengan pembatasan `allowed_templates` hanya melihat/menggunakan mode EXEL bila `exel_cooperation_agreement` diizinkan.
11. Build frontend menyertakan file baru pada path publik yang benar.
12. Generator backend menerima `--template exel_cooperation_agreement`, dan `--all` ikut menghasilkan artefak EXEL.

## Skenario Test

Detail implementasi test diserahkan kepada implementer. Minimal cakup skenario berikut:

### Frontend

- Pilih mode `exel_cooperation_agreement`; verifikasi judul format, daftar hint, dan link download muncul.
- Verifikasi link mengarah tepat ke `/templates/exel_cooperation_agreement.xlsx`.
- Download file dari build/dev server dan pastikan file adalah workbook Excel yang valid, bukan response 404.
- Bandingkan header template EXEL dengan template `cooperation_agreement`.
- Verifikasi mode `cooperation_agreement` dan mode bulk lain tidak mengalami regresi.
- Verifikasi aturan `allowed_templates` tetap berlaku.

### Backend

- Jalankan generator untuk satu template `exel_cooperation_agreement`.
- Jalankan generator `--all` dan pastikan file EXEL ikut dibuat.
- Upload template EXEL dalam mode dry run dengan data valid dan data wajib yang kosong.
- Jalankan bulk generate normal dengan baris valid, lalu pastikan template/batch tercatat sebagai `exel_cooperation_agreement`.
- Verifikasi default company dan logo EXEL dipakai saat kolom override kosong.
- Verifikasi angka, tanggal, nomor identitas/rekening, kolom satuan, dan JSON contoh dapat diparse sesuai kontrak existing.

## Catatan Implementasi

- Jangan hanya menambahkan file Excel. Tanpa entry `columnHintsByMode.exel_cooperation_agreement`, panel beserta tombol download tetap tidak dirender.
- Jangan hanya menambahkan mapping URL karena mapping tersebut sudah ada.
- Jangan memakai key dengan dash seperti `exel-cooperation-agreement`; backend dan frontend menggunakan underscore.
- Jangan mengubah nama menjadi `excel_cooperation_agreement` dalam scope issue ini walaupun ejaan produknya terlihat tidak umum.
- File binary `.xlsx` harus benar-benar dibuka atau dibaca dengan library spreadsheet saat verifikasi; keberadaan file saja belum membuktikan formatnya valid.
- Jika implementer menemukan perbedaan antara header dokumen ini dan kontrak backend terbaru, kontrak parser/validator backend terbaru menjadi sumber kebenaran. Update template frontend, generator backend, dan hint UI secara bersamaan.

## Definition of Done

- Seluruh acceptance criteria terpenuhi.
- File Excel EXEL tersedia di frontend dan master/generated template backend.
- Header frontend dan backend identik.
- Skenario test relevan lulus.
- Frontend berhasil di-build.
- Tidak ada perubahan perilaku pada `cooperation_agreement` existing.
