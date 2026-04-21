# Issue Plan: Tambah Template `ba-cancel-join`

## Ringkasan
Tambahkan template BA baru bernama `ba-cancel-join` dengan referensi layout dari lampiran:
`C:\Users\ayisl\Downloads\01. SURAT BA BATAL JOIN MDS OT - VINALIA.pdf`.

Implementasi harus mengikuti pola template BA existing (`ba-*`) untuk:
- Generate single
- Generate bulk
- Kirim email single (generate + send)
- Kirim email bulk dari hasil batch
- Update dokumentasi

## Tujuan
- Template `ba-cancel-join` bisa dipakai end-to-end seperti template BA lain.
- Flow dan naming konsisten dengan arsitektur saat ini.
- Mekanisme `letterNo` wajib auto-generate mengikuti standar template `ba-*` lain.
- Instruksi cukup jelas untuk dikerjakan junior programmer / model AI murah.

## Scope Implementasi
1. Tambah template PDF baru `ba-cancel-join`.
2. Aktifkan di resolver/validasi field wajib.
3. Aktifkan generate single dan bulk.
4. Aktifkan send email single dan bulk.
5. Tambah endpoint route terkait.
6. Tambah template Excel bulk.
7. Update dokumentasi (`README.md`, `API_DOCUMENTATION.md`).
8. Tambah/adjust test coverage level endpoint dan flow BA.

## Rencana Teknis Per Area
1. Analisis field dari lampiran
- Ambil field yang benar-benar dipakai pada surat contoh (judul, tanggal, identitas MDS, alasan batal join, penandatangan, dll).
- Tentukan:
  - daftar field wajib payload `data`
  - field key untuk pencarian lampiran bulk email (`match_key`) mengikuti pola `BaTemplateService`
  - template code untuk preview letter number di `BaTemplateService` (misal kode singkatan, final sesuai keputusan tim).

2. Template engine
- Buat file baru:
  - `app/Templates/ba-cancel-join.js`
  - `resources/pdf-templates/ba-cancel-join.js` (re-export ke file `app/Templates`)
- Ikuti struktur template BA existing (header/footer, signature kiri/kanan, format tanggal, fallback value).

3. Registrasi template BA
- Update `app/Services/TemplateResolver.js`:
  - Tambah `LEGACY_REQUIRED_FIELDS['ba-cancel-join']`.
- Update `app/Services/BaTemplateService.js`:
  - Tambah `TEMPLATE_CODES['ba-cancel-join']`.
  - Tambah `MATCH_KEY_FIELDS['ba-cancel-join']`.
  - Tambah alias extractor kalau perlu (misal variasi kolom `region/area/wilayah` atau nama MDS).

4. Single generate + send email
- Update `app/Controllers/Http/SingleEmailController.js`:
  - Tambah method `sendBaCancelJoin`.
  - Daftarkan mapping `requiredFields(template)`.
  - Daftarkan mapping subject/body/title agar konsisten gaya BA existing.
- Update route:
  - `POST /api/v1/send/ba-cancel-join`

5. Bulk generate
- Update `app/Controllers/Http/BulkPdfController.js`:
  - Tambah method `baCancelJoinFromExcel`.
  - Tambah switch di `buildPayloadForMode`.
  - Tambah `buildBaCancelJoinPayload(lower, opts)` + validasi field wajib.
  - Pastikan `match_key` terisi sesuai aturan BA template service.
- Update route:
  - `POST /api/v1/bulk/ba-cancel-join`

6. Bulk email
- Update `app/Controllers/Http/BulkEmailController.js`:
  - Tambah method `sendBaCancelJoin`.
  - Konfigurasi `cfg` (template, required match fields, default subject, default body).
  - Gunakan jalur generic `_sendBaTemplate` seperti BA lain.
- Update route:
  - `POST /api/v1/send-ba-cancel-join-emails`

7. Filename dan batch metadata
- Update `app/Jobs/GeneratePdfJob.js`:
  - Tambah rule nama file untuk `ba-cancel-join` mengikuti pola `ba-*`.
  - Gunakan kombinasi field yang relevan (misalnya `mdsName + region/area + letterNo + uniqueId`) sesuai keputusan field final.

