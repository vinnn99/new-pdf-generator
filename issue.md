# Issue Plan: Bulk Send Email `cooperation_agreement`

## Ringkasan
Tambahkan fitur bulk send email untuk template `cooperation_agreement` pada halaman frontend `/send-emails`.

Flow pengiriman harus mengikuti pola bulk BA existing:

1. User generate PDF lebih dulu lewat bulk generate `cooperation_agreement`.
2. Backend membuat `generation_batches` dan `generation_batch_items`.
3. User masuk ke `/send-emails`, memilih jenis pengiriman `Cooperation Agreement`.
4. User memilih `batch_id` hasil generate bulk.
5. User upload Excel penerima email.
6. Backend mencari lampiran PDF dari batch berdasarkan `batch_id`, `template`, dan `match_key`.
7. Email dikirim dengan attachment PDF yang sesuai.

Dokumen ini dibuat sebagai panduan implementasi untuk junior programmer atau AI model yang lebih murah.

## Informasi Repo
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`

## Scope Utama
- Tambahkan mode bulk email `cooperation_agreement`.
- Jangan membuat pola lookup attachment baru yang berbeda dari BA.
- Reuse tabel batch:
  - `generation_batches`
  - `generation_batch_items`
- Reuse attachment yang sudah dibuat oleh endpoint bulk generate:
  - `POST /api/v1/bulk/cooperation_agreement`
- Tambahkan endpoint bulk email baru untuk Cooperation Agreement.
- Tambahkan opsi dan UI pendukung di frontend `/send-emails`.

## Keputusan Implementasi
- Nama template tetap `cooperation_agreement`.
- Label frontend: `Cooperation Agreement`.
- Endpoint backend disarankan:
  - `POST /api/v1/send-cooperation-agreement-emails`
- Field upload tetap multipart form-data:
  - `file`: Excel penerima email
  - `batch_id`: batch hasil bulk generate `cooperation_agreement`
- Lampiran tidak dicari dari folder secara manual. Lampiran harus diambil dari metadata `generation_batch_items.saved_path`, sama seperti bulk BA.
- Context email log boleh dibuat khusus, misalnya `bulk-cooperation-agreement`, agar mudah dibedakan dari `bulk-ba`.
- Jika `allowed_templates` company aktif, mode ini hanya muncul dan bisa dipakai saat company mengizinkan `cooperation_agreement`.

## Match Key Attachment
Bulk generate `cooperation_agreement` sudah membuat match key melalui data mitra.

Gunakan aturan yang sama saat bulk send email:

- Wajib ada `partnerName`.
- Wajib ada salah satu:
  - `partnerEmail`
  - `partnerIdentityNumber`

Match key harus sama dengan `CooperationAgreementService.buildMatchKey(...)`.

Contoh kolom Excel send email:

| Kolom | Wajib | Catatan |
| --- | --- | --- |
| `sentTo` | Ya | Email tujuan pengiriman |
| `partnerName` | Ya | Harus sama dengan data saat bulk generate |
| `partnerEmail` | Salah satu | Dipakai untuk lookup attachment |
| `partnerIdentityNumber` | Salah satu | Alternatif lookup jika tidak memakai email mitra |
| `subject` | Tidak | Override subject default |
| `body` | Tidak | Override body default |
| `cc` | Tidak | Pisahkan multi email dengan `;` |
| `bcc` | Tidak | Pisahkan multi email dengan `;` |

Catatan:
- Jika Excel bulk generate memakai alias Indonesia seperti `mitra nama`, `mitra email`, atau `mitra id`, bulk send email boleh mendukung alias yang sama.
- Implementer harus memastikan normalisasi match key di bulk send email sama dengan bulk generate.

## Scope Backend
1. Tambah route
- Tambahkan route di `start/routes.js`:
  - `POST /api/v1/send-cooperation-agreement-emails`
- Gunakan middleware auth yang sama dengan bulk email BA existing.

2. Tambah handler di `BulkEmailController`
- Tambahkan method seperti:
  - `sendCooperationAgreement(...)`
- Handler ini harus memakai pola batch seperti `_sendBaTemplate`.
- Jika memungkinkan, refactor nama helper generic supaya tidak terlalu BA-specific, misalnya:
  - `_sendLetteredBatchTemplate(...)`
- Jangan merusak endpoint BA yang sudah ada.

3. Validasi request
- `batch_id` wajib.
- `file` wajib dan hanya menerima `.xls` / `.xlsx`.
- Batch harus milik company user login.
- Batch harus memiliki `template = 'cooperation_agreement'`.
- Jika batch tidak ditemukan, return error yang jelas.

4. Lookup attachment
- Ambil item dari `generation_batch_items`.
- Filter:
  - `batch_id`
  - `company_id`
  - `template = 'cooperation_agreement'`
  - `saved_path` tidak null
- Group berdasarkan `match_key`.
- Untuk setiap row Excel, build match key dari `partnerName` + `partnerEmail` atau `partnerIdentityNumber`.
- Ambil attachment terbaru jika ada lebih dari satu kandidat, mengikuti pola `pickLatestBatchAttachment`.

5. Dispatch email
- Buat email log sebelum dispatch job, sama seperti bulk BA.
- Dispatch `SendEmailJob` dengan:
  - SMTP company
  - `to`, `cc`, `bcc`
  - `subject`
  - `body`
  - attachment dari batch item
  - `requireAttachments: true`
  - `template: 'cooperation_agreement'`
  - context khusus bulk cooperation agreement
- Response harus mengembalikan ringkasan:
  - `total`
  - `queued`
  - `failed`
  - `skipped`
  - `batch_id`
  - `results`

6. Subject/body default
- Jika Excel tidak mengisi `subject`, gunakan default yang jelas, contoh:
  - `Cooperation Agreement - {partnerName}`
- Jika Excel tidak mengisi `body`, gunakan default yang menyebut lampiran dokumen Cooperation Agreement.
- Jika batch item punya `letter_no`, boleh masukkan nomor surat ke body default.

7. Logging
- Gunakan pola log bulk email existing.
- Log minimal:
  - row
  - to
  - status
  - template
  - batchId
  - matchKey
  - attachment
  - letterNo jika ada

## Scope Frontend
1. Tambah opsi mode di `/send-emails`
- Update `src/components/forms/SendEmailsForm.jsx`.
- Tambahkan mode:
  - value: `cooperation_agreement`
  - label: `Cooperation Agreement`
  - endpoint: `/api/v1/send-cooperation-agreement-emails`

2. Update API helper
- Update `src/api/bulkApi.js`.
- Tambahkan mapping endpoint `cooperation_agreement`.
- Nama helper boleh tetap `sendBaEmails` jika hanya diperluas, tetapi lebih baik rename/alias menjadi generic seperti `sendBatchAttachmentEmails`.
- Pastikan perubahan tidak memutus pengiriman BA existing.

3. Batch history
- Reuse batch list/detail yang sudah dipakai BA.
- Query batch history harus bisa menerima `template = cooperation_agreement`.
- UI "Pakai Batch" tetap bekerja untuk batch Cooperation Agreement.
- Label error jangan menyebut BA secara spesifik untuk mode ini. Gunakan istilah umum seperti "Batch ID wajib diisi untuk pengiriman dokumen".

4. Template Excel
- Tambahkan file contoh:
  - `public/templates/send-cooperation-agreement-emails.xlsx`
- Tambahkan mapping download di `SendEmailsForm.jsx`.
- Kolom minimal:
  - `sentTo`
  - `partnerName`
  - `partnerEmail`
  - `partnerIdentityNumber`
  - `subject`
  - `body`
  - `cc`
  - `bcc`
- `partnerEmail` dan `partnerIdentityNumber` tidak harus dua-duanya wajib, tetapi minimal salah satu harus terisi.

5. Column hints
- Tambahkan hint kolom untuk mode `cooperation_agreement`.
- Jelaskan bahwa `partnerName` dan `partnerEmail`/`partnerIdentityNumber` harus sama dengan data yang dipakai saat bulk generate.
- Jelaskan bahwa `batch_id` berasal dari hasil bulk generate Cooperation Agreement.

6. Allowed templates
- Pastikan mode `cooperation_agreement` mengikuti filter `allowed_templates`.
- Jika company tidak mengizinkan template ini, mode tidak muncul.

## File Yang Kemungkinan Disentuh
Backend:
- `start/routes.js`
- `app/Controllers/Http/BulkEmailController.js`
- `app/Services/CooperationAgreementService.js` jika perlu expose helper match field/alias
- `test/functional/api_endpoint_matrix.spec.js`

Frontend:
- `src/components/forms/SendEmailsForm.jsx`
- `src/api/bulkApi.js`
- `src/components/forms/SendEmailsForm.test.jsx`
- `public/templates/send-cooperation-agreement-emails.xlsx`
- `dist/` jika repo masih menyimpan hasil build

## Skenario Test
- Mode `Cooperation Agreement` muncul di `/send-emails` saat `allowed_templates` mengizinkan `cooperation_agreement`.
- Mode tidak muncul saat company tidak mengizinkan template tersebut.
- Frontend mengirim request ke endpoint bulk email Cooperation Agreement dengan `file` dan `batch_id`.
- Backend menolak request tanpa `batch_id`.
- Backend menolak request tanpa file Excel.
- Backend menolak batch yang bukan milik company user.
- Backend menolak batch dengan template selain `cooperation_agreement`.
- Backend menemukan attachment PDF dari `generation_batch_items` berdasarkan match key.
- Row Excel dengan match key tidak ditemukan menghasilkan status skipped atau failed yang jelas.
- Row Excel valid menghasilkan email log queued dan dispatch `SendEmailJob` dengan attachment.
- Subject/body default terpakai saat Excel tidak mengisi subject/body.
- Subject/body dari Excel mengoverride default.
- Pengiriman BA existing tetap berjalan setelah helper dibuat generic/refactor.

## Acceptance Criteria
- `/send-emails` memiliki pilihan `Cooperation Agreement`.
- User bisa memilih batch hasil bulk generate `cooperation_agreement`.
- User bisa upload Excel penerima email Cooperation Agreement.
- Backend mengirim email dengan attachment PDF dari batch yang sesuai.
- Lookup attachment memakai pola batch seperti bulk BA, bukan pencarian manual baru.
- Response bulk email menampilkan jumlah queued, failed, skipped, dan detail per row.
- File contoh Excel pengiriman tersedia dari frontend.
- Perubahan tidak merusak bulk send email BA existing.
