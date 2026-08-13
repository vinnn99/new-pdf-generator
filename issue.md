# Issue Planning: Perbaikan Tunjangan Pasal 2 Template `cooperation_agreement`

## Status
Draft perencanaan untuk diimplementasikan oleh junior programmer atau AI model biaya rendah.

## Informasi Umum
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Perubahan utama ada di backend karena layout dan isi PDF `cooperation_agreement` dibuat dari template backend.
- Frontend hanya perlu disentuh jika ada field, template Excel, preview, atau dokumentasi UI yang perlu menyesuaikan informasi tunjangan.

## Latar Belakang
Issue ini terkait template PDF `cooperation_agreement`.

Pada Pasal 2, nomor `3.3` adalah bagian kesepakatan upah dengan tunjangan. Saat ini sub item tunjangan terdiri dari:
- `3.3.1` Tunjangan transport
- `3.3.2` Tunjangan makan
- `3.3.3` Tunjangan pulsa

Template perlu dibuat dinamis agar tunjangan bernilai `0` tidak ditampilkan, dan nomor berikutnya tetap tersusun rapi.

Template utama:
- `app/Templates/cooperation_agreement.js`

File berikut hanya re-export template utama:
- `resources/pdf-templates/cooperation_agreement.js`

## Scope Perubahan
1. Jika salah satu atau lebih tunjangan bernilai `0`, sub item tunjangan tersebut tidak perlu ditampilkan.
2. Urutan nomor sub item tunjangan harus mengikuti jumlah tunjangan yang ditampilkan.
3. Jika ketiga tunjangan bernilai `0`, maka nomor `3.3` tentang tunjangan dihilangkan.
4. Jika nomor `3.3` dihilangkan, nomor berikutnya harus naik:
   - `3.4` menjadi `3.3`
   - `3.5` menjadi `3.4`
   - `3.6` menjadi `3.5`
   - dan seterusnya
5. Setelah implementasi, buat contoh PDF hasil generate untuk memvalidasi output.

## Rencana Implementasi Backend

### 1. Identifikasi Field Tunjangan
Gunakan field existing pada payload `cooperation_agreement`:
- `transportAllowance`
- `mealAllowance`
- `phoneAllowance`

Pastikan nilai dianggap `0` jika:
- angka `0`
- string `"0"`
- string format rupiah/numeric yang setelah dinormalisasi bernilai `0`
- kosong atau null hanya jika flow existing memang menormalisasi field tersebut menjadi `0`

Jangan mengubah nama field payload kecuali benar-benar diperlukan.

### 2. Buat Helper Daftar Tunjangan Aktif
Tambahkan helper kecil di `app/Templates/cooperation_agreement.js` untuk membentuk daftar tunjangan yang nilainya lebih dari `0`.

Contoh hasil helper:

```js
[
  { label: 'Tunjangan makan', amount: data.mealAllowance, fieldName: 'tunjangan makan' },
  { label: 'Tunjangan pulsa', amount: data.phoneAllowance, fieldName: 'tunjangan pulsa' }
]
```

Helper ini dipakai untuk menentukan apakah bagian `3.3` perlu ditampilkan atau tidak.

### 3. Aturan Jika Sebagian Tunjangan Bernilai 0
Jika hanya sebagian tunjangan yang bernilai lebih dari `0`, tampilkan hanya tunjangan tersebut.

Contoh:
- Tunjangan transport = `0`
- Tunjangan makan = `300000`
- Tunjangan pulsa = `100000`

Maka output harus menjadi:

```text
3.3. MITRA sepakat mendapatkan upah dengan tunjangan sebagai berikut:
     3.3.1 Tunjangan makan sebesar ...
     3.3.2 Tunjangan pulsa sebesar ...
```

Nomor sub item harus dibuat berdasarkan urutan tunjangan aktif, bukan berdasarkan posisi field asli.

Urutan field tetap:
1. Tunjangan transport
2. Tunjangan makan
3. Tunjangan pulsa

### 4. Aturan Jika Semua Tunjangan Bernilai 0
Jika `transportAllowance`, `mealAllowance`, dan `phoneAllowance` semuanya bernilai `0`, hilangkan seluruh bagian:
- `3.3 MITRA sepakat mendapatkan upah dengan tunjangan sebagai berikut:`
- semua sub item `3.3.x`

Setelah bagian tersebut dihilangkan, renumber poin berikutnya:
- bagian rekening yang sebelumnya `3.4` menjadi `3.3`
- hak mendapatkan upah yang sebelumnya `3.5` menjadi `3.4`
- pelaksanaan kemitraan yang sebelumnya `3.6` menjadi `3.5`

