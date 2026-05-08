# Issue Plan: Implementasi End-to-End `ba-resign`

## Ringkasan
Lanjutkan implementasi template `ba-resign` agar setara dengan template `ba-*` lain untuk flow berikut:
- Single generate + kirim email
- Bulk generate dari Excel
- Bulk kirim email berdasarkan hasil batch
- Update dokumentasi

Dokumen ini disiapkan sebagai panduan kerja untuk junior programmer atau model AI yang lebih murah.

## Tujuan
- `ba-resign` bisa dipakai penuh di flow API seperti `ba-hold`, `ba-rolling`, `ba-terminated`, dan `ba-cancel-join`.
- Semua endpoint baru konsisten dengan pola validasi, auto `letterNo`, dan penamaan file BA yang sudah ada.
- Dokumentasi publik sinkron dengan implementasi backend terbaru.

## Scope Pekerjaan
1. Tambah flow single send untuk `ba-resign`.
2. Tambah flow bulk generate untuk `ba-resign`.
3. Tambah flow bulk send email untuk `ba-resign`.
4. Tambah route endpoint yang dibutuhkan.
5. Sinkronkan validasi field, subject/body email, dan template matching.
6. Update dokumentasi `README.md` dan `API_DOCUMENTATION.md`.

## Rencana Implementasi
1. Single Generate + Email (`POST /api/v1/send/ba-resign`)
- Tambahkan method baru di `SingleEmailController` mengikuti pola `sendBaCancelJoin`.
- Tambahkan mapping field wajib `ba-resign` di `requiredFields(template)`.
- Tambahkan mapping judul/subject/body email untuk `ba-resign` agar konsisten dengan template BA lain.
- Pastikan `letterNo` tetap auto-generate lewat mekanisme BA existing (override jika user kirim manual).

2. Bulk Generate (`POST /api/v1/bulk/ba-resign`)
- Tambahkan method route handler baru di `BulkPdfController`.
- Tambahkan mode `ba-resign` di `buildPayloadForMode`.
- Buat payload builder `ba-resign` dari row Excel mengikuti pola builder BA lain.
- Pastikan validasi row dan pembentukan `match_key` mengikuti `BaTemplateService`.
- Pastikan auto `letterNo` berjalan untuk tiap row sesuai flow BA existing.

3. Bulk Email (`POST /api/v1/send-ba-resign-emails`)
- Tambahkan method baru di `BulkEmailController` mengikuti pola `_sendBaTemplate`.
- Konfigurasi template, required match fields, subject default, dan body default untuk `ba-resign`.
- Pastikan mekanisme pencarian attachment dari `batch_id + match_key` konsisten dengan BA lain.

4. Routing dan Integrasi Endpoint
- Tambah route di `start/routes.js`:
  - `POST /api/v1/send/ba-resign`
  - `POST /api/v1/bulk/ba-resign`
  - `POST /api/v1/send-ba-resign-emails`
- Pastikan semua route dilindungi middleware `auth:jwt` seperti endpoint BA sejenis.

5. Sinkronisasi Teknis Pendukung
- Verifikasi `TemplateResolver`, `BaTemplateService`, dan `GeneratePdfJob` untuk `ba-resign` tetap konsisten dengan final field yang dipakai di controller.
- Jika ada perubahan final field dari tim bisnis, update mapping required field sekali di semua layer agar tidak mismatch.

6. Update Dokumentasi
- Update `README.md`:
  - daftar template BA
  - contoh payload single `ba-resign`
  - field wajib
  - endpoint single/bulk/bulk email
  - catatan auto `letterNo`
- Update `API_DOCUMENTATION.md` dengan informasi yang setara.

## Perkiraan File Yang Disentuh
- `app/Controllers/Http/SingleEmailController.js`
- `app/Controllers/Http/BulkPdfController.js`
- `app/Controllers/Http/BulkEmailController.js`
- `start/routes.js`
- `README.md`
- `API_DOCUMENTATION.md`
- Opsional (jika perlu sinkronisasi field akhir):
  - `app/Services/TemplateResolver.js`
  - `app/Services/BaTemplateService.js`
  - `app/Jobs/GeneratePdfJob.js`

## Skenario Test (High-Level)
- Endpoint single `ba-resign` valid menghasilkan job queued/sukses sesuai pola existing.
- Endpoint single `ba-resign` invalid (field wajib kurang) mengembalikan `422`.
- Endpoint bulk `ba-resign` menerima file valid dan membuat batch items.
- Endpoint bulk `ba-resign` menandai row invalid dengan error yang jelas.
- Endpoint bulk send `ba-resign` mengirim email untuk data yang attachment-nya ditemukan.
- Endpoint bulk send `ba-resign` menandai skipped/failed saat attachment tidak ditemukan.
- Auto `letterNo` berjalan di single dan bulk (nilai manual dari request/excel tidak dipakai sebagai final).
- Penamaan file output PDF `ba-resign` mengikuti pola BA existing.
- Endpoint baru hanya bisa diakses user terautentikasi (JWT).
- Dokumentasi menampilkan endpoint dan payload `ba-resign` yang sesuai implementasi.

## Acceptance Criteria
- Tiga endpoint `ba-resign` (single, bulk, bulk email) aktif dan berjalan sesuai pola BA lain.
- Validasi field wajib dan auto `letterNo` konsisten antar flow.
- Dokumentasi `README.md` dan `API_DOCUMENTATION.md` sudah mencakup `ba-resign`.
- Skenario test high-level di atas bisa dieksekusi tanpa blocker arsitektur.