8. Aturan auto `letterNo` (WAJIB, ikuti BA existing)
- Single (`POST /api/v1/send/ba-cancel-join`):
  - Generate `letterNo` via `BaLetterNoService.nextLetterNo(...)`.
  - Nilai `data.letterNo` dari request harus di-override oleh nilai auto-generated.
- Bulk (`POST /api/v1/bulk/ba-cancel-join`):
  - Setiap row generate `letterNo` otomatis (bukan pakai nilai kolom excel).
  - Jika ada kolom `letterNo/no surat` di excel, perlakukan hanya sebagai input opsional dan tetap override dengan nomor auto.
  - Saat `dryRun`, gunakan placeholder seperti pola existing BA (tanpa konsumsi counter final).
- Preview BA (jika endpoint preview dipakai):
  - Gunakan format `PREVIEW/{CompanyCode}/{TemplateCode}/{RomanMonth}/{Year}`.
  - Preview tidak boleh menaikkan counter `letterNo` final.

9. Bulk template Excel dan script pendukung
- Update `scripts/create-bulk-template.js`:
  - Tambah definisi `ba-cancel-join` (filename, headers, sample).
- Generate file template:
  - `resources/templates/ba-cancel-join-bulk-template.xlsx`
- Opsional tapi disarankan:
  - Update `scripts/generate-ba-previews.js` agar `ba-cancel-join` ikut bisa digenerate untuk pengecekan visual internal.

10. Routing dan endpoint matrix
- Update `start/routes.js` untuk tiga endpoint baru (single send, bulk generate, bulk send email).
- Update `test/functional/api_endpoint_matrix.spec.js` agar endpoint baru ikut matrix coverage minimal.

11. Dokumentasi
- Update `README.md`:
  - daftar template BA yang didukung
  - contoh payload `ba-cancel-join`
  - field wajib
  - aturan auto `letterNo` (single/bulk override, preview format sementara)
  - pola nama file
  - endpoint bulk + endpoint send email single/bulk
- Update `API_DOCUMENTATION.md` dengan konten yang setara.

## Skenario Yang Harus Diuji (High-Level)
- Template `ba-cancel-join` bisa generate PDF melalui flow standar (payload valid).
- Validasi field wajib berjalan (payload kurang field wajib -> `422`).
- Endpoint single send `POST /api/v1/send/ba-cancel-join` menghasilkan status queued saat valid.
- Endpoint bulk generate `POST /api/v1/bulk/ba-cancel-join` menerima file Excel valid dan membuat batch item.
- Endpoint bulk send `POST /api/v1/send-ba-cancel-join-emails` bisa menemukan lampiran dari `batch_id + match_key`.
- Jika attachment tidak ketemu pada bulk send, row ditandai skipped/failed sesuai pola existing.
- Single dan bulk tidak memakai `letterNo` manual dari request/excel; sistem selalu auto-generate nomor surat final.
- Jika preview digunakan, `letterNo` preview pakai format PREVIEW dan tidak menambah counter surat final.
- Penamaan file output mengikuti pola BA dan mengandung `letterNo` yang sudah disanitasi.
- Allowed template company tetap dihormati (template tidak diizinkan -> `403`).
- Semua endpoint baru tetap protected JWT sesuai pola route existing.

## Out of Scope
- Perubahan UI frontend.
- Perubahan schema database baru (kecuali implementor menemukan blocker yang benar-benar butuh migration).
- Refactor besar pada flow BA existing di luar kebutuhan `ba-cancel-join`.

## Acceptance Criteria
- `ba-cancel-join` tersedia sebagai template legacy dan dapat di-resolve.
- Flow single generate+send berfungsi melalui endpoint baru.
- Flow bulk generate + bulk send berfungsi melalui endpoint baru.
- Mekanisme auto `letterNo` berjalan konsisten dengan template `ba-*` existing.
- Template Excel bulk `ba-cancel-join` tersedia di `resources/templates`.
- Dokumentasi `README.md` dan `API_DOCUMENTATION.md` sudah mencakup `ba-cancel-join`.
- Test skenario utama untuk endpoint baru sudah ditambahkan/diupdate.
