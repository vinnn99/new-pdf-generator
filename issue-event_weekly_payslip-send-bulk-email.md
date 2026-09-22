# Issue: Gabungkan Email dan Semua Lampiran Duplikat pada Bulk Send `event_weekly_payslip`

## Ringkasan

Ubah perilaku khusus endpoint Bulk Send Email `event_weekly_payslip` agar data penerima yang memiliki nama dan alamat email sama tidak dikirim berulang kali.

Jika dalam satu batch terdapat lebih dari satu PDF untuk penerima tersebut, sistem harus mengirim **satu email dengan seluruh PDF yang cocok sebagai lampiran**.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Endpoint terkait:

```text
POST /api/v1/send-event-weekly-payslip-emails
```

## Scope

- Bulk Send Email untuk template `event_weekly_payslip`.
- Pengelompokan baris penerima yang duplikat.
- Pengambilan seluruh PDF Event Weekly yang cocok dari satu batch.
- Satu job email dan satu email log untuk satu kelompok penerima.
- Penyesuaian response, log, hint frontend, test, dan dokumentasi terkait.

## Masalah

Bulk Generate `event_weekly_payslip` dapat menghasilkan beberapa PDF untuk nama dan email yang sama karena isi slip pada setiap baris dapat berbeda.

Contoh kondisi:

```text
Batch: batch-event-weekly-001

PDF 1: karyawan/event yang sama, isi slip A
PDF 2: karyawan/event yang sama, isi slip B

Excel Bulk Send Email:
Row 1: penerima dan nama yang sama
Row 2: penerima dan nama yang sama
```

Perilaku saat ini:

1. Backend membaca dan memproses setiap baris Excel secara terpisah.
2. Dua baris penerima yang sama menghasilkan dua job email.
3. Beberapa `generation_batch_items` dengan `match_key` sama sudah dikumpulkan sebagai kandidat.
4. Namun, helper `pickLatestBatchAttachment()` hanya memilih satu file paling baru.
5. Kedua email akhirnya menggunakan file terbaru yang sama sebagai lampiran.
6. PDF lain dalam batch tidak pernah dikirim.

Perilaku yang diharapkan:

```text
2 baris penerima yang sama + 2 PDF yang cocok dalam batch
                            ↓
                 1 email + 2 lampiran PDF
```

## Temuan Implementasi Saat Ini

### Backend

File utama:

```text
app/Controllers/Http/BulkEmailController.js
```

Alur existing:

- `sendEventWeeklyPayslip()` menggunakan helper `_sendBaTemplate()` dengan konfigurasi template `event_weekly_payslip`.
- Batch dibatasi berdasarkan `batch_id`, `company_id`, dan template.
- Item batch dikelompokkan di `attachmentsByMatchKey`.
- Match key Event Weekly dibentuk dari `employeeId/NIK + employeeName` yang dinormalisasi.
- Loop `_sendBaTemplate()` tetap berjalan per baris spreadsheet email.
- Setiap baris mengambil kandidat dari `attachmentsByMatchKey[matchKey]`.
- `pickLatestBatchAttachment(candidates)` hanya mengembalikan satu kandidat terbaru.
- `EmailLogService.createQueued()` dan `SendEmailJob` sebenarnya sudah menerima `attachments` dalam bentuk array, sehingga tidak diperlukan perubahan schema database atau format job untuk mendukung beberapa lampiran.

Test fungsional existing berada di:

```text
test/functional/api_endpoint_matrix.spec.js
```

Test tersebut baru mencakup satu batch item, satu baris spreadsheet, satu job email, dan satu attachment.

### Frontend

File utama:

```text
src/components/forms/SendEmailsForm.jsx
```

Frontend sudah:

- meminta `batch_id` untuk Event Weekly Payslip;
- mengirim file dan `batch_id` melalui `sendEventWeeklyPayslipEmails()`;
- menampilkan history/pemilih batch;
- menjelaskan lookup berdasarkan `NIK/employeeId` dan `employeeName`.

Tidak diperlukan endpoint atau field request frontend baru. Frontend hanya perlu memperjelas bahwa baris dengan penerima dan nama sama akan digabung, serta seluruh PDF yang cocok dalam batch akan dilampirkan.

## Tujuan

