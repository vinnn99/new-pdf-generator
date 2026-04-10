# Issue Plan: Standardisasi Nama File Bulk + Update Pencarian Lampiran

## Ringkasan Bug Fix
1. Saat `POST bulk/payslip`, `POST bulk/insentif`, dan `POST bulk/thr`, ubah penamaan file menjadi:
`[periode].[template].[employeeId].[nama].[kodeUnique]`
2. Saat `POST send-slip-emails`, sesuaikan pencarian lampiran agar mengikuti format nama file baru.
3. Jika ditemukan lebih dari satu file attachment untuk data yang sama (berbeda `kodeUnique`), pilih file yang paling baru.

## Tujuan
- Semua file PDF hasil proses bulk memakai format nama yang konsisten dan mudah ditelusuri.
- Endpoint pengiriman email tetap bisa menemukan lampiran dengan benar setelah format nama file diubah.
- Saat ada lebih dari satu kandidat lampiran, sistem konsisten memilih file terbaru.

## Scope Implementasi
- Update logic pembentukan nama file untuk tiga endpoint bulk:
  - `POST bulk/payslip`
  - `POST bulk/insentif`
  - `POST bulk/thr`
- Update logic lookup/pencarian lampiran pada:
  - `POST send-slip-emails`
- Tambahkan rule seleksi lampiran terbaru jika hasil pencarian lebih dari satu file.
- Update dokumentasi internal singkat terkait format nama file baru.

## Out of Scope
- Perubahan template isi PDF.
- Perubahan flow bisnis email selain lookup lampiran.
- Refactor besar di modul lain yang tidak terkait bug ini.

## Format Nama File Baru
Format target:
`[periode].[template].[employeeId].[nama].[kodeUnique]`

Catatan implementasi:
- Gunakan delimiter titik (`.`) sesuai format.
- Pastikan nilai `kodeUnique` benar-benar unik per file.
- Jika sistem menyimpan file dengan ekstensi, gunakan format:
`[periode].[template].[employeeId].[nama].[kodeUnique].pdf`
- Terapkan sanitasi karakter untuk mencegah nama file invalid pada filesystem.

## Rencana Teknis Singkat
1. Identifikasi titik pembuatan nama file pada flow bulk (`payslip`, `insentif`, `thr`).
2. Pusatkan pembuatan nama file ke helper/fungsi yang sama agar format konsisten.
3. Ubah flow `send-slip-emails` agar pencarian lampiran menggunakan pola nama file baru.
4. Jika hasil pencarian lampiran lebih dari satu, urutkan berdasarkan waktu file (terbaru dulu) lalu pilih satu file paling baru.
5. Siapkan tie-breaker deterministik bila waktu file sama (misalnya urutan nama file) agar hasil konsisten.
6. Pastikan kompatibilitas dengan data request yang sudah ada (`periode`, `template`, `employeeId`, `nama`, `kodeUnique`/padanan field).
7. Update dokumentasi endpoint/flow yang menyebut format nama file.

## Checklist Implementasi
1. Ubah generator nama file di endpoint bulk sesuai format baru.
2. Pastikan ketiga endpoint bulk menggunakan logic yang sama (shared helper/disiplin format).
3. Ubah lookup lampiran di `send-slip-emails` agar match format baru.
4. Tambahkan rule pemilihan file terbaru jika kandidat lampiran lebih dari satu.
5. Verifikasi logging/error message tetap jelas saat lampiran tidak ditemukan atau saat terjadi multiple match.
6. Update dokumentasi singkat di repo.

## Skenario Test (High-Level)
Catatan: cukup skenario uji, detail teknis implementasi test diserahkan ke implementor.

### A. Skenario `POST bulk/payslip`, `POST bulk/insentif`, `POST bulk/thr`
- Request valid menghasilkan nama file dengan urutan:
`periode.template.employeeId.nama.kodeUnique` (dan ekstensi jika dipakai).
- `kodeUnique` berbeda untuk file yang berbeda.
- Karakter khusus pada `nama` tidak menyebabkan nama file invalid.
- Semua endpoint bulk menghasilkan pola nama file yang sama (konsisten).

### B. Skenario `POST send-slip-emails`
- Email berhasil dikirim saat lampiran memakai format nama file baru.
- Sistem menemukan lampiran yang tepat untuk setiap karyawan/record.
- Jika ada lebih dari satu lampiran yang cocok (beda `kodeUnique`), sistem memilih file terbaru.
- Pemilihan file terbaru konsisten meskipun ada beberapa kandidat.
- Saat lampiran tidak ditemukan, response/error tetap informatif.

### C. Regression Scenario
- Proses generate PDF bulk tetap berjalan normal (tidak ada penurunan fungsi lain).
- Proses kirim email slip tetap berjalan untuk data valid.
- Endpoint lain yang tidak terkait tetap berfungsi seperti sebelumnya.

## Acceptance Criteria
- Ketiga endpoint bulk menghasilkan nama file sesuai format baru.
- `send-slip-emails` berhasil mencari dan mengirim lampiran dengan format baru.
- Jika ada multiple attachment match, `send-slip-emails` selalu memilih file terbaru.
- Tidak ada regression pada alur generate bulk dan pengiriman email yang terkait.
- Dokumentasi singkat format baru tersedia di repo.
