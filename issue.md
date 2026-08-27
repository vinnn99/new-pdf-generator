# Issue Planning: Satuan Tunjangan `cooperation_agreement`

## Status
Draft perencanaan untuk diimplementasikan oleh junior programmer atau AI model biaya rendah.

## Informasi Umum
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Template target: `cooperation_agreement`

## Latar Belakang
Pada template `cooperation_agreement`, semua tunjangan saat ini hanya menampilkan nominal. Belum jelas apakah nominal tersebut berlaku per bulan, per hari, per minggu, atau satuan lain.

Tunjangan yang perlu mendukung satuan:
- `transportAllowance` / `Tunjangan transport`
- `mealAllowance` / `Tunjangan makan`
- `phoneAllowance` / `Tunjangan pulsa`
- `operationalCostAllowance` / `Tunjangan biaya operasional`
- `tlAllowance` / `Tunjangan TL`

Satuan ditulis manual oleh user dan harus ditampilkan setelah nominal dengan pola kata `per`, contoh:
- `Rp. 300.000 (tiga ratus ribu rupiah) per bulan`
- `Rp. 45.000 (empat puluh lima ribu rupiah) per hari`

## Tujuan
- Menambahkan field satuan manual untuk setiap tunjangan.
- Menampilkan satuan di PDF setelah nominal dan terbilang.
- Memastikan format satuan menggunakan kata `per`.
- Mengimplementasikan input satuan di frontend `/generate-pdf`.
- Mengimplementasikan kolom satuan di frontend `/bulk-generate`.
- Menyesuaikan file template Excel bulk generate.
- Membuat contoh PDF hasil implementasi untuk validasi manual.

## Keputusan Field
Gunakan field canonical berikut:

- `transportAllowanceUnit`
- `mealAllowanceUnit`
- `phoneAllowanceUnit`
- `operationalCostAllowanceUnit`
- `tlAllowanceUnit`

Isi field satuan adalah teks manual. Implementasi harus menerima dua gaya input:
- User mengisi `bulan`, backend menampilkan `per bulan`.
- User mengisi `per bulan`, backend tetap menampilkan `per bulan` dan tidak menjadi `per per bulan`.

Jika satuan kosong, tampilkan nominal seperti perilaku lama tanpa tambahan satuan. Jangan gagal validasi hanya karena satuan kosong.

## Scope Backend

### 1. Normalisasi Data
File utama:
- `app/Services/CooperationAgreementService.js`

Rencana:
- Tambahkan normalisasi field satuan untuk 5 tunjangan.
- Tambahkan alias agar input dari API dan Excel fleksibel.
- Alias yang disarankan:
  - `transportAllowanceUnit`: `transportUnit`, `tunjanganTransportUnit`, `satuanTunjanganTransport`, `satuan tunjangan transport`
  - `mealAllowanceUnit`: `mealUnit`, `tunjanganMakanUnit`, `satuanTunjanganMakan`, `satuan tunjangan makan`
  - `phoneAllowanceUnit`: `phoneUnit`, `tunjanganPulsaUnit`, `satuanTunjanganPulsa`, `satuan tunjangan pulsa`
  - `operationalCostAllowanceUnit`: `operationalCostUnit`, `tunjanganBiayaOperasionalUnit`, `satuanTunjanganBiayaOperasional`, `satuan tunjangan biaya operasional`
  - `tlAllowanceUnit`: `tlUnit`, `tunjanganTlUnit`, `tunjanganTLUnit`, `satuanTunjanganTL`, `satuan tunjangan TL`
- Satuan tidak perlu masuk `requiredFields()`.
- Sanitasi sederhana:
  - trim whitespace
  - collapse spasi ganda
  - jika diawali `per `, jangan tambahkan `per` lagi saat render

### 2. Rendering PDF
File utama:
- `app/Templates/cooperation_agreement.js`
- `resources/pdf-templates/cooperation_agreement.js`

Rencana:
- Saat allowance aktif, format teks tetap mengikuti pola existing:
  - `{label} sebesar {nominal terbilang}.`
- Tambahkan satuan setelah nominal terbilang jika tersedia:
  - `{label} sebesar 300.000 (tiga ratus ribu) per bulan.`
- Jika satuan kosong:
  - `{label} sebesar 300.000 (tiga ratus ribu).`
- Aturan tampil allowance tetap sama:
  - nominal `0`, kosong, atau tidak dikirim tidak tampil
  - satuan tidak boleh membuat allowance tampil jika nominalnya tidak aktif
- Penomoran dan indent tetap mengikuti perilaku existing.

### 3. Bulk Generate Backend
File yang kemungkinan disentuh:
- `app/Controllers/Http/BulkPdfController.js`
- `scripts/create-bulk-template.js`
- `resources/templates/cooperation_agreement-bulk-template.xlsx`

Rencana:
- Tambahkan parsing kolom satuan untuk 5 tunjangan.
- Kolom canonical yang disarankan:
  - `transportAllowanceUnit`
  - `mealAllowanceUnit`
  - `phoneAllowanceUnit`
  - `operationalCostAllowanceUnit`
  - `tlAllowanceUnit`
- Alias kolom Excel yang disarankan:
  - `Satuan Tunjangan Transport`
  - `Satuan Tunjangan Makan`
  - `Satuan Tunjangan Pulsa`
  - `Satuan Tunjangan Biaya Operasional`
  - `Satuan Tunjangan TL`
- Pastikan data Excel `bulan`, `hari`, `minggu`, atau `per bulan` terbaca sebagai teks.
- Pastikan kolom satuan kosong tetap valid.

