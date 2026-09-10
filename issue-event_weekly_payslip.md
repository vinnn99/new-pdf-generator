# [BUG] Bulk Send Email `event_weekly_payslip` gagal menemukan lampiran karena filter periode

## Informasi Umum

- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Fitur terdampak: Bulk Send Email
- Template terdampak: `event_weekly_payslip`
- Endpoint existing: `POST /api/v1/send-event-weekly-payslip-emails`
- Prioritas yang disarankan: tinggi, karena email payroll tidak masuk antrean walaupun PDF sudah tersedia

## Latar Belakang

Di production, tabel `email_logs` menyimpan error berikut saat Bulk Send Email dijalankan untuk template `event_weekly_payslip`:

```text
Lampiran slip tidak ditemukan; email tidak dikirim. Filter: periode=2026-08,
template=event_weekly_payslip, employeeId=014, employeeName=sindi_ayu.
Folder dicek: public/download/PT. ORIGIN MAGDA INOVATION/rizqiarumdhita@indinesia.id
(exists=true, pdf=118).

PDF dengan employeeId ini ditemukan:
28-08-2026---30-08-2026.event_weekly_payslip.014.SINDI_AYU.mtv4tbet6YM55.pdf
26-08-2026---28-08-2026.event_weekly_payslip.014.SINDI_AYU.mtv4t9wiDTANF.pdf
22-08-2026---27-08-2026.event_weekly_payslip.014.SINDI_AYU.mtv4t8yr5XW15.pdf
```

File sebenarnya tersedia dan employee ID juga ditemukan, tetapi filter periode request berupa bulan (`2026-08`) tidak cocok dengan segmen periode pada filename yang berupa rentang tanggal (`28-08-2026---30-08-2026`). Akibatnya kandidat lampiran dibuang sebelum email masuk queue.

## Interpretasi Requirement

Frasa “employeeName dan employeeId dalam 1 batch” pada issue ini berarti pencarian dibatasi oleh `batch_id` hasil Bulk Generate PDF `event_weekly_payslip`.

Identitas lampiran menjadi:

```text
company_id + batch_id + template + employeeId + employeeName
```

`periode` tidak menjadi bagian dari pencarian lampiran untuk template ini.

Pendekatan berbasis batch dipilih karena satu employee dapat memiliki beberapa PDF mingguan di folder yang sama. Jika pencarian hanya menghapus periode lalu memilih file terbaru dari seluruh folder, sistem berisiko mengirim PDF dari proses generate atau rentang minggu yang berbeda.

## Temuan pada Implementasi Saat Ini

### Backend

1. `BulkEmailController.sendEventWeeklyPayslip()` masih meneruskan request ke `_sendSlipEmails(ctx, 'event_weekly_payslip')`.
2. `_sendSlipEmails()` membaca `periode`/`period` menjadi `periodPrefix`, lalu memanggil `findSlipAttachmentCandidates()`.
3. `findSlipAttachmentCandidates()` mensyaratkan hasil `slipPeriodMatches()` bernilai benar sebelum mencocokkan template, employee ID, dan nama.
4. Lookup dilakukan dengan scan seluruh folder `public/download/{company}/{email-user-login}`, bukan berdasarkan metadata batch.
5. Jika terdapat lebih dari satu kandidat, `pickNewestAttachment()` memilih file terbaru di seluruh folder. Perilaku ini tidak cukup aman untuk event weekly karena employee yang sama dapat memiliki beberapa slip mingguan.
6. Bulk Generate `event_weekly_payslip` sebenarnya sudah membuat record `generation_batches` dan `generation_batch_items`.
7. Match key saat generate sudah memakai gabungan `employeeId|employeeName`, dan batch item menyimpan `saved_path` hasil generate.
8. Backend sudah memiliki alur pengiriman attachment berbasis batch pada `_sendBaTemplate()`. Walaupun nama helper masih berorientasi BA, mekanisme query batch dan pemilihan `generation_batch_items` dapat digeneralisasi atau digunakan kembali secara terkontrol.

### Frontend

1. `event_weekly_payslip` saat ini dianggap sebagai mode slip tanpa batch melalui `slipAttachmentModes`.
2. Form masih menampilkan input **Periode (opsional)** untuk mode tersebut.
3. `sendEventWeeklyPayslipEmails()` masih mengirim `periode`, tetapi belum mengirim `batch_id`.
4. History dan pemilih Batch ID hanya ditampilkan untuk mode di luar `slipAttachmentModes`.
5. Test frontend saat ini secara eksplisit mengharapkan Event Weekly Payslip dapat dikirim tanpa `batch_id`; ekspektasi tersebut perlu diubah mengikuti kontrak baru.