1. Dua atau lebih baris email dengan nama dan alamat penerima yang sama menghasilkan satu email.
2. Email tersebut memuat seluruh PDF `event_weekly_payslip` yang cocok dalam batch terpilih.
3. Tidak ada PDF yang dipilih hanya karena merupakan file paling baru jika terdapat beberapa PDF yang memang harus dikirim bersama.
4. Tidak ada attachment yang sama dimasukkan dua kali.
5. `email_logs` mencatat satu pengiriman dengan seluruh nama attachment.
6. Perilaku template lain tetap sama seperti sebelumnya.

## Aturan Pengelompokan yang Disarankan

### Identitas kelompok email

Khusus `event_weekly_payslip`, kelompokkan baris spreadsheet berdasarkan gabungan:

```text
normalized sentTo/email + normalized employeeName
```

Normalisasi yang disarankan:

- email: `trim()` dan lowercase;
- nama: gunakan aturan canonical Event Weekly existing, yaitu lowercase, trim, `_`/`-` dianggap spasi, dan spasi berulang diringkas.

Konsekuensi:

- email sama + nama sama: satu kelompok email;
- email berbeda + nama sama: tetap dua email;
- email sama + nama berbeda: tetap dua email;
- kapitalisasi atau variasi separator nama tidak menyebabkan email ganda.

`employeeId/NIK` tetap wajib dan tetap digunakan untuk membentuk match key attachment. Dalam satu kelompok penerima, kumpulkan seluruh match key unik dari baris-baris anggota. Hal ini tetap mendukung kasus nama dan email sama tetapi `NIK` pada sumber data berbeda.

Jangan mengelompokkan hanya berdasarkan alamat email. Satu alamat email dapat dipakai oleh lebih dari satu orang, sehingga mencampurkan slip dengan nama berbeda berisiko mengirim data payroll kepada kelompok yang salah.

### Pemilihan isi email

Untuk kelompok yang memiliki beberapa baris:

- baris dengan nomor paling kecil menjadi baris utama;
- `subject` dan `body` menggunakan override dari baris utama atau default existing;
- `cc` dan `bcc` digabung dari seluruh baris anggota lalu dideduplikasi secara case-insensitive;
- data identitas untuk subject/default body menggunakan baris utama;
- response dan diagnostic harus menyimpan seluruh nomor baris sumber agar mudah ditelusuri.

Jika implementer memilih kebijakan berbeda untuk konflik `subject`/`body`, kebijakan tersebut harus tetap deterministic dan didokumentasikan. Jangan membuat hasil bergantung pada urutan query database yang tidak eksplisit.

## Aturan Pengumpulan Attachment

Untuk setiap kelompok penerima:

1. Bentuk seluruh match key unik dari baris-baris kelompok.
2. Ambil seluruh batch item yang cocok dari `attachmentsByMatchKey`.
3. Hanya gunakan item milik `batch_id`, `company_id`, dan template `event_weekly_payslip` yang sudah divalidasi sebelumnya.
4. Pertahankan persyaratan status sukses yang sudah digunakan Event Weekly.
5. Resolve `saved_path` dan pastikan file tersedia.
6. Gabungkan attachment dari seluruh match key kelompok.
7. Deduplicate berdasarkan identitas batch item dan path file canonical agar satu PDF tidak terlampir dua kali akibat baris spreadsheet duplikat.
8. Urutkan attachment secara deterministic, disarankan berdasarkan `row_no ASC`, kemudian `id ASC` atau filename sebagai tie-breaker.
9. Dispatch satu `SendEmailJob` dengan array seluruh attachment.

Contoh payload job yang diharapkan:

```js
attachments: [
  { filename: 'weekly-a.pdf', path: '/path/weekly-a.pdf' },
  { filename: 'weekly-b.pdf', path: '/path/weekly-b.pdf' }
]
```

Untuk data payroll, jangan diam-diam mengirim email parsial jika salah satu batch item yang seharusnya menjadi attachment tidak dapat di-resolve atau file hilang. Kelompok tersebut sebaiknya gagal/dilewati dengan diagnostic yang menyebut attachment bermasalah agar operator dapat memperbaiki batch sebelum mengirim ulang.

## Rencana Implementasi Backend

### 1. Tambahkan konfigurasi khusus Event Weekly

File:

```text
app/Controllers/Http/BulkEmailController.js
```

Pada konfigurasi `sendEventWeeklyPayslip()`, tambahkan flag/config yang eksplisit, misalnya:

```js
groupRecipientRows: true,
attachAllMatchingBatchItems: true
```

Nama flag dapat disesuaikan dengan gaya kode project. Yang penting, flag hanya aktif pada `event_weekly_payslip`.

Jangan mengubah default helper bersama menjadi attach-all atau group-all karena `_sendBaTemplate()` juga dipakai BA dan Cooperation Agreement.

### 2. Pisahkan tahap normalisasi/validasi dari tahap dispatch

Saat ini `_sendBaTemplate()` langsung melakukan validasi, lookup, dan dispatch di dalam loop per baris. Agar duplikat dapat digabung, flow Event Weekly perlu menjadi:

```text
read rows
  → normalize rows
  → validate recipient dan required fields
  → build recipient groups
  → collect all matching attachments per group
  → dispatch one email per group
```

Pilihan implementasi:

- perluas `_sendBaTemplate()` menggunakan config khusus; atau
- buat helper kecil/dedicated path untuk pengelompokan Event Weekly lalu gunakan fungsi validasi dan dispatch bersama.

Pendekatan mana pun boleh dipilih selama cabang default untuk template lain tetap memproses satu baris menjadi satu email dan tetap memilih satu attachment seperti sekarang.

### 3. Ganti single attachment menjadi multi-attachment khusus Event Weekly

File:

```text
app/Controllers/Http/BulkEmailController.js
```

Tambahkan helper yang mengembalikan seluruh attachment valid, misalnya:

```text
resolveBatchAttachments(items) -> attachment[]
```

Helper baru perlu:

- melakukan resolve `saved_path`;
- memeriksa keberadaan file;
- melakukan deduplikasi;
- mengurutkan hasil secara deterministic;
- mengembalikan metadata item yang cukup untuk diagnostic.

Pertahankan `pickLatestBatchAttachment()` untuk BA, Cooperation Agreement, dan caller existing lainnya. Jangan mengganti perilaku helper tersebut secara global.

### 4. Buat satu email log dan satu job per kelompok

Untuk satu kelompok Event Weekly:

- panggil `EmailLogService.createQueued()` satu kali;
- isi `attachments` dengan seluruh attachment kelompok;
- dispatch `App/Jobs/SendEmailJob` satu kali;
- pertahankan `template: event_weekly_payslip` dan `context: bulk-slip`;
- simpan daftar source row, match key, dan jumlah kandidat pada log diagnostic `bulk-email.log`.

Tidak diperlukan perubahan pada `SendEmailJob` atau `EmailLogService` jika hasil verifikasi menunjukkan keduanya sudah menerima array attachment dengan benar.

### 5. Perjelas response endpoint

Pertahankan field response existing agar frontend tetap kompatibel:

```text
status
total
queued
failed
skipped
batch_id
results
```

Semantik yang disarankan:

- `total`: jumlah baris sumber spreadsheet, untuk kompatibilitas/audit;
- `queued`, `failed`, `skipped`: jumlah kelompok email/job, bukan jumlah baris duplikat;
- tambahkan `total_groups` atau `recipient_groups` untuk menjelaskan jumlah kelompok unik;
- satu item `results` mewakili satu kelompok penerima.

Contoh result:

```json
{
  "row": 1,
  "source_rows": [1, 2],
  "status": "queued",
  "to": "crew@example.com",
  "attachment": "weekly-a.pdf",
  "attachments": ["weekly-a.pdf", "weekly-b.pdf"],
  "attachment_count": 2
}
```

Pertahankan field singular `attachment` berisi attachment pertama untuk kompatibilitas dengan consumer/test existing, lalu tambahkan `attachments` sebagai daftar lengkap.

## Rencana Implementasi Frontend

### 1. Perbarui penjelasan attachment

File:

```text
D:\eis\ui-pdf-generator\src\components\forms\SendEmailsForm.jsx
```

Update `attachmentHint.event_weekly_payslip` agar menjelaskan:

- lampiran diambil dari batch terpilih;
- seluruh PDF yang cocok untuk nama/penerima akan dikirim dalam satu email;
- baris dengan nama dan email sama digabung, bukan dikirim berulang kali.

Tidak perlu mengubah request `sendEventWeeklyPayslipEmails()` karena request existing sudah mengirim `file` dan `batch_id`.

### 2. Pastikan response multi-attachment tetap dapat ditampilkan

File untuk diperiksa:

```text
D:\eis\ui-pdf-generator\src\components\forms\SendEmailsForm.jsx
D:\eis\ui-pdf-generator\src\components\ui\ResultSummaryCard.jsx
```

Jika detail result ditampilkan, dukung field `attachments` sebagai daftar dan tampilkan `attachment_count`. Bila UI saat ini hanya menampilkan ringkasan, tidak perlu menambah komponen besar; pastikan response baru tidak merusak normalisasi summary/error existing.

### 3. Template Excel pengiriman

File untuk diverifikasi:

```text
D:\eis\ui-pdf-generator\public\templates\send-event-weekly-payslip-emails.xlsx
```

Tidak ada kolom baru yang dibutuhkan. Format tetap:

```text
sentTo | NIK/employeeId | employeeName | body | cc | bcc
```

Satu baris per nama/penerima sudah cukup karena backend akan mengambil seluruh PDF yang cocok dalam batch. Spreadsheet dengan baris duplikat tetap harus ditangani dan digabung secara aman.

## Dokumentasi yang Perlu Diperbarui

Backend:

```text
API_DOCUMENTATION.md
README.md
```

Dokumentasikan bahwa khusus `/send-event-weekly-payslip-emails`:

- baris dengan `sentTo/email + employeeName` sama digabung;
- satu kelompok menghasilkan satu email;
- seluruh PDF batch yang cocok melalui match key Event Weekly menjadi lampiran;
- `queued/failed/skipped` dihitung per kelompok email;
- response dapat mengandung `source_rows`, `attachments`, dan `attachment_count`;
- perilaku “pilih file paling baru” tetap berlaku untuk flow lain yang memang menggunakannya, tetapi tidak untuk Event Weekly multi-attachment.

Issue lama `issue-event_weekly_payslip.md` menyatakan satu row hanya mengirim satu attachment. Requirement baru ini menggantikan batasan tersebut khusus untuk Bulk Send Email Event Weekly. Issue lama tidak perlu ditulis ulang, tetapi dokumentasi aktif harus mengikuti behavior baru.

## File yang Diperkirakan Dimodifikasi

### Backend wajib

| Aksi | File | Perubahan |
|---|---|---|
| Modify | `app/Controllers/Http/BulkEmailController.js` | Group row penerima, kumpulkan seluruh attachment, dispatch satu job, dan update diagnostic/response khusus Event Weekly. |
| Modify | `test/functional/api_endpoint_matrix.spec.js` | Tambahkan skenario beberapa batch item dan baris email duplikat. |
| Modify | `API_DOCUMENTATION.md` | Dokumentasikan grouping dan multi-attachment. |
| Modify bila kontrak juga dicatat di sana | `README.md` | Sinkronkan behavior Bulk Send Event Weekly. |

### Frontend

| Aksi | File | Perubahan |
|---|---|---|
| Modify | `src/components/forms/SendEmailsForm.jsx` | Update hint dan, bila dibutuhkan, normalisasi/tampilan result multi-attachment. |
| Modify | `src/components/forms/SendEmailsForm.test.jsx` | Verifikasi hint/response tetap kompatibel. |
| Modify hanya jika diperlukan | `src/components/ui/ResultSummaryCard.jsx` | Tampilkan daftar/jumlah attachment tanpa merusak result template lain. |

### Hanya diverifikasi; tidak perlu dimodifikasi jika sudah mendukung array attachment

| Repository | File |
|---|---|
| Backend | `app/Jobs/SendEmailJob.js` |
| Backend | `app/Services/EmailLogService.js` |
| Frontend | `src/api/bulkApi.js` |
| Frontend | `src/api/bulkApi.test.js` |
| Frontend | `public/templates/send-event-weekly-payslip-emails.xlsx` |

## Tidak Memerlukan File Baru

Implementasi dapat diselesaikan pada helper/controller existing. Service baru tidak wajib.

Jika logic grouping dan resolusi attachment membuat controller terlalu sulit dibaca, implementer boleh membuat service terpisah, misalnya:

```text
app/Services/BatchEmailGroupingService.js
```

Service baru hanya disarankan jika benar-benar mengurangi kompleksitas dan memiliki batas tanggung jawab yang jelas. Jangan memindahkan seluruh flow email atau merefactor semua template dalam issue ini.

## Acceptance Criteria

