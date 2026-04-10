# Issue Plan: Auto LetterNo BA + Batch History untuk Send Bulk Email

## Ringkasan Masalah
Saat ini alur `bulk generate` lalu `bulk send email` untuk template `ba-*` merepotkan karena file Excel pengiriman masih mengandalkan `letterNo`.

Kebutuhan baru:
1. `letterNo` untuk template `ba-*` harus digenerate otomatis oleh sistem.
2. Nomor berurutan berlaku per `company + template`.
3. Pengiriman email bulk harus bisa dilakukan tanpa input `letterNo` di Excel, menggunakan acuan `batch_id`.
4. User perlu history batch agar tahu `batch_id` mana yang akan dipakai saat kirim email.

## Keputusan Final (Disepakati)
- Berlaku untuk semua template prefix `ba-`.
- `data.letterNo` selalu di-override oleh auto-number.
- Sequence per `company + template` (bukan gabungan semua `ba-*`).
- Reset sequence: `never`.
- Nomor yang sudah terambil tetap terpakai walaupun generate gagal (gap diperbolehkan).
- Format default nomor:
  - `{seq:04}/{templateCode}/{romanMonth}/{year}`
- `romanMonth` dan `year` diambil dari waktu server dengan timezone tetap `Asia/Jakarta`.
- Mapping `templateCode`:
  - `ba-penempatan` -> `BAP`
  - `ba-request-id` -> `BARI`
  - `ba-hold` -> `BAH`
  - `ba-rolling` -> `BAR`
  - `ba-hold-activate` -> `BAHA`
  - `ba-takeout` -> `BAT`
  - `ba-terminated` -> `BATR`

## Tujuan
- Menghilangkan ketergantungan input manual `letterNo` pada proses kirim email bulk.
- Menjamin penomoran surat BA konsisten, berurutan, dan audit-friendly per company.
- Menyediakan referensi `batch_id` yang jelas untuk operasional pengiriman email.

## Scope Implementasi
- Auto-generate `letterNo` pada `POST /api/v1/generate-pdf` untuk template `ba-*`.
- Auto-generate `letterNo` pada seluruh endpoint `POST /api/v1/bulk/ba-*`.
- Penerapan `batch_id` pada hasil bulk generate.
- Penyimpanan metadata per item hasil batch untuk kebutuhan lookup attachment saat send email.
- Perubahan endpoint `send-ba-*-emails` agar memakai `batch_id` (tanpa perlu `letterNo` di file Excel).
- Endpoint history batch agar user bisa melihat dan memilih `batch_id`.
- Update dokumentasi API.

## Out of Scope
- Perubahan desain PDF/template isi dokumen.
- Perubahan flow email non-BA.
- Fitur UI frontend detail (plan ini fokus backend + contract API).

## Desain Data (High-Level)
### A. Konfigurasi penomoran per company
Tabel contoh: `company_ba_numbering_settings`
- `company_id` (unique)
- `format_pattern` (default: `{seq:04}/{templateCode}/{romanMonth}/{year}`)
- `timezone` (default: `Asia/Jakarta`)
- metadata audit (`created_by`, `updated_by`, timestamp)

### B. Counter sequence per company + template
Tabel contoh: `company_ba_numbering_counters`
- `company_id`
- `template`
- `last_seq`
- unique key: `(company_id, template)`

### C. Master batch generate
Tabel contoh: `generation_batches`
- `batch_id` (UUID/string unik)
- `company_id`
- `template`
- `created_by`
- `total_rows`, `queued`, `failed`
- timestamp

### D. Item hasil batch
Tabel contoh: `generation_batch_items`
- `batch_id`
- `company_id`
- `template`
- `row_no`
- `match_key` (kunci pencarian attachment untuk send)
- `letter_no`
- `filename`, `saved_path`
- `status` (`queued/success/failed`)
- `error` (nullable)
- timestamp

Catatan:
- `match_key` harus dibentuk deterministik per template (mis. normalisasi nilai kunci row).
- Untuk `ba-penempatan`, contoh key basis: `mdsName + outlet`.

## Rencana Endpoint dan Flow
### 1) `POST /api/v1/generate-pdf` (single)
- Jika `template` diawali `ba-`, sistem generate `letterNo` otomatis.
- `data.letterNo` dari request tetap diabaikan (override).
- Gunakan sequence per `company + template`.