## Tujuan

Setelah implementasi:

1. Bulk Send Email `event_weekly_payslip` tidak lagi memakai `periode` untuk mencari lampiran.
2. User memilih satu `batch_id` hasil Bulk Generate `event_weekly_payslip`.
3. Dalam batch tersebut, setiap baris email dicocokkan menggunakan `employeeId`/`NIK` dan `employeeName`.
4. Sistem hanya mengirim file yang tercatat pada batch terpilih dan benar-benar tersedia di disk.
5. Batch dari company atau template lain tidak dapat digunakan.
6. Error menjelaskan kondisi batch atau match key yang gagal tanpa menyarankan filter periode.
7. Bulk Send Email untuk `payslip`, `exel-payslip`, BA, cooperation agreement, dan template lain mempertahankan perilaku existing.

## Kontrak Perilaku yang Diharapkan

### Request

Endpoint tetap:

```text
POST /api/v1/send-event-weekly-payslip-emails
```

Form-data:

- `file`: XLS/XLSX daftar penerima, wajib.
- `batch_id`: batch hasil Bulk Generate `event_weekly_payslip`, wajib.
- `periode`/`period`: tidak digunakan untuk lookup event weekly. Untuk kompatibilitas client lama, backend boleh menerima field ini tetapi harus mengabaikannya.

Kolom spreadsheet minimum:

- `sentTo` atau `email`, wajib.
- `employeeId` atau `NIK`, wajib.
- `employeeName`, wajib.
- `body`, `cc`, dan `bcc`, opsional.

### Pencarian attachment

Untuk setiap row:

1. Validasi batch berdasarkan `batch_id`, `company_id` user login, dan template `event_weekly_payslip`.
2. Bentuk match key dari `employeeId` dan `employeeName` menggunakan aturan canonical yang sama dengan Bulk Generate.
3. Cari item hanya di `generation_batch_items` milik batch dan company tersebut.
4. Item wajib memiliki template `event_weekly_payslip`, status generate yang dapat dikirim, dan `saved_path` yang valid.
5. Pastikan file pada `saved_path` masih tersedia sebelum enqueue email.
6. Jangan melakukan fallback ke scan seluruh folder apabila item tidak ada dalam batch.
7. Jangan melakukan fallback employee ID saja. Kedua identitas, employee ID dan nama, harus cocok dalam batch yang dipilih.

### Normalisasi identitas

- Employee ID harus dibandingkan sebagai identifier, bukan angka perhitungan.
- Pertahankan leading zero seperti `014`; template Excel sebaiknya menjaga kolom NIK/employeeId sebagai text.
- Perbandingan nama bersifat case-insensitive dan mengabaikan spasi berulang.
- Pertimbangkan `_`, `-`, dan spasi sebagai separator nama yang ekuivalen agar `SINDI_AYU`, `SINDI AYU`, dan `sindi-ayu` dapat menghasilkan key pencarian yang sama.
- Aturan normalisasi pada proses generate dan proses send harus berasal dari helper yang sama atau minimal diuji agar tidak berbeda.

### Pemilihan kandidat

- Kondisi normal seharusnya menghasilkan satu item untuk satu match key dalam satu batch.
- Jika terdapat lebih dari satu item valid dengan match key yang sama di batch tersebut, gunakan aturan deterministic existing: item/file terbaru.
- Pemilihan terbaru hanya boleh dilakukan di dalam batch terpilih, bukan di seluruh folder company.

### Batch belum siap

- Batch yang masih diproses queue tidak boleh menyebabkan pencarian diam-diam beralih ke file dari batch lain.
- Jika item terkait belum memiliki `saved_path`, berstatus pending/queued, atau filenya belum tersedia, row ditandai gagal/skipped dengan pesan bahwa hasil generate batch belum siap.
- Response dan `email_logs` perlu menyertakan minimal `batch_id`, template, employee ID, employee name/match key, dan alasan kegagalan.
- Jangan memasukkan filter `periode` dalam diagnostic baru untuk event weekly.

## Rencana Implementasi Backend

### 1. Ubah entry point Event Weekly Bulk Send

File utama:

- `app/Controllers/Http/BulkEmailController.js`

Perubahan:

- Ubah `sendEventWeeklyPayslip()` agar memakai lookup berbasis batch, bukan `_sendSlipEmails()` yang melakukan scan folder dan filter periode.
- Pertahankan route existing agar integrasi tidak perlu mengganti URL.
- Gunakan konfigurasi khusus:
  - template: `event_weekly_payslip`;
  - required fields: `employeeId` dan `employeeName`;
  - context log: `bulk-slip` atau context existing yang sudah dipakai endpoint ini;
  - subject/body default tetap slip gaji mingguan/event.
