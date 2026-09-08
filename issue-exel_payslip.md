# Issue: Tambah Tunjangan Sewa Motor pada Template `exel-payslip`

## Informasi Umum

- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Template backend yang terkait: `exel-payslip`
- Nama issue/dokumen: `issue-exel_payslip.md`

## Latar Belakang

Template `exel-payslip` saat ini sudah mendukung beberapa komponen pendapatan seperti `Gaji Pokok`, `Tunjangan Makan`, `Tunjangan Transport`, `Tunjangan Komunikasi`, `Tunjangan Jabatan`, dan `Tunjangan BPJS Ketenagakerjaan`.

Dibutuhkan penambahan komponen baru:

- Label tampilan: `Tunjangan Sewa Motor`
- Tipe: `earning` / pendapatan
- Nilai masuk ke subtotal pendapatan dan ikut mempengaruhi `Gaji Bersih (Net)`

Penambahan ini harus tersedia di alur:

1. Backend template `exel-payslip`
2. Frontend `Bulk Generate PDF`
3. Frontend `Generate Single PDF`
4. Frontend `Send Single Email`
5. Frontend `Bulk Send Email`
6. Header template Excel untuk `Bulk Generate PDF`

## Tujuan

Setelah implementasi, user dapat mengisi `Tunjangan Sewa Motor` untuk template `exel-payslip`, baik dari form frontend maupun upload Excel bulk. Nilai tersebut harus muncul sebagai baris pendapatan pada PDF slip gaji dan dihitung dalam total pendapatan.

## Batasan Penting

Perubahan ini hanya boleh berlaku untuk template `exel-payslip`.

Jangan mengubah perilaku template lain walaupun sejenis, termasuk:

- `payslip`
- `insentif`
- `thr`
- `event_weekly_payslip`

Implementasi harus menjaga agar field `Tunjangan Sewa Motor` tidak otomatis muncul, dihitung, atau diwajibkan pada template selain `exel-payslip`.

## Scope Backend

### 1. Normalisasi Payload Slip

File utama:

- `core.pdf-generator.indinesia.id/app/Services/SlipPayloadNormalizer.js`

Tambahkan mapping alias untuk `Tunjangan Sewa Motor` pada cabang khusus `EXEL_PAYSLIP_TEMPLATE`.

Jangan tambahkan mapping ini pada cabang normalisasi umum untuk template slip lain.

Field canonical yang disarankan:

- `tunjanganSewaMotor`

Alias yang perlu didukung:

- `tunjanganSewaMotor`
- `tunjangan_sewa_motor`
- `tunjangan sewa motor`
- `sewaMotorAllowance`
- `sewa_motor_allowance`
- `motorRentalAllowance`
- `motor_rental_allowance`

Tambahkan sebagai earning dengan label:

- `Tunjangan Sewa Motor`

Pastikan nilai `0`, kosong, atau tidak ada tidak membuat baris pendapatan palsu.

### 2. Template PDF `exel-payslip`

File yang perlu dicek:

- `core.pdf-generator.indinesia.id/app/Templates/exel-payslip.js`

Template ini sudah membaca `data.earnings`, menghitung subtotal pendapatan, dan menampilkan semua item earning. Jika normalisasi payload sudah memasukkan `Tunjangan Sewa Motor` ke `earnings`, kemungkinan file ini tidak perlu perubahan besar.

Yang harus dipastikan:

- Baris `Tunjangan Sewa Motor` muncul di section `Pendapatan`
- Nilainya ikut `Total Pendapatan`
- Nilainya ikut perhitungan `Gaji Bersih (Net)`
- Format rupiah mengikuti item earning lain

### 3. Bulk Generate PDF dari Excel

File yang perlu dicek/modifikasi:

- `core.pdf-generator.indinesia.id/app/Controllers/Http/BulkPdfController.js`

Di fungsi builder payload untuk `exel-payslip`, tambahkan pembacaan kolom Excel untuk `Tunjangan Sewa Motor`.