### 2) `POST /api/v1/bulk/ba-*` (generate bulk)
- Saat proses tiap baris valid:
  - Ambil nomor berikutnya dari sequence `company + template` (atomic transaction).
  - Isi `payload.data.letterNo` otomatis.
- Buat `batch_id` untuk request bulk tsb.
- Simpan metadata item batch.
- Kembalikan `batch_id` di response bulk generate.

### 3) `POST /api/v1/send-ba-*-emails` (send bulk email)
- Tambah parameter request: `batch_id` (wajib).
- File Excel pengiriman tidak perlu kolom `letterNo`.
- Lookup attachment berbasis:
  - `batch_id + template + match_key` (dari isi row Excel yang relevan).
- Jika kandidat attachment lebih dari satu, pilih file terbaru.

### 4) History batch
Tambahkan endpoint agar user bisa memilih batch:
- `GET /api/v1/batches?template=<ba-template>&page=...&perPage=...`
- `GET /api/v1/batches/:batch_id`

Scope akses:
- `user/admin`: hanya batch company sendiri.
- `superadmin`: bisa lintas company sesuai policy existing.

## Format Excel Send Bulk BA (Tanpa letterNo)
### Kolom umum
- `sentTo` (wajib)
- `subject` (opsional)
- `body` (opsional)
- `cc` (opsional)
- `bcc` (opsional)

### Kolom key per template
- `ba-penempatan`: `mdsName`, `outlet`
- `ba-request-id`: `mdsName`, `area` (alias `region/wilayah`)
- `ba-hold`: `mdsName`, `region`
- `ba-rolling`: `mdsName`, `region`
- `ba-hold-activate`: `mdsName`, `region`
- `ba-takeout`: `mdsName`, `region`
- `ba-terminated`: `mdsName`, `region`

## Checklist Implementasi
1. Tambah migration untuk setting numbering BA per company.
2. Tambah migration untuk counter sequence per `company + template`.
3. Tambah migration untuk `generation_batches` dan `generation_batch_items`.
4. Buat service generator nomor surat BA (transaction-safe / atomic).
5. Integrasikan auto-number di `generate-pdf` (single BA).
6. Integrasikan auto-number + `batch_id` di `bulk/ba-*`.
7. Ubah sender `send-ba-*-emails` agar wajib `batch_id` dan tanpa ketergantungan `letterNo`.
8. Implement endpoint history batch + detail batch.
9. Update dokumentasi API dan contoh payload.

## Skenario Test (High-Level)
Catatan: ini skenario uji level tinggi, detail implementasi test diserahkan ke implementor.

### A. Auto Number Single BA
- `POST /generate-pdf` dengan template `ba-*` menghasilkan `letterNo` otomatis walau request mengirim `data.letterNo`.
- Sequence naik berurutan untuk request berulang pada `company + template` yang sama.
- Sequence template lain tidak mempengaruhi sequence template saat ini.

### B. Auto Number Bulk BA
- Satu request `bulk/ba-*` menghasilkan `batch_id`.
- Tiap baris valid mendapat `letterNo` unik dan berurutan.
- Dua proses bulk paralel di company sama tidak menghasilkan nomor duplikat.
- Jika ada baris/job gagal, nomor yang sudah terambil tidak dipakai ulang.

### C. Send Bulk BA dengan batch_id
- Request tanpa `batch_id` ditolak.
- Request dengan `batch_id` valid dapat menemukan attachment tanpa `letterNo` di Excel.
- Bila kandidat attachment > 1, sistem memilih file terbaru.
- Baris tanpa attachment pada batch terkait di-skip dengan reason jelas.

### D. History Batch
- User/admin hanya melihat batch company sendiri.
- Detail batch menampilkan item, status, dan file yang bisa ditrace.

### E. Regression
- Endpoint non-BA tetap bekerja seperti sebelumnya.
- Format dan pengiriman BA existing tetap kompatibel setelah perubahan.

## Acceptance Criteria
- Semua template `ba-*` memakai auto `letterNo` dengan format default yang disepakati.
- Sequence konsisten per `company + template`, reset `never`, timezone `Asia/Jakarta`.
- `data.letterNo` dari request selalu di-override.
- `send-ba-*-emails` bisa berjalan dengan `batch_id` tanpa input `letterNo` di Excel.
- History batch tersedia sebagai acuan operasional pengiriman email.
- Tidak ada duplikasi nomor surat pada skenario paralel.