- Wajib membaca `batch_id` atau alias `batchId` dari form-data.

### 2. Gunakan mekanisme attachment berbasis batch

File utama:

- `app/Controllers/Http/BulkEmailController.js`

Pilihan implementasi yang disarankan:

- Generalisasi `_sendBaTemplate()` menjadi helper pengiriman attachment berbasis batch yang dapat dipakai BA, cooperation agreement, dan event weekly; atau
- Pertahankan helper tersebut dan tambahkan konfigurasi event weekly bila refactor nama terlalu berisiko.

Hal yang wajib dijaga bila melakukan refactor:

- Semua caller BA dan cooperation agreement menghasilkan response, subject/body, log, dan attachment yang sama seperti sebelumnya.
- Query batch selalu menyertakan `company_id` dan `template`.
- Query batch item selalu dibatasi oleh `batch_id`, `company_id`, dan `template`.
- Payload `SendEmailJob` untuk event weekly membawa `employeeId` dan `employeeName` yang benar.
- File dipilih dari `saved_path` batch item, bukan dari hasil scan directory berdasarkan filename.

### 3. Samakan builder match key generate dan send

Files:

- `app/Controllers/Http/BulkPdfController.js`
- `app/Controllers/Http/BulkEmailController.js`

File baru opsional jika diperlukan agar tidak menduplikasi aturan:

- `app/Services/EventWeeklyPayslipBatchService.js`

Tanggung jawab helper/service bila dibuat:

- mengambil `employeeId` dari `employeeId`, `employee_id`, atau `NIK`;
- mengambil nama dari `employeeName`, `employee_name`, atau `nama`;
- melakukan canonicalization ID dan nama;
- menghasilkan match key stabil `employeeId|employeeName`;
- dapat digunakan oleh Bulk Generate dan Bulk Send.

Saat membaca batch lama, canonical-kan juga nilai `generation_batch_items.match_key` sebelum dibandingkan bila diperlukan untuk kompatibilitas separator nama. Jangan melakukan migration massal hanya untuk task ini kecuali terbukti diperlukan.

### 4. Perbaiki validasi dan diagnostic

File:

- `app/Controllers/Http/BulkEmailController.js`

Expected error:

- `422` jika `batch_id` tidak diisi.
- `404` jika batch tidak ditemukan untuk kombinasi company dan template.
- Error per row jika `sentTo`, employee ID, atau employee name kosong.
- Error per row jika match key tidak ada di batch.
- Error yang berbeda jika item ada tetapi PDF belum selesai dibuat atau file sudah hilang.

Diagnostic tidak perlu mencantumkan daftar contoh PDF dari seluruh folder karena lookup sudah dibatasi batch. Informasi yang lebih relevan adalah status batch, `batch_id`, match key, jumlah item kandidat, status item, dan ketersediaan file.

### 5. Route dan database

Files untuk diverifikasi:

- `start/routes.js`
- migration/schema `generation_batches` dan `generation_batch_items` yang sudah ada

Expected:

- Tidak perlu route baru; endpoint existing tetap digunakan.
- Tidak perlu migration baru selama kolom `batch_id`, `company_id`, `template`, `match_key`, `status`, `saved_path`, dan `filename` sudah mencukupi.
- Jangan mengubah format filename PDF event weekly; batch metadata menjadi sumber lookup utama.

## Rencana Implementasi Frontend

### 1. Ubah kontrak request API

File:

- `D:\\eis\\ui-pdf-generator\\src\\api\\bulkApi.js`

Perubahan:

- Ubah `sendEventWeeklyPayslipEmails()` agar menerima `batchId`.
- Kirim `batch_id` dalam form-data.
- Hentikan pengiriman `periode` untuk mode `event_weekly_payslip`.
- Endpoint tetap `/v1/send-event-weekly-payslip-emails`.

### 2. Ubah UI Bulk Send Email

File:

- `D:\\eis\\ui-pdf-generator\\src\\components\\forms\\SendEmailsForm.jsx`

Perubahan:

