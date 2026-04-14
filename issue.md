# Issue Plan: Monitoring Nomor BA dan Lokasi PDF

## Ringkasan Masalah
Saat ini nomor BA (`ba-*`) sudah tergenerate saat pembuatan PDF, tetapi belum ada endpoint monitor yang rapi untuk melihat daftar nomor BA yang sudah dikeluarkan beserta lokasi file PDF-nya berdasarkan hak akses user/admin/superadmin.

## Tujuan
- User/admin/superadmin bisa memonitor nomor BA yang sudah terbit.
- Data monitoring menampilkan info file PDF (`saved_path`, `download_url`, `filename`) agar mudah ditelusuri.
- Menyediakan API khusus monitoring dengan filtering dan pagination.

## Keputusan Desain Data (Paling Efektif)
Gunakan tabel `generated_pdfs` yang sudah ada, lalu tambah kolom yang dibutuhkan.

Alasan:
- Data file PDF sudah ada di `generated_pdfs` (tidak perlu duplikasi ke tabel baru).
- Integrasi lebih cepat karena flow generate PDF sudah menulis ke tabel ini.
- Query monitoring jadi sederhana dan hemat perubahan.

Catatan:
- Opsi tabel baru boleh dipertimbangkan nanti jika ada kebutuhan audit nomor BA tanpa PDF.
- Untuk scope saat ini, menambah field di `generated_pdfs` adalah opsi paling efektif.

## Perubahan Skema yang Direncanakan
Tambahkan field pada `generated_pdfs`:
- `letter_no` (string, nullable, index)
- `batch_id` (string, nullable, index) untuk hasil bulk

Field existing yang dipakai:
- `template`, `company_id`, `user_id`, `filename`, `saved_path`, `download_url`, `created_at`

## Perubahan Alur Aplikasi
Saat generate BA (single maupun bulk):
- Simpan `data.letterNo` ke `generated_pdfs.letter_no`.
- Jika proses bulk, simpan `batch_id` ke `generated_pdfs.batch_id`.
- Pastikan hanya template `ba-*` yang mengisi `letter_no`; template non-BA boleh null.

## Rencana API
1. `GET /api/v1/ba-monitoring`
- Auth: JWT
- Akses:
  - `user`: hanya data milik user login
  - `admin`: semua data di company yang sama
  - `superadmin`: semua company
- Query opsional:
  - `page`, `perPage`
  - `template` (contoh `ba-request-id`)
  - `letter_no` (exact/contains)
  - `date_from`, `date_to`
  - `company_id` (khusus superadmin)
  - `batch_id`
- Response minimal per row:
  - `id`, `template`, `letter_no`
  - `company_id`, `user_id`
  - `filename`, `saved_path`, `download_url`
  - `batch_id`, `created_at`

2. `GET /api/v1/ba-monitoring/:id`
- Auth: JWT
- Scope akses sama seperti list endpoint.
- Kembalikan detail record monitoring untuk satu dokumen BA.

## Perubahan Kode yang Direncanakan
- Tambah migration untuk kolom baru di `generated_pdfs`.
- Update proses penyimpanan hasil PDF agar menulis `letter_no` dan `batch_id`.
- Tambah controller baru untuk endpoint monitoring.
- Tambah route baru di `start/routes.js`.
- Update dokumentasi API (`README.md` dan `API_DOCUMENTATION.md`).

## Skenario Test (Tingkat Tinggi)
- Role `user` hanya melihat data BA miliknya.
- Role `admin` melihat semua data BA dalam company-nya.
- Role `superadmin` melihat lintas company.
- Filtering `template`, `letter_no`, `date range`, dan `batch_id` bekerja sesuai query.
- Pagination list berjalan benar.
- Endpoint detail menolak akses ke data di luar scope role.
- Record BA baru menyimpan `letter_no` dan file path dengan benar.
- Record non-BA tidak merusak flow existing (regression check).

## Out of Scope
- Dashboard agregasi analytics lanjutan (chart/ringkasan KPI).
- Export CSV/Excel.
- Audit log perubahan nomor BA manual.

## Acceptance Criteria
- API list/detail monitoring BA tersedia dan bisa dipakai semua role sesuai scope.
- Data nomor BA dan lokasi file PDF bisa ditelusuri tanpa parsing manual dari payload JSON.
- Flow generate PDF existing tetap berjalan normal untuk template BA dan non-BA.
