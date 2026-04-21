# Backend Change Note
Release Date: 2026-04-21
Owner: Backend Team
Status: Released

## Ringkasan
Rilis ini menambahkan template BA baru `ba-cancel-join` beserta seluruh flow yang dibutuhkan: single send, bulk generate, dan bulk send email.

## Perubahan Utama
- Template baru: `ba-cancel-join`.
- Penamaan file PDF untuk template baru mengikuti pola BA existing.
- Auto `letterNo` untuk template baru mengikuti pola `ba-*` lain.
- Dokumentasi API diperbarui di `README.md` dan `API_DOCUMENTATION.md`.

## Endpoint Baru
- `POST /api/v1/send/ba-cancel-join`
- `POST /api/v1/bulk/ba-cancel-join`
- `POST /api/v1/send-ba-cancel-join-emails`

## Kontrak Data
Field wajib (`data`):
- `region`
- `cancelJoinDate`
- `mdsName`
- `mdsCode`
- `status`
- `outlet`

Field opsional (`data`):
- `reason`
- `location`
- `letterDate`
- `signerLeftName`
- `signerLeftTitle`
- `signerRightName`
- `signerRightTitle`
- `signatureLeftUrl`
- `signatureRightUrl`

Catatan penting:
- `data.letterNo` selalu auto-generated di backend dan akan override nilai dari request.
- Untuk preview BA, nomor surat tetap format `PREVIEW/...` dan tidak menambah counter final.
- Pola nama file output:
  - `ba-cancel-join.<mdsName>.<region>.<letterNo>.<unique>.pdf`

## Dampak ke Frontend
- Tambahkan opsi template `ba-cancel-join` di UI.
- Tambahkan form single generate/send untuk field kontrak di atas.
- Tambahkan flow bulk upload untuk endpoint `bulk/ba-cancel-join`.
- Tambahkan flow bulk send BA untuk endpoint `send-ba-cancel-join-emails`.
- Update validasi FE sesuai field wajib.
- Jangan kirim `letterNo` sebagai input utama UX karena nilainya di-generate backend.

## Artifact Pendukung
- File template bulk:
  - `resources/templates/ba-cancel-join-bulk-template.xlsx`

## Kompatibilitas
- Tidak ada breaking change untuk endpoint lama.
- Seluruh endpoint BA existing tetap berjalan.

## Validasi Backend
- `npm test` lulus.
- Ringkasan hasil test saat implementasi:
  - Passed: 190
  - Failed: 0

## Action Required
- Frontend melakukan update integrasi endpoint + form.
- QA menjalankan UAT minimum:
  - Single send `ba-cancel-join`.
  - Bulk generate `ba-cancel-join`.
  - Bulk send email `ba-cancel-join` berbasis `batch_id`.
  - Validasi error `422` saat field wajib tidak lengkap.
