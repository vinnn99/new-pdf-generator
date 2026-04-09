# Issue Plan: Contact + Auto-Contact dari Pengiriman Email

## Latar Belakang
Saat ini sistem sudah punya fitur pengiriman email (bulk dan single), tetapi belum punya manajemen `contact` terstruktur per user/company. Kebutuhan berikut harus ditambahkan:
- Menyediakan tabel dan endpoint CRUD contact.
- Menambahkan kontrol akses berbasis role (`user`, `admin`, `superadmin`).
- Memastikan setiap email yang dikirim otomatis terdaftar ke contact.

## Tujuan
- Tersedia data `contact` yang terhubung ke user.
- Scope akses sesuai role:
  - `user`: kontak miliknya sendiri.
  - `admin`: semua kontak user di company yang sama.
  - `superadmin`: semua kontak lintas company.
- Semua pengiriman email (bulk/single) otomatis melakukan upsert contact.

## Ruang Lingkup
- Migration + model `contacts`.
- Controller + route CRUD contact.
- Service/helper untuk upsert contact dari proses pengiriman email.
- Integrasi ke flow email existing (bulk dan single).
- Dokumentasi endpoint.
- Test API (integration/functional), bukan instruksi detail unit test.

## Out of Scope
- UI frontend contact management.
- Import/export contact massal.
- Segmentasi/tagging contact lanjutan.

## Desain Data
Tabel baru: `contacts`
- `id` (PK)
- `user_id` (FK -> users.id, not null)
- `company_id` (FK -> companies.company_id, nullable untuk kasus khusus superadmin tanpa company)
- `email` (string 254, not null, lowercase)
- `name` (string 191, nullable)
- `phone` (string 50, nullable)
- `notes` (text, nullable)
- `source` (enum/string: `manual`, `auto-bulk`, `auto-single`, default `manual`)
- `last_sent_at` (datetime, nullable)
- `send_count` (int, default 0)
- `created_at`, `updated_at`

Constraint dan index:
- Unique: `(user_id, email)` untuk mencegah duplikasi kontak per user.
- Index: `company_id`, `user_id`, `email`, `last_sent_at`.

## Aturan Akses
Default rule (disarankan untuk implementasi):
- `user`
  - CRUD hanya pada contact milik sendiri (`contacts.user_id = auth.id`).
- `admin`
  - Read semua contact user dalam company yang sama (`contacts.company_id = auth.company_id`).
  - Create/Update/Delete contact untuk user di company yang sama.
- `superadmin`
  - Read/Create/Update/Delete semua contact lintas company.

Catatan:
- Jika admin tidak punya `company_id`, akses contact ditolak (`403`).
- Semua validasi email wajib normalisasi lowercase + trim.

## Rencana Endpoint Contact
Semua endpoint di bawah memakai JWT (`auth:jwt`).

1. `POST /api/v1/contacts`
- Buat contact baru.
- Body minimum: `email`.
- Body opsional: `name`, `phone`, `notes`, `user_id` (hanya admin/super sesuai scope).

2. `GET /api/v1/contacts`
- List contact dengan pagination dan pencarian cepat.
- Query:
  - `page`, `perPage`
  - `q` (search cepat: email/name/phone)
  - `user_id` (admin/super, sesuai scope)
  - `company_id` (superadmin only)

3. `GET /api/v1/contacts/:id`
- Detail single contact.
- Wajib lolos scope role.

4. `PUT /api/v1/contacts/:id`
- Update contact (`name`, `phone`, `notes`, `email`).
- `email` update harus cek unique `(user_id, email)` setelah normalisasi.

5. `DELETE /api/v1/contacts/:id`
- Hapus contact.
- Hard delete cukup untuk versi awal (simple implementation).

## Update Alur Pengiriman Email
Kebutuhan:
- Setiap pengiriman email (bulk/single) harus terdaftar dalam contact.
- Jika email belum ada di contact milik user pengirim, otomatis buat contact baru.

Rencana implementasi teknis:
- Buat helper/service, misalnya: `ContactService.upsertFromSend(...)`.
- Dipanggil dari titik terpusat yang pasti dilalui semua pengiriman:
  - Disarankan di `SendEmailJob` (karena dipakai bulk dan single).
- Upsert logic:
  - key: `(user_id, lower(email))`
  - jika ada: update `last_sent_at`, increment `send_count`, update `source`.
  - jika tidak ada: insert baru dengan `source` otomatis (`auto-bulk` / `auto-single`), `last_sent_at`, `send_count=1`.