- Untuk `event_weekly_payslip`, sembunyikan input Periode.
- Tampilkan input/pemilih Batch ID dan history batch khusus template `event_weekly_payslip`.
- Wajibkan Batch ID sebelum dialog konfirmasi dan request dikirim.
- Kirim `file` dan `batchId` ke `sendEventWeeklyPayslipEmails()`.
- Pada dialog konfirmasi, tampilkan Batch ID dan jangan tampilkan Periode.
- Ubah hint attachment agar menjelaskan pencarian berdasarkan batch + NIK/employeeId + employeeName.
- Ubah daftar kolom agar `periode` tidak lagi ditampilkan sebagai field lookup.

Hindari memakai satu boolean yang menyamakan semua slip. Pisahkan konsep berikut agar template lain tidak berubah:

- mode yang memakai filter periode;
- mode yang membutuhkan batch ID;
- mode yang memakai endpoint khusus event weekly;
- mode BA/cooperation agreement yang sudah memakai batch.

### 3. Update template spreadsheet pengiriman

File untuk diverifikasi dan kemungkinan dimodifikasi:

- `D:\\eis\\ui-pdf-generator\\public\\templates\\send-event-weekly-payslip-emails.xlsx`

Perubahan yang disarankan:

- Hapus kolom `periode` dari template download karena tidak lagi dipakai sebagai filter.
- Pertahankan `sentTo`, `NIK`/`employeeId`, `employeeName`, `body`, `cc`, dan `bcc`.
- Format kolom NIK/employeeId sebagai text agar leading zero tidak hilang.
- Tidak perlu menambahkan `batch_id` pada setiap row; Batch ID dipilih sekali pada form dan berlaku untuk seluruh file upload.

Backend boleh tetap mengabaikan kolom `periode` dari workbook lama agar file lama tidak langsung gagal hanya karena memiliki kolom ekstra.

### 4. Allowed templates dan scope

- Opsi Event Weekly Payslip tetap mengikuti `allowed_templates` company seperti behavior existing.
- Daftar batch di frontend harus difilter ke `event_weekly_payslip`.
- Backend tetap menjadi sumber otorisasi: user/admin hanya dapat memakai batch company sendiri.
- Mengetahui `batch_id` company lain tidak boleh memberikan akses ke attachment.

## Update Dokumentasi

Files:

- `API_DOCUMENTATION.md`
- `README.md` bila masih memuat kontrak Bulk Send Email yang sama

Dokumentasikan:

1. `batch_id` menjadi wajib untuk `/send-event-weekly-payslip-emails`.
2. `periode` tidak lagi dipakai untuk lookup attachment event weekly.
3. Match dilakukan menggunakan employee ID dan employee name di dalam batch terpilih.
4. Response sukses menyertakan `batch_id`.
5. Batch harus berasal dari Bulk Generate `event_weekly_payslip`, berada pada company yang sama, dan item PDF harus sudah selesai diproses queue.
6. Template XLSX pengiriman yang baru tidak membutuhkan kolom periode.
7. Perilaku endpoint/template Bulk Send Email lain tetap seperti sebelumnya.

## File yang Diperkirakan Dimodifikasi

### Backend — wajib

1. `app/Controllers/Http/BulkEmailController.js`
2. `test/functional/api_endpoint_matrix.spec.js` atau functional test setara untuk Bulk Send Event Weekly
3. `API_DOCUMENTATION.md`

### Backend — verifikasi/ubah jika diperlukan

1. `app/Controllers/Http/BulkPdfController.js` untuk menyamakan helper match key
2. `start/routes.js` hanya untuk memastikan route existing tetap benar
3. `README.md`

### Backend — file baru opsional

1. `app/Services/EventWeeklyPayslipBatchService.js`
2. Unit test service tersebut jika helper canonicalization dipisahkan

### Frontend — wajib

1. `D:\\eis\\ui-pdf-generator\\src\\api\\bulkApi.js`
2. `D:\\eis\\ui-pdf-generator\\src\\components\\forms\\SendEmailsForm.jsx`
3. `D:\\eis\\ui-pdf-generator\\src\\components\\forms\\SendEmailsForm.test.jsx`
4. `D:\\eis\\ui-pdf-generator\\public\\templates\\send-event-weekly-payslip-emails.xlsx`

Tidak ada migration atau endpoint baru yang direncanakan.

## Urutan Implementasi yang Disarankan

1. Tetapkan satu fungsi canonical match key untuk employee ID dan nama.
2. Ubah endpoint event weekly agar memvalidasi batch dan mengambil attachment dari batch item.
3. Perbarui diagnostic serta payload job/email log.
4. Ubah API frontend untuk mengirim Batch ID tanpa periode.
5. Ubah form agar Event Weekly menampilkan pemilih batch dan menyembunyikan periode.
6. Perbarui template spreadsheet pengiriman.
7. Perbarui dokumentasi API dan README.
8. Jalankan test event weekly serta regression test Bulk Send Email template lain.