Pastikan referensi nomor pada teks atau helper tidak hardcoded secara berlebihan.

### 5. Perbaikan Struktur Nomor 3.x
Disarankan buat array item untuk seluruh bagian nomor `3.x`, lalu render berdasarkan array tersebut.

Pendekatan yang disarankan:
- Buat variabel counter untuk nomor level `3.x`.
- Tambahkan item `3.1` dan `3.2` seperti biasa.
- Tambahkan item tunjangan hanya jika daftar tunjangan aktif tidak kosong.
- Tambahkan item rekening setelahnya memakai nomor counter terbaru.
- Tambahkan item lanjutan setelah tabel rekening memakai nomor counter terbaru.

Tujuannya agar implementor tidak perlu mengganti banyak string hardcoded setiap kali ada kondisi tunjangan berbeda.

### 6. Tabel Rekening
Tabel rekening MITRA tetap tampil seperti sekarang.

Jika semua tunjangan bernilai `0`, tabel rekening harus mengikuti nomor baru yang benar. Contoh:

```text
3.3. Para Pihak sepakat seluruh pembayaran atas gaji hanya dengan menggunakan mata uang rupiah ...
```

Lalu tabel rekening muncul setelah item tersebut.

### 7. Buat Contoh PDF
Setelah implementasi selesai, buat contoh PDF hasil generate dari template terbaru.

Minimal buat satu contoh PDF untuk case:
- `transportAllowance = 0`
- `mealAllowance = 300000`
- `phoneAllowance = 100000`

Output file yang disarankan:
- `output/cooperation_agreement.allowance-sample.pdf`

Jika memungkinkan, buat juga contoh tambahan untuk case semua tunjangan `0`:
- `output/cooperation_agreement.no-allowance-sample.pdf`

Contoh PDF cukup dipakai untuk validasi manual. Tidak wajib dijadikan fixture test permanen jika repo tidak biasa menyimpan generated output.

## Rencana Implementasi Frontend
- Tidak ada perubahan frontend wajib jika field tunjangan tetap sama.
- Jika frontend punya template Excel atau hint kolom untuk `cooperation_agreement`, pastikan field berikut tetap tersedia:
  - `transportAllowance`
  - `mealAllowance`
  - `phoneAllowance`
- Jika ada keterangan UI yang menyatakan ketiga tunjangan selalu muncul di PDF, ubah agar sesuai perilaku baru.

## File Yang Kemungkinan Disentuh
Backend:
- `app/Templates/cooperation_agreement.js`
- `test/unit/cooperation_agreement_template.spec.js` jika test template sudah tersedia
- file test terkait template/PDF jika implementor memilih menambah coverage ringan

Frontend, hanya jika diperlukan:
- `src/utils/templateFields.js`
- komponen form atau hint template `cooperation_agreement`
- template Excel public untuk `cooperation_agreement`

## Skenario Test
- Generate PDF dengan semua tunjangan lebih dari `0`, pastikan `3.3.1`, `3.3.2`, dan `3.3.3` tampil.
- Generate PDF dengan Tunjangan Transport = `0`, Tunjangan Makan dan Pulsa lebih dari `0`, pastikan hanya Makan dan Pulsa tampil sebagai `3.3.1` dan `3.3.2`.
- Generate PDF dengan hanya satu tunjangan lebih dari `0`, pastikan hanya satu sub item `3.3.1` tampil.
- Generate PDF dengan semua tunjangan `0`, pastikan bagian `3.3` tunjangan hilang.
- Pada case semua tunjangan `0`, pastikan poin rekening yang sebelumnya `3.4` berubah menjadi `3.3`.
- Pastikan tabel rekening tetap tampil dan posisinya sesuai setelah renumber.
- Pastikan generate PDF tetap berhasil untuk payload existing.
- Pastikan perubahan tidak merusak template PDF lain.

## Acceptance Criteria
- Tunjangan bernilai `0` tidak muncul di Pasal 2 nomor `3.3`.
- Nomor sub tunjangan otomatis menyesuaikan jumlah tunjangan yang tampil.
- Jika semua tunjangan `0`, bagian `3.3` tunjangan dihilangkan seluruhnya.
- Jika bagian tunjangan hilang, nomor `3.4`, `3.5`, dan seterusnya otomatis naik.
- Tabel rekening tetap tampil dengan nomor pengantar yang benar.
- Contoh PDF hasil generate tersedia untuk validasi manual.
- Detail unit test tidak perlu terlalu rinci di dokumen ini; implementor cukup menurunkan test dari skenario high-level di atas.