### 4. Contoh PDF
Setelah implementasi selesai, buat contoh PDF untuk validasi manual.

Output yang disarankan:
- `output/cooperation_agreement.allowance-units-sample.pdf`

Data contoh:
- Gunakan data sample aman.
- Isi beberapa tunjangan dengan satuan berbeda:
  - `transportAllowanceUnit`: `hari`
  - `mealAllowanceUnit`: `hari`
  - `phoneAllowanceUnit`: `bulan`
  - `operationalCostAllowanceUnit`: `per bulan`
  - `tlAllowanceUnit`: `minggu`
- Pastikan PDF memperlihatkan variasi input tanpa menggandakan kata `per`.

## Scope Frontend

### 1. Halaman `/generate-pdf`
File yang kemungkinan disentuh:
- `ui-pdf-generator/src/utils/templateFields.js`
- `ui-pdf-generator/src/components/forms/GeneratePdfForm.jsx` jika ada logic khusus template

Rencana:
- Tambahkan field satuan setelah setiap field nominal tunjangan.
- Field satuan bertipe text biasa.
- Label yang disarankan:
  - `Satuan Tunjangan Transport`
  - `Satuan Tunjangan Makan`
  - `Satuan Tunjangan Pulsa`
  - `Satuan Tunjangan Biaya Operasional`
  - `Satuan Tunjangan TL`
- Placeholder yang disarankan: `bulan`, `hari`, `minggu`, atau `per bulan`.
- Field satuan tidak required.
- Payload tetap dikirim di `data` dengan nama canonical.

### 2. Halaman `/bulk-generate`
File yang kemungkinan disentuh:
- `ui-pdf-generator/src/components/forms/BulkGenerateForm.jsx`
- `ui-pdf-generator/public/templates/cooperation_agreement.xlsx`

Rencana:
- Tambahkan hint kolom satuan untuk mode `cooperation_agreement`.
- Update file Excel unduhan `public/templates/cooperation_agreement.xlsx`.
- Letakkan kolom satuan tepat setelah nominal tunjangan masing-masing, contoh:
  - `transportAllowance`
  - `transportAllowanceUnit`
  - `mealAllowance`
  - `mealAllowanceUnit`
  - dan seterusnya
- Isi sample Excel dengan contoh satuan manual seperti `hari`, `bulan`, dan `per bulan`.

## File yang Kemungkinan Disentuh

Backend:
- `app/Templates/cooperation_agreement.js`
- `resources/pdf-templates/cooperation_agreement.js`
- `app/Services/CooperationAgreementService.js`
- `app/Controllers/Http/BulkPdfController.js`
- `scripts/create-bulk-template.js`
- `resources/templates/cooperation_agreement-bulk-template.xlsx`
- `test/unit/cooperation_agreement_template.spec.js`
- `test/functional/api_endpoint_matrix.spec.js`
- `output/cooperation_agreement.allowance-units-sample.pdf`

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
    "transportAllowance": 45000,
    "transportAllowanceUnit": "hari",
    "mealAllowance": 300000,
    "mealAllowanceUnit": "per bulan",
    "phoneAllowance": 100000,
    "phoneAllowanceUnit": "bulan",
    "operationalCostAllowance": 250000,
    "operationalCostAllowanceUnit": "bulan",
    "tlAllowance": 150000,
    "tlAllowanceUnit": "minggu"
  }
}
```

Output PDF yang diharapkan pada bagian tunjangan:
- `Tunjangan transport sebesar 45.000 (empat puluh lima ribu) per hari.`
- `Tunjangan makan sebesar 300.000 (tiga ratus ribu) per bulan.`
- `Tunjangan pulsa sebesar 100.000 (seratus ribu) per bulan.`
- `Tunjangan biaya operasional sebesar 250.000 (dua ratus lima puluh ribu) per bulan.`
- `Tunjangan TL sebesar 150.000 (seratus lima puluh ribu) per minggu.`

## Skenario Test
Bagian ini sengaja hanya berisi skenario high-level. Detail mock, assertion granular, fixture, dan struktur test diserahkan ke implementor.

- Generate PDF menampilkan satuan untuk setiap tunjangan aktif.
- Input satuan `bulan` tampil sebagai `per bulan`.
- Input satuan `per bulan` tetap tampil sebagai `per bulan`, bukan `per per bulan`.
- Tunjangan bernilai `0`, kosong, atau tidak dikirim tetap tidak tampil walaupun satuannya diisi.
- Tunjangan aktif tanpa satuan tetap tampil dengan format nominal lama.
- Penomoran dan indent tunjangan tidak berubah setelah satuan ditambahkan.
- Bulk generate membaca kolom satuan dari Excel dan menampilkannya di PDF.
- Frontend `/generate-pdf` menampilkan field satuan untuk semua tunjangan.
- Frontend `/bulk-generate` menampilkan hint kolom satuan.
- Template Excel unduhan memiliki kolom satuan di posisi yang sesuai.
- Contoh PDF berhasil dibuat dan bisa dipakai untuk validasi manual.

## Acceptance Criteria
- Semua tunjangan `cooperation_agreement` mendukung satuan manual.
- Satuan ditampilkan dengan format kata `per`.
- Satuan kosong tidak menyebabkan validasi gagal.
- Tidak ada duplikasi kata `per`.
- Frontend `/generate-pdf` mendukung input satuan.
- Frontend `/bulk-generate` mendukung kolom satuan dan template Excel sudah diperbarui.
- File contoh PDF tersedia di `output/cooperation_agreement.allowance-units-sample.pdf`.
- Instruksi test tetap berupa skenario high-level, bukan detail implementasi unit test.
