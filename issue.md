# Issue Plan: CRUD `company_signature_urls`

## Ringkasan
Saat ini endpoint `signature-urls` baru menyediakan list (`GET /api/v1/signature-urls`).  
Kebutuhan berikutnya adalah CRUD lengkap untuk tabel `company_signature_urls` dengan aturan role yang sama seperti sekarang.

## Tujuan
- Menyediakan endpoint create, read detail, update, dan delete untuk `company_signature_urls`.
- Menjaga aturan akses role tetap berlaku.
- Menjaga validasi URL dan normalisasi agar constraint unik tetap aman.

## Scope Implementasi
1. Tambah endpoint baru:
- `GET /api/v1/signature-urls/:id`
- `POST /api/v1/signature-urls`
- `PUT /api/v1/signature-urls/:id`
- `DELETE /api/v1/signature-urls/:id`

2. Endpoint list existing tetap dipakai:
- `GET /api/v1/signature-urls`

3. Extend `SignatureUrlController`:
- Tambah method `show`, `store`, `update`, `destroy`.
- Gunakan helper scope role yang konsisten untuk semua method.

4. Update routing di `start/routes.js`.

5. Update dokumentasi API (`README.md` dan `API_DOCUMENTATION.md`).

## Aturan Role (Tetap Berlaku)
- Role yang diizinkan: `user`, `admin`, `superadmin`.
- `user` dan `admin`:
- Hanya boleh akses data company milik sendiri.
- Tidak boleh kirim `company_id` sebagai filter/payload.
- Jika tidak punya `company_id` maka akses ditolak (`403`).
- `superadmin`:
- Bisa akses lintas company.
- Boleh kirim `company_id` untuk list/create/update.

Catatan keamanan:
- Untuk `show`, `update`, `delete` by `:id`, jika data di luar scope actor, responkan `404` agar tidak bocor informasi keberadaan data.

## Aturan Data dan Validasi
- Field input utama: `url`, `name`, `title`.
- `url` wajib valid `http/https`.
- Normalisasi URL gunakan utilitas yang sudah ada (`SignatureUrlHistoryService.normalizeHttpUrl`).
- Constraint unik tetap mengacu ke `(company_id, url_normalized)`.
- Jika bentrok data unik, respon `409`.
- Field sistem (`use_count`, `last_used_at`, `created_by`, `created_at`, `updated_at`) tidak boleh diisi bebas dari client.

## Rencana Teknis Singkat
1. Refactor helper scope role pada `SignatureUrlController` agar reusable.
2. Implement `show` dengan query ter-scope role.
3. Implement `store`:
- tentukan `company_id` berdasarkan role.
- validasi + normalisasi URL.
- insert row baru.
4. Implement `update`:
- cari row berdasarkan `id` dalam scope role.
- validasi input yang dikirim.
- jika `url` berubah, hitung ulang `url_normalized` dan cek konflik unik.
5. Implement `destroy`:
- hapus row berdasarkan `id` dalam scope role.
6. Tambahkan response error yang konsisten (`400`, `403`, `404`, `409`).

## Skenario Yang Harus Diuji (High-Level)
- Semua endpoint CRUD wajib JWT.
- `user/admin` hanya bisa CRUD data pada company sendiri.
- `user/admin` ditolak saat kirim `company_id`.
- `superadmin` bisa CRUD lintas company.
- Create dengan URL valid berhasil.
- Create/update dengan URL invalid ditolak (`400`).
- Create/update yang melanggar unique `(company_id, url_normalized)` ditolak (`409`).
- `GET /:id` untuk data di luar scope role menghasilkan `404`.
- Delete berhasil menghapus data dan data tidak bisa diambil lagi.
- List existing tetap berjalan normal (pagination, sorting, search) setelah perubahan CRUD.

## Out of Scope
- Perubahan UI frontend.
- Perubahan skema tabel baru (tanpa migration tambahan, kecuali benar-benar dibutuhkan oleh implementor).
- Perubahan mekanisme auto-history dari flow generate/send yang sudah berjalan.

## Acceptance Criteria
- CRUD endpoint `company_signature_urls` tersedia dan berfungsi.
- Aturan role lama tetap konsisten pada seluruh operasi CRUD.
- Validasi URL dan normalisasi berjalan konsisten dengan sistem existing.
- Error handling dan response status jelas untuk kasus invalid, forbidden, not found, dan duplicate.
