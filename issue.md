# Issue Planning: Tambah Tunjangan `cooperation_agreement`

## Status
Draft perencanaan untuk diimplementasikan oleh junior programmer atau AI model biaya rendah.

## Informasi Umum
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Template target: `cooperation_agreement`

## Latar Belakang
Template `cooperation_agreement` saat ini memiliki 3 tunjangan:
- `transportAllowance` / `Tunjangan Transport`
- `mealAllowance` / `Tunjangan Makan`
- `phoneAllowance` / `Tunjangan Pulsa`

Perlu ditambahkan 2 tunjangan baru:
- `operationalCostAllowance` / `Tunjangan biaya operasional`
- `tlAllowance` / `Tunjangan TL`

Aturan tampil mengikuti tunjangan existing: jika nominal `0`, kosong, atau tidak dikirim, item tunjangan tidak ditampilkan di PDF. Penomoran dan indent harus tetap mengikuti pola yang sudah ada.

## Tujuan
- Menambahkan dukungan 5 tunjangan pada template `cooperation_agreement`.
- Memastikan PDF hanya menampilkan tunjangan dengan nominal lebih dari `0`.
- Memastikan penomoran sub-poin tunjangan tetap berurutan untuk semua kombinasi tunjangan aktif/tidak aktif.
- Mengimplementasikan field baru di frontend halaman `/generate-pdf` dan `/bulk-generate`.
- Menyesuaikan file template Excel bulk generate.
- Membuat contoh PDF hasil implementasi untuk validasi manual.

## Scope Backend

### 1. Normalisasi dan Validasi Data
File utama:
- `app/Services/CooperationAgreementService.js`

Rencana:
- Tambahkan field canonical baru:
  - `operationalCostAllowance`
  - `tlAllowance`
- Tambahkan kedua field ke daftar field uang/allowance agar diparse seperti tunjangan existing.
- Tambahkan alias input untuk kompatibilitas API dan Excel:
  - `operationalCostAllowance`: `tunjanganBiayaOperasional`, `tunjangan biaya operasional`, `biayaOperasionalAllowance`, `biaya operasional`
  - `tlAllowance`: `tunjanganTl`, `tunjanganTL`, `tunjangan tl`, `tunjangan TL`
- Pastikan nominal dari JSON dan Excel bisa berupa number atau string nominal yang sudah umum dipakai di sistem.
- Pastikan nominal `0` valid dan tidak membuat request gagal.
- Jika allowance existing saat ini required, tentukan apakah 2 allowance baru ikut required atau opsional. Rekomendasi: semua allowance boleh `0`, kosong, atau tidak dikirim selama rule PDF tetap benar.

### 2. Rendering PDF
File utama:
- `app/Templates/cooperation_agreement.js`
- `resources/pdf-templates/cooperation_agreement.js`

Rencana:
- Tambahkan 2 item baru ke daftar allowance aktif.
- Urutan tampilan allowance:
  1. `Tunjangan transport`
  2. `Tunjangan makan`
  3. `Tunjangan pulsa`
  4. `Tunjangan biaya operasional`
  5. `Tunjangan TL`
- Hanya allowance dengan nominal `> 0` yang ditampilkan.
- Format nominal tetap memakai format rupiah terbilang existing.
- Penomoran sub-poin tetap dinamis:
  - Jika 5 tunjangan aktif, tampil `3.3.1` sampai `3.3.5`.
  - Jika hanya sebagian aktif, nomor tetap rapat tanpa lompat.
  - Jika semua tunjangan tidak aktif, blok tunjangan hilang dan nomor poin rekening/pembayaran naik seperti perilaku existing.
- Indent item tunjangan baru harus sama dengan item tunjangan existing.

### 3. Bulk Generate Backend
File yang kemungkinan disentuh:
- `app/Controllers/Http/BulkPdfController.js`
- `scripts/create-bulk-template.js`
- `resources/templates/cooperation_agreement-bulk-template.xlsx` atau file template Excel terkait

Rencana:
- Tambahkan parsing kolom baru:
  - `operationalCostAllowance`
  - `tlAllowance`
- Tambahkan dukungan alias kolom Excel:
  - `Tunjangan Biaya Operasional`
  - `Tunjangan TL`
- Pastikan nilai kosong dari Excel diperlakukan sebagai tidak tampil.
- Pastikan nilai `0` dari Excel tetap valid dan tidak tampil di PDF.
- Pertahankan kompatibilitas kolom lama untuk 3 tunjangan existing.

### 4. Contoh PDF
Setelah implementasi selesai, buat contoh PDF untuk validasi manual.

Output yang disarankan:
- `output/cooperation_agreement.five-allowances-sample.pdf`

Data contoh:
- Gunakan data partner dan perusahaan yang aman untuk sample.
- Isi `salary` dengan nominal valid.
- Isi sebagian atau semua allowance dengan nominal lebih dari `0` agar 2 tunjangan baru terlihat.
- Buat juga skenario manual dengan salah satu tunjangan bernilai `0` untuk memastikan item tidak tampil.

## Scope Frontend

### 1. Halaman `/generate-pdf`
File yang kemungkinan disentuh:
- `ui-pdf-generator/src/utils/templateFields.js`
- `ui-pdf-generator/src/components/forms/GeneratePdfForm.jsx` jika ada logic khusus template

