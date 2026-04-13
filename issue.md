# Issue Plan: Custom Signature URL untuk Semua Template BA

## Ringkasan Masalah
Semua template BA (`ba-*`) saat ini belum mendukung konfigurasi tanda tangan kiri/kanan yang fleksibel. Dibutuhkan cara sederhana untuk menyisipkan gambar tanda tangan via URL agar bisa diisi per permintaan (single) maupun per baris Excel (bulk), tanpa mengubah alur auto-number/batch yang sudah ada.

## Tujuan
- Memastikan setiap PDF BA dapat menampilkan tanda tangan kiri dan kanan yang dikirim via URL.
- Tetap kompatibel dengan flow existing (auto letterNo, batch_id, lookup attachment) tanpa memaksa perubahan di konsumen lama.
- Memberi jalur fallback jika URL tanda tangan tidak diisi atau gagal dimuat.

## Scope Implementasi
1) **Input data**
- Single BA (`POST /api/v1/generate-pdf`): terima optional `data.signatureLeftUrl` dan `data.signatureRightUrl` untuk semua template `ba-*`.
- Bulk BA Excel (`POST /api/v1/bulk/ba-*`): tambah kolom opsional `signatureLeftUrl`, `signatureRightUrl`. Jika kosong, ikuti fallback (lihat di bawah).
- Bulk BA dry-run tetap menandai placeholder; tidak perlu fetch URL.

2) **Template rendering**
- Update semua file template BA (`ba-penempatan`, `ba-request-id`, `ba-hold`, `ba-rolling`, `ba-hold-activate`, `ba-takeout`, `ba-terminated`) agar:
  - Mengambil URL kiri/kanan dari payload (`data.signatureLeftUrl` / `data.signatureRightUrl`).
  - Jika hanya satu sisi terisi, sisi lain tetap memakai placeholder lama (nama/jabatan) tanpa gambar.
  - Jika tidak ada URL, gunakan perilaku saat ini (tanpa gambar atau gambar default bila sudah ada).
  - Pastikan layout tidak pecah jika gambar gagal dimuat; gunakan ukuran maksimum yang wajar dan `fit`/`width` konsisten antar template.

3) **Storage & batch metadata**
- Tidak ada perubahan schema DB. `row_data` di `generation_batch_items` sudah menyimpan payload baris; cukup pastikan kolom baru ikut terserialisasi.
- Tidak perlu menyimpan file gambar; render langsung dari URL.

4) **Validasi & keamanan**
- Batasi jenis URL ke `http/https`; tolak/abaikan skema lain.
- Optional: batasi ukuran piksel/rasio via pdfmake setting (mis. `fit: [120, 60]`).
- Jika fetch gambar gagal saat render, fallback ke kotak tanda tangan teks (nama/jabatan) tanpa menggagalkan seluruh PDF.

5) **API & dokumen**
- Perbarui `API_DOCUMENTATION.md` untuk menambahkan field optional `signatureLeftUrl`, `signatureRightUrl` pada contoh payload single dan kolom Excel bulk BA.
- Tambah catatan kompatibilitas: kolom baru opsional, tidak mengubah format wajib lainnya.

6) **Backward compatibility**
- Jangan mengubah nama kolom wajib di Excel BA.
- Default behavior harus identik jika URL tidak dikirim.

## Out of Scope
- Upload/hosting file tanda tangan.
- Penandatanganan digital/QR legal.
- Perubahan flow email atau auto-number.

## Rencana Implementasi Tingkat Tinggi
- Tambah parsing kolom baru di BulkPdfController untuk mode `ba-*` dan teruskan ke payload job.
- Pastikan GeneratePdfJob membawa field tersebut ke template renderer.
- Patch setiap template BA untuk menggambar gambar tanda tangan kiri/kanan jika URL ada, dengan fallback teks.
- Update dokumentasi API dan contoh Excel.

## Skenario Uji (tingkat tinggi)
- Single BA dengan dua URL valid: kedua gambar muncul, layout stabil.
- Single BA hanya kiri diisi: kiri bergambar, kanan fallback teks.
- Single BA URL tidak dapat diakses: PDF tetap terbuat, area tanda tangan jadi teks.
- Bulk BA: baris berbeda memiliki URL berbeda; setiap PDF memakai URL baris masing-masing.
- Bulk BA tanpa kolom baru: perilaku lama tidak berubah.
- Regressi: auto letterNo, batch_id, dan pengiriman email bulk tetap berfungsi seperti sebelumnya.

## Acceptance Criteria
- Semua template `ba-*` mendukung `signatureLeftUrl` dan `signatureRightUrl` opsional tanpa memaksa input baru.
- PDF tidak gagal dibuat ketika URL gambar invalid; fallback teks tampil.
- Dokumentasi API dan contoh Excel menyebut kolom/field baru sebagai opsional.