1. Dua baris spreadsheet Event Weekly dengan email dan nama yang sama menghasilkan tepat satu job email.
2. Jika batch mempunyai dua PDF yang cocok untuk kelompok tersebut, job email membawa dua attachment yang berbeda.
3. Satu baris spreadsheet juga dapat menghasilkan satu email dengan beberapa attachment jika batch memiliki beberapa PDF yang cocok.
4. Attachment hanya berasal dari `batch_id`, company, dan template `event_weekly_payslip` yang dipilih.
5. Attachment dideduplikasi dan diurutkan secara deterministic.
6. `email_logs` hanya memiliki satu entry queued untuk kelompok penerima tersebut dan menyimpan seluruh attachment.
7. Response menunjukkan source row yang digabung serta daftar/jumlah attachment.
8. Email sama tetapi nama berbeda tidak digabung.
9. Nama sama tetapi email berbeda tidak digabung.
10. Variasi kapitalisasi dan separator nama tetap dianggap sebagai nama yang sama sesuai normalisasi existing.
11. Jika attachment target tidak lengkap atau file hilang, email kelompok tidak dikirim secara parsial dan error dapat ditelusuri.
12. BA, Cooperation Agreement, `payslip`, `exel-payslip`, serta template lain mempertahankan perilaku existing.
13. Tidak ada migration database atau endpoint baru.

## Skenario Test

Detail implementasi test diserahkan kepada implementer. Minimal cakup skenario berikut.

### Backend

- Satu batch berisi dua item sukses dengan match key sama, spreadsheet berisi dua baris nama/email sama: satu job dengan dua attachment.
- Satu batch berisi dua item sukses, spreadsheet hanya satu baris: satu job dengan dua attachment.
- Baris duplikat tidak membuat attachment yang sama muncul dua kali.
- Nama/email sama dengan beberapa match key/NIK menggabungkan seluruh attachment valid ke satu email.
- Email sama tetapi nama berbeda tetap menghasilkan email terpisah.
- Nama sama tetapi email berbeda tetap menghasilkan email terpisah.
- Salah satu file attachment hilang menghasilkan status yang jelas dan tidak mengirim email parsial.
- Batch dari company/template lain tidak dapat dipakai.
- Satu item dan satu baris tetap menghasilkan satu email dengan satu attachment seperti sebelumnya.
- Salah satu template non-Event Weekly yang memiliki beberapa kandidat tetap mengikuti perilaku existing dan tidak otomatis mengirim seluruh kandidat.

### Frontend

- Pilih Event Weekly Payslip dan pastikan hint menjelaskan penggabungan penerima serta multi-attachment.
- Submit tetap mengirim `file` dan `batch_id` ke endpoint existing.
- Response dengan `attachments` array dan `attachment_count` tidak merusak ringkasan hasil.
- Mode template lain tidak mengalami perubahan tampilan atau request.

## Out of Scope

- Mengubah proses Bulk Generate atau isi/layout PDF `event_weekly_payslip`.
- Mengubah algoritma perhitungan slip.
- Mengubah format match key yang tersimpan pada batch existing.
- Menggabungkan email untuk BA, Cooperation Agreement, atau template slip lain.
- Mengubah Send Single Email.
- Mengambil attachment dari batch lain atau melakukan scan folder historis.
- Menambahkan migration/database table baru.
- Menangani batas total ukuran attachment dari provider SMTP; bila diperlukan, buat issue terpisah.

## Urutan Implementasi yang Disarankan

1. Tambahkan test fungsional reproduksi dengan dua batch item dan dua row email duplikat.
2. Tambahkan grouping row khusus Event Weekly.
3. Tambahkan resolver seluruh attachment dengan deduplikasi dan urutan deterministic.
4. Ubah dispatch, email log, diagnostic, dan response menjadi per kelompok.
5. Pastikan branch default template lain tidak berubah.
6. Update hint/test frontend.
7. Update dokumentasi aktif.
8. Jalankan regression test backend dan frontend.

## Definition of Done

- Seluruh acceptance criteria terpenuhi.
- Kasus reproduksi mengirim satu email dengan dua attachment yang benar.
- Tidak ada email duplikat untuk nama dan alamat penerima yang sama.
- Tidak ada attachment yang hilang atau terduplikasi.
- Email log dan response dapat dipakai untuk audit source row serta attachment.
- Test backend/frontend relevan lulus.
- Perilaku template selain `event_weekly_payslip` tidak berubah.