Rencana:
- Tambahkan field baru pada mapping template `cooperation_agreement`:
  - `operationalCostAllowance`, label `Tunjangan Biaya Operasional`, type `number`
  - `tlAllowance`, label `Tunjangan TL`, type `number`
- Letakkan field baru setelah `phoneAllowance`.
- Pastikan payload yang dikirim ke backend memakai nama canonical.
- Jika allowance existing tidak wajib secara bisnis, field baru juga jangan dibuat required.
- Jika allowance existing tetap required di UI, pastikan nilai `0` bisa disubmit.

### 2. Halaman `/bulk-generate`
File yang kemungkinan disentuh:
- `ui-pdf-generator/src/components/forms/BulkGenerateForm.jsx`
- `ui-pdf-generator/public/templates/cooperation_agreement.xlsx`

Rencana:
- Tambahkan hint kolom baru untuk mode `cooperation_agreement`:
  - `operationalCostAllowance` / `Tunjangan Biaya Operasional`
  - `tlAllowance` / `Tunjangan TL`
- Update file template Excel unduhan `public/templates/cooperation_agreement.xlsx`.
- Pastikan urutan kolom tunjangan di Excel mengikuti urutan PDF:
  - `transportAllowance`
  - `mealAllowance`
  - `phoneAllowance`
  - `operationalCostAllowance`
  - `tlAllowance`
- Beri contoh nilai `0` atau kosong pada template Excel jika ingin menunjukkan bahwa tunjangan tersebut tidak ditampilkan.

## File yang Kemungkinan Disentuh

Backend:
- `app/Templates/cooperation_agreement.js`
- `resources/pdf-templates/cooperation_agreement.js`
- `app/Services/CooperationAgreementService.js`
- `app/Controllers/Http/BulkPdfController.js`
- `scripts/create-bulk-template.js`
- `resources/templates/cooperation_agreement-bulk-template.xlsx` atau file template Excel terkait
- `test/unit/cooperation_agreement_template.spec.js`
- `test/functional/api_endpoint_matrix.spec.js`
- `output/cooperation_agreement.five-allowances-sample.pdf`

Frontend:
- `src/utils/templateFields.js`
- `src/components/forms/GeneratePdfForm.jsx`
- `src/components/forms/BulkGenerateForm.jsx`
- `public/templates/cooperation_agreement.xlsx`

## Contoh Payload

```json
{
  "template": "cooperation_agreement",
  "email": "mitra@example.com",
  "data": {
    "partnerName": "Budi Mitra",
    "salary": 5000000,
    "transportAllowance": 100000,
    "mealAllowance": 300000,
    "phoneAllowance": 100000,
    "operationalCostAllowance": 250000,
    "tlAllowance": 150000
  }
}
```

Contoh kombinasi tidak tampil:

```json
{
  "template": "cooperation_agreement",
  "email": "mitra@example.com",
  "data": {
    "partnerName": "Budi Mitra",
    "salary": 5000000,
    "transportAllowance": 0,
    "mealAllowance": 300000,
    "phoneAllowance": "",
    "operationalCostAllowance": 250000,
    "tlAllowance": 0
  }
}
```

Pada contoh kedua, PDF hanya menampilkan `Tunjangan makan` dan `Tunjangan biaya operasional`, dengan nomor sub-poin tetap berurutan.

## Skenario Test
Bagian ini sengaja hanya berisi skenario high-level. Detail mock, assertion granular, fixture, dan struktur test diserahkan ke implementor.

- Generate PDF `cooperation_agreement` berhasil saat 5 tunjangan bernilai lebih dari `0`.
- PDF menampilkan `Tunjangan biaya operasional` dan `Tunjangan TL` dengan format nominal yang benar.
- PDF menyembunyikan tunjangan baru saat nilainya `0`, kosong, atau tidak dikirim.
- Penomoran dan indent tetap benar saat semua tunjangan aktif.
- Penomoran dan indent tetap benar saat hanya sebagian tunjangan aktif.
- Saat semua tunjangan bernilai `0`/kosong, blok tunjangan hilang dan nomor poin berikutnya naik.
- Backend menerima alias field baru dari JSON dan Excel.
- Bulk generate membaca kolom `Tunjangan Biaya Operasional` dan `Tunjangan TL` dari Excel.
- Frontend `/generate-pdf` menampilkan 2 field tunjangan baru dan mengirim payload canonical.
- Frontend `/bulk-generate` menampilkan hint kolom baru dan link template Excel tetap berfungsi.
- Template Excel unduhan `cooperation_agreement.xlsx` memiliki kolom 2 tunjangan baru.
- Contoh PDF berhasil dibuat dan bisa dipakai untuk validasi manual.

## Acceptance Criteria
- Template `cooperation_agreement` mendukung total 5 tunjangan.
- Dua field baru tersedia di backend: `operationalCostAllowance` dan `tlAllowance`.
- Label PDF untuk field baru adalah `Tunjangan biaya operasional` dan `Tunjangan TL`.
- Nilai `0`, kosong, atau missing tidak tampil di PDF.
- Penomoran dan indent mengikuti perilaku tunjangan existing.
- Frontend `/generate-pdf` memiliki input untuk 2 tunjangan baru.
- Frontend `/bulk-generate` memiliki hint kolom dan template Excel yang sudah diperbarui.
- File contoh PDF tersedia di `output/cooperation_agreement.five-allowances-sample.pdf`.
- Instruksi test tetap berupa skenario high-level, bukan detail implementasi unit test.