Endpoint pengiriman yang wajib tercakup:
- Bulk:
  - `POST /api/v1/send-slip-emails`
  - `POST /api/v1/send-ba-penempatan-emails`
  - `POST /api/v1/send-ba-request-id-emails`
  - `POST /api/v1/send-ba-hold-emails`
  - `POST /api/v1/send-ba-rolling-emails`
  - `POST /api/v1/send-ba-hold-activate-emails`
  - `POST /api/v1/send-ba-terminated-emails`
- Single:
  - `POST /api/v1/send/ba-penempatan`
  - `POST /api/v1/send/ba-request-id`
  - `POST /api/v1/send/ba-hold`
  - `POST /api/v1/send/ba-rolling`
  - `POST /api/v1/send/ba-hold-activate`
  - `POST /api/v1/send/ba-terminated`

## Checklist Implementasi
1. Buat migration `contacts`.
2. Buat model `Contact`.
3. Buat `ContactController` + route CRUD.
4. Implement scope query per role (user/admin/superadmin).
5. Buat `ContactService.upsertFromSend`.
6. Integrasikan ke alur pengiriman email (titik terpusat).
7. Update dokumentasi API.
8. Tambah test API contact + test integrasi auto-contact.

## Skenario Test per API (High-Level)
Catatan: ini skenario test, bukan detail instruksi unit test.

### A. `POST /api/v1/contacts`
- JWT kosong -> `401`.
- `email` kosong/invalid -> `422`.
- User membuat contact untuk dirinya -> sukses `201`.
- User mencoba set `user_id` user lain -> `403`.
- Admin membuat contact untuk user satu company -> `201`.
- Admin membuat contact untuk user beda company -> `403`.
- Superadmin membuat contact untuk user company mana pun -> `201`.
- Duplikasi email untuk `user_id` yang sama -> `409`/`422` (sesuai keputusan implementasi).
- Email uppercase/spasi -> tersimpan normal (lowercase/trim).

### B. `GET /api/v1/contacts`
- JWT kosong -> `401`.
- User hanya melihat contact miliknya.
- Admin melihat semua contact dalam company sendiri.
- Superadmin melihat semua contact.
- Pagination (`page`, `perPage`) berjalan benar.
- Search `q` memfilter email/nama/phone.
- `user_id` filter:
  - user -> ditolak/diabaikan sesuai policy.
  - admin -> hanya user dalam company sendiri.
  - superadmin -> bebas.
- `company_id` filter:
  - superadmin -> bisa pakai.
  - non-superadmin -> ditolak `403`.

### C. `GET /api/v1/contacts/:id`
- Contact ada dan in-scope -> `200`.
- Contact tidak ada -> `404`.
- Contact ada tapi out-of-scope role -> `403` atau `404` (konsisten sesuai policy keamanan yang dipilih).

### D. `PUT /api/v1/contacts/:id`
- JWT kosong -> `401`.
- Out-of-scope update -> `403`/`404`.
- Update field valid (`name/phone/notes`) -> `200`.
- Update `email` invalid format -> `422`.
- Update `email` menjadi duplikat dalam owner yang sama -> `409`/`422`.
- Normalisasi email saat update (lowercase/trim).

### E. `DELETE /api/v1/contacts/:id`
- JWT kosong -> `401`.
- Delete in-scope -> `200`.
- Delete out-of-scope -> `403`/`404`.
- Delete data tidak ada -> `404`.
- Setelah delete, data tidak muncul di list/detail.

### F. Skenario Integrasi Auto-Contact (Endpoint Email Existing)
Untuk masing-masing endpoint pengiriman email (bulk + single):
- Jika email tujuan sudah ada di contact owner -> tidak membuat baris duplikat, `send_count` naik, `last_sent_at` ter-update.
- Jika email tujuan belum ada -> otomatis membuat contact baru.
- Pengiriman ke beberapa recipient (bulk) -> semua recipient valid ter-upsert.
- Email dengan huruf besar/spasi -> tetap satu contact (normalisasi).
- Attempt pengiriman gagal (mis. SMTP error) -> tetap tercatat/upsert contact (sesuai keputusan bisnis final, direkomendasikan tetap tercatat).
- Baris invalid pada bulk (email kosong/invalid) -> tidak membuat contact untuk baris tersebut.

### G. Regression Scenario
- Fitur login/register/admin user/company tidak rusak.
- Endpoint monitoring email (`/api/v1/email-logs`, `/api/v1/dashboard/summary`) tetap berjalan.
- Pencatatan `email_logs` tetap masuk seperti sebelumnya.

## Acceptance Criteria
- CRUD contact aktif dan mengikuti scope role yang disepakati.
- Semua alur pengiriman email otomatis upsert contact.
- Tidak ada duplikasi contact untuk `(user_id, email)`.
- Dokumen API terupdate.
- Test scenario utama di atas lulus.