## Skenario Pengujian

Detail implementasi test diserahkan kepada programmer/model yang mengerjakan. Minimal skenario yang harus dicakup:

### Event Weekly Payslip

- PDF dengan nama periode rentang tanggal dapat ditemukan walaupun request tidak membawa periode.
- Batch dengan beberapa minggu untuk employee yang sama hanya mengirim PDF dari batch yang dipilih.
- Employee ID dan employee name yang cocok menghasilkan satu attachment dan email masuk queue.
- Variasi kapitalisasi serta separator nama (`_`, `-`, spasi) tetap cocok secara canonical.
- Leading zero employee ID tetap dipertahankan.
- Batch ID kosong ditolak.
- Batch dari company lain atau template lain tidak dapat dipakai.
- Employee ID saja tanpa nama yang cocok tidak boleh mengambil attachment.
- Item batch yang belum selesai, tidak memiliki `saved_path`, atau file-nya hilang menghasilkan error informatif dan tidak mengirim email.
- Jika ada duplikasi match key dalam batch, pemilihan file tetap deterministic.
- `email_logs` dan response menyimpan informasi batch/match yang cukup untuk troubleshooting tanpa filter periode.

### Frontend

- Mode Event Weekly tidak menampilkan input Periode.
- Mode Event Weekly menampilkan daftar/input Batch ID khusus template tersebut.
- Submit tanpa Batch ID ditolak di frontend.
- Request mengirim `file` dan `batch_id`, tanpa `periode`.
- Template spreadsheet download tidak lagi mengarahkan user mengisi periode.

### Regression

- Bulk Send `payslip` dan `exel-payslip` tetap memakai mekanisme existing masing-masing.
- Bulk Send BA dan cooperation agreement tetap menggunakan batch dan match key existing.
- Generate Bulk `event_weekly_payslip` serta lifecycle batch item tetap berjalan.
- Single Email dan Generate Single PDF tidak berubah.

## Acceptance Criteria

- [ ] Bulk Send Email `event_weekly_payslip` tidak menggunakan periode sebagai filter attachment.
- [ ] Request wajib memilih satu `batch_id` hasil Bulk Generate `event_weekly_payslip`.
- [ ] Attachment dicari hanya dalam company, template, dan batch yang dipilih.
- [ ] Match lampiran membutuhkan employee ID dan employee name yang sama secara canonical.
- [ ] Tidak ada fallback ke employee ID saja atau scan seluruh folder untuk event weekly.
- [ ] PDF dengan filename periode berupa rentang tanggal dapat dikirim tanpa parsing periode.
- [ ] Batch yang belum selesai menghasilkan pesan yang jelas dan tidak mengambil file batch lain.
- [ ] Frontend tidak menampilkan atau mengirim filter Periode untuk Event Weekly.
- [ ] Frontend menampilkan pemilih/history Batch ID Event Weekly.
- [ ] XLSX Bulk Send Event Weekly tidak lagi membutuhkan kolom periode dan menjaga leading zero NIK.
- [ ] Akses batch tetap company-scoped dan mengikuti `allowed_templates`.
- [ ] `API_DOCUMENTATION.md` telah diperbarui sesuai kontrak baru.
- [ ] Bulk Send Email template lain tidak mengalami perubahan perilaku.
- [ ] Seluruh regression test terkait lulus.

## Out of Scope

- Mengubah layout atau perhitungan PDF `event_weekly_payslip`.
- Mengubah format filename PDF yang sudah dihasilkan.
- Mengubah endpoint Send Single Email.
- Mengubah mekanisme attachment template selain `event_weekly_payslip`.
- Mengirim semua slip mingguan employee sekaligus; satu row email tetap mengirim satu attachment dari batch terpilih.
- Mencari PDF historis yang tidak memiliki metadata batch. Jika diperlukan, pekerjaan backfill/migrasi harus dibuat sebagai issue terpisah.

## Catatan Operasional Deployment

- Deploy backend lebih dahulu atau bersamaan dengan frontend karena frontend baru akan mengirim `batch_id`.
- Pastikan worker queue Bulk Generate sudah menyelesaikan item batch sebelum Bulk Send dijalankan.
- Untuk file lama yang dibuat sebelum memiliki metadata batch, lakukan generate ulang atau rencanakan backfill terpisah; jangan fallback diam-diam ke seluruh folder.
- Setelah deployment, pantau `email_logs` untuk memastikan error tidak lagi mencantumkan mismatch periode `2026-08` terhadap rentang tanggal filename.
