# Issue Plan: Histori Signature URL untuk Single Generate BA

## Ringkasan Masalah
Saat ini pada alur single BA (generate PDF single dan single send email), payload bisa membawa `signatureLeftUrl` dan `signatureRightUrl`. Namun belum ada histori URL tanda tangan yang bisa dipakai ulang oleh FrontEnd, sehingga user harus upload/input ulang URL.

## Tujuan
- Menyimpan histori `signatureLeftUrl` dan `signatureRightUrl` yang pernah dipakai di alur single.
- FrontEnd bisa mengambil ulang daftar URL tanpa upload/input baru.
- Histori terikat ke company sehingga user/admin hanya melihat data company-nya.
- URL di tabel harus unik (tidak duplikat).

## Scope Implementasi
1. Simpan histori Signature URL saat:
- `POST /api/v1/generate-pdf` (single BA)
- endpoint single send email BA (`/api/v1/send/ba-*`)

2. Buat tabel baru khusus histori Signature URL.
3. Tambah endpoint untuk menampilkan daftar Signature URL per company.
4. Terapkan validasi URL dan normalisasi agar constraint unik konsisten.

## Keputusan Desain Data
Gunakan tabel baru: `company_signature_urls`.

Field yang direkomendasikan:
- `id`
- `company_id` (FK ke `companies.company_id`)
- `url` (raw URL yang dipakai)
- `url_normalized` (hasil trim/normalisasi untuk kebutuhan unique key)
- `last_used_at`
- `use_count`
- `created_by` (FK user, nullable)
- `created_at`, `updated_at`

Constraint/index:
- `UNIQUE (company_id, url_normalized)` untuk memastikan URL unik dalam scope company.
- Index `company_id`, `last_used_at` untuk list cepat.

Catatan:
- Requirement unik dipenuhi dalam konteks company (tidak duplikat dalam 1 company).
- Jika URL yang sama dipakai lagi, lakukan upsert + increment `use_count`.

## Alur Simpan Histori
Saat request single BA diterima:
- Ambil `signatureLeftUrl` dan `signatureRightUrl` dari payload (jika ada).
- Validasi hanya `http/https`.
- Normalisasi URL (trim, lowercase host, buang spasi berlebih).
- Upsert ke `company_signature_urls` berdasarkan `(company_id, url_normalized)`.
- Update `last_used_at` dan `use_count`.

## Rencana API
1. `GET /api/v1/signature-urls`
- Auth: JWT
- Role behavior:
  - `user` / `admin`: otomatis hanya company miliknya
  - `superadmin`: bisa semua company, dengan query `company_id`
- Query opsional:
  - `q` (search URL)
  - `page`, `perPage`
  - `sort=last_used_at|created_at`
- Response per item minimal:
  - `id`, `url`, `use_count`, `last_used_at`, `created_at`

2. (Opsional) `GET /api/v1/signature-urls/recent`
- Shortcut untuk ambil URL terbaru/tersering dipakai per company (untuk dropdown cepat di FrontEnd).

## Perubahan Kode yang Direncanakan
- Tambah migration tabel `company_signature_urls`.
- Tambah service untuk normalisasi + upsert histori URL.
- Integrasi service ke flow single BA:
  - `PdfController.generate` (single generate PDF)
  - `SingleEmailController` (single send email BA)
- Tambah controller endpoint list Signature URL.
- Tambah route di `start/routes.js`.
- Update dokumentasi API (`README.md` dan `API_DOCUMENTATION.md`).

## Skenario Test (Tingkat Tinggi)
- Single generate BA dengan `signatureLeftUrl`/`signatureRightUrl` menyimpan histori.
- Single send email BA dengan signature URL menyimpan histori.
- URL yang sama dipakai ulang tidak membuat row baru (upsert berjalan), `use_count` bertambah.
- URL invalid (non-http/https) tidak masuk histori.
- User/admin hanya bisa melihat daftar URL dalam company sendiri.
- Superadmin bisa melihat lintas company sesuai filter.
- Endpoint list mendukung pagination dan pencarian.

## Out of Scope
- Upload file tanda tangan ke server.
- Sinkronisasi histori URL dari endpoint bulk.
- Fitur edit/delete manual histori URL dari UI.

## Acceptance Criteria
- Histori Signature URL tersimpan otomatis dari single generate PDF BA dan single send email BA.
- Tabel baru tersedia dan URL tidak duplikat dalam company yang sama.
- Endpoint list Signature URL per company tersedia untuk kebutuhan FrontEnd.
- User/admin tidak bisa melihat URL dari company lain.