Pastikan header Excel berikut dikenali:

- `Tunjangan Sewa Motor`
- `tunjangan sewa motor`
- `tunjanganSewaMotor`
- `tunjangan_sewa_motor`

Payload hasil parsing harus mengirim nilai ke field canonical `tunjanganSewaMotor` atau langsung masuk ke `earnings` sesuai pola yang sudah ada di file tersebut.

### 4. Generate Single PDF

File backend yang perlu dicek:

- `core.pdf-generator.indinesia.id/app/Services/TemplateResolver.js`
- `core.pdf-generator.indinesia.id/app/Jobs/GeneratePdfJob.js`
- Controller generate single PDF yang memanggil resolver/job terkait

Pastikan payload single generate dengan template `exel-payslip` dapat menerima field `tunjanganSewaMotor` dan tetap lewat `SlipPayloadNormalizer`.

Jika alur single generate sudah memakai normalizer global, tidak perlu menambah logic khusus selain memastikan field dari frontend terkirim.

### 5. Send Single Email

File backend yang perlu dicek:

- `core.pdf-generator.indinesia.id/app/Controllers/Http/SingleEmailController.js`
- `core.pdf-generator.indinesia.id/app/Services/SlipPayloadNormalizer.js`

Pastikan saat user memilih template `exel-payslip` di `Send Single Email`, field `tunjanganSewaMotor` ikut diterima dan masuk ke PDF attachment yang dibuat sebelum email dikirim.

### 6. Bulk Send Email

File backend yang perlu dicek:

- `core.pdf-generator.indinesia.id/app/Controllers/Http/BulkEmailController.js`

Catatan penting: alur `Bulk Send Email` untuk slip biasanya mencari lampiran PDF yang sudah digenerate sebelumnya, bukan membangun ulang semua komponen payslip dari earning. Implementer wajib cek flow aktual terlebih dahulu.

Jika file Excel bulk email hanya berisi data penerima dan pencarian lampiran, maka tidak perlu menambah `Tunjangan Sewa Motor` di parser backend bulk email.

Jika ternyata mode `exel-payslip` pada bulk email juga bisa membuat/mengubah payload PDF, tambahkan mapping `Tunjangan Sewa Motor` dengan alias yang sama seperti bulk generate.

## Scope Frontend

### 1. Daftar Field Template

File utama:

- `ui-pdf-generator/src/utils/templateFields.js`

Tambahkan field pada template `exel-payslip`:

- `name`: `tunjanganSewaMotor`
- `label`: `Tunjangan Sewa Motor`
- `type`: `number`

Letakkan di bagian earning, idealnya setelah `Tunjangan Transport` atau sesuai urutan bisnis yang diharapkan.

Jangan tambahkan field ini ke konfigurasi template `payslip`, `insentif`, `thr`, atau `event_weekly_payslip`.

### 2. Bulk Generate PDF

File yang perlu dicek/modifikasi:

- `ui-pdf-generator/src/components/forms/BulkGenerateForm.jsx`

Tambahkan header `Tunjangan Sewa Motor` pada konfigurasi kolom untuk mode `exel-payslip`.

Update juga template Excel static:

- `ui-pdf-generator/public/templates/exel-payslip.xlsx`

Header baru wajib ada di template download Bulk Generate PDF supaya user bisa mengisi tunjangan ini lewat upload Excel.

### 3. Generate Single PDF

File yang perlu dicek/modifikasi:

- `ui-pdf-generator/src/components/forms/GeneratePdfForm.jsx`
- `ui-pdf-generator/src/pages/GeneratePdfPage.jsx`

Pastikan field `tunjanganSewaMotor` muncul saat user memilih template `exel-payslip`, bertipe angka, dan dikirim dalam payload generate PDF.

Jika form ini sepenuhnya membaca dari `templateFields.js`, cukup update konfigurasi field dan verifikasi hasil payload.

### 4. Send Single Email

File yang perlu dicek/modifikasi:

- `ui-pdf-generator/src/components/forms/SendSingleEmailForm.jsx`
- `ui-pdf-generator/src/pages/SendSingleEmailPage.jsx`

Pastikan field `tunjanganSewaMotor` tersedia untuk template `exel-payslip` dan ikut dikirim ke backend saat PDF dibuat sebagai attachment email.

Jika form ini memakai konfigurasi shared dari `templateFields.js`, cukup pastikan field baru otomatis muncul dan terkirim.

### 5. Bulk Send Email

File yang perlu dicek/modifikasi:

- `ui-pdf-generator/src/components/forms/SendEmailsForm.jsx`

Update hanya jika mode `exel-payslip` pada bulk email memang membutuhkan kolom earning di Excel.

Jika template Excel bulk email hanya dipakai untuk `sentTo`, `employeeId`, `employeeName`, `period`, `body`, `cc`, dan `bcc`, jangan tambahkan kolom earning ke template email karena bisa membingungkan user.

Template Excel yang perlu dicek:

- `ui-pdf-generator/public/templates/send-exel-payslip-emails.xlsx`

## Template Excel yang Harus Diupdate

Wajib:

- `ui-pdf-generator/public/templates/exel-payslip.xlsx`

Opsional, hanya jika flow bulk email membutuhkan data earning:

- `ui-pdf-generator/public/templates/send-exel-payslip-emails.xlsx`

Header baru yang disarankan:

```text
Tunjangan Sewa Motor
```

Pastikan urutan header frontend dan parser backend konsisten.

## Skenario Test yang Perlu Dilakukan

Backend:

- Generate `exel-payslip` dengan `tunjanganSewaMotor > 0`, lalu pastikan PDF berisi baris `Tunjangan Sewa Motor`.
- Pastikan `Tunjangan Sewa Motor` masuk ke total pendapatan dan net salary.
- Generate dengan `tunjanganSewaMotor` kosong atau `0`, lalu pastikan tidak ada baris pendapatan tambahan yang tidak perlu.
- Upload Excel bulk generate dengan header `Tunjangan Sewa Motor`, lalu pastikan payload dan PDF benar.
- Verifikasi alias header snake case, camel case, dan lowercase masih terbaca.
- Generate template sejenis selain `exel-payslip`, lalu pastikan `Tunjangan Sewa Motor` tidak muncul dan tidak ikut dihitung.

Frontend:

- Pada `Generate Single PDF`, pilih `exel-payslip`, isi `Tunjangan Sewa Motor`, lalu pastikan request payload berisi nilai tersebut.
- Pada `Send Single Email`, pilih `exel-payslip`, isi `Tunjangan Sewa Motor`, lalu pastikan payload email/generate PDF membawa nilai tersebut.
- Pada `Bulk Generate PDF`, download template Excel dan pastikan header `Tunjangan Sewa Motor` tersedia.
- Upload Excel bulk generate dengan nilai `Tunjangan Sewa Motor`, lalu pastikan proses berhasil.
- Pada `Bulk Send Email`, cek apakah template email memang membutuhkan kolom earning. Jika tidak, pastikan flow tetap berjalan tanpa perubahan kolom.

## Acceptance Criteria

- `Tunjangan Sewa Motor` tampil sebagai earning di PDF `exel-payslip`.
- Nilai `Tunjangan Sewa Motor` dihitung dalam subtotal pendapatan.
- Nilai `Tunjangan Sewa Motor` mempengaruhi `Gaji Bersih (Net)`.
- Field tersedia di frontend untuk `Bulk Generate PDF`, `Generate Single PDF`, dan `Send Single Email`.
- Header `Tunjangan Sewa Motor` tersedia di template Excel `Bulk Generate PDF`.
- `Bulk Send Email` sudah diverifikasi: diupdate jika flow membutuhkan earning, atau dibiarkan jika hanya mencari lampiran PDF.
- Tidak ada regresi pada earning/potongan existing.
- Template selain `exel-payslip` tidak berubah perilakunya.
