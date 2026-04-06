# API Documentation — PDF Generator Service

Dokumen ringkas semua endpoint agar mudah dipakai sebagai referensi dan prompt saat membuat UI (mis. React).

Base URL default: `http://localhost:3334`  
Semua contoh menggunakan environment lokal; sesuaikan host/port di `.env`.

## Autentikasi & Header
- `x-api-key`: **wajib** untuk endpoint companyAuth (`/api/v1/register`, `/api/v1/generate-pdf`). Nilai diambil dari kolom `api_key` tabel `companies`.
- `Authorization: Bearer <JWT>`: **wajib** untuk endpoint yang memakai middleware `auth:jwt` (bulk endpoints, generated-pdfs, bulk email).
- `Content-Type`: `application/json` untuk body JSON, `multipart/form-data` untuk upload Excel.

---

## 1) Auth

### Register User
`POST /api/v1/register`  
Headers: `x-api-key`
```json
{
  "username": "demo",
  "email": "user@example.com",
  "password": "rahasia123"
}
```
Response 201:
```json
{
  "status": "registered",
  "user": { "id": 1, "username": "demo", "email": "user@example.com", "company": { "id": 1, "name": "Contoh Corp" } }
}
```

### Login
`POST /api/v1/login`
```json
{ "email": "user@example.com", "password": "rahasia123" }
```
Response 200:
```json
{
  "status": "logged_in",
  "token": { "type": "bearer", "token": "<jwt_token>", "refreshToken": null },
  "user": { "id": 1, "username": "demo", "email": "user@example.com", "company": { "id": 1, "name": "Contoh Corp" } }
}
```

---

## 2) Generate PDF (single)

`POST /api/v1/generate-pdf`  
Headers: `x-api-key`, `Content-Type: application/json`
```json
{
  "template": "ba-penempatan",
  "email": "user@example.com",
  "data": {
    "letterNo": "075/OMI-TM/BAK/III/2026",
    "region": "SMS",
    "mdsName": "SANTI",
    "nik": "1505046404980001",
    "birthDate": "1998-04-24",
    "placementDate": "2026-04-01",
    "status": "STAY",
    "category": "BIR",
    "outlet": "GLOBAL CAFE",
    "reason": "Alasan penempatan",
    "location": "Jakarta",
    "letterDate": "2026-03-30",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  },
  "callback": { "url": "https://webhook.site/xxx" }
}
```
Response 202:
```json
{ "status": "queued", "message": "PDF generation is being processed" }
```
Webhook payload (on success):
```json
{
  "success": true,
  "download_url": "http://localhost:3334/download/Contoh_Corp/user%40example.com/ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf",
  "filename": "ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf",
  "saved_at": "public/download/Contoh_Corp/user@example.com/ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf",
  "template": "ba-penempatan",
  "email": "user@example.com",
  "companyName": "Contoh Corp",
  "data": { "...": "..." }
}
```

**Field wajib per template (request.data):**
- `musik`: `nama`, `judul`, `nik`, `address`, `pt`, `pencipta`, `asNama`, `bankName`, `npwp`, `imail`, `phone`, `norek`
- `invoice`: `clientName`, `items`
- `payslip`: `employeeName`, `position`, `period`
- `thr`: `employeeName`, `position`, `period`, `payoutDate`, `baseSalary`
- `ba-penempatan`: `letterNo`, `mdsName`, `placementDate`, `outlet`

**Penamaan file:**
- `payslip`: `YYYY-MM-<slipTitle>-<NIP>-<Nama>-<unik>.pdf`
- `ba-penempatan`: `ba-penempatan.<mdsName>.<outlet>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- Lainnya: `<template>_<unik>.pdf`

---

## 3) List Generated PDF
`GET /api/v1/generated-pdfs?page=1&perPage=10`  
Headers: `Authorization: Bearer <JWT>`
Response 200:
```json
{
  "status": "ok",
  "total": 2,
  "perPage": 10,
  "page": 1,
  "lastPage": 1,
  "data": [
    {
      "id": 5,
      "template": "invoice",
      "filename": "invoice_abcd1.pdf",
      "download_url": "http://localhost:3334/download/Contoh_Corp/user%40example.com/invoice_abcd1.pdf",
      "created_at": "2026-03-06T10:50:00.000Z"
    }
  ]
}
```

---

## 4) Bulk Generate via Excel
Auth: `Authorization: Bearer <JWT>`  
Content-Type: `multipart/form-data` dengan field `file` (xls/xlsx, max 10 MB). Opsi umum: `sheet` (nama sheet), `dryRun=true`, `callback_url`, `callback_header` (JSON string), `company` override nama perusahaan.

### Endpoint
- `POST /api/v1/bulk/payslip`
- `POST /api/v1/bulk/insentif`
- `POST /api/v1/bulk/thr`
- `POST /api/v1/bulk/ba-penempatan`

Response 200:
```json
{
  "status": "ok",
  "mode": "ba-penempatan",
  "total": 5,
  "queued": 5,
  "failed": 0,
  "dryRun": false,
  "sheet": "Sheet1",
  "results": [
    { "row": 1, "email": "user@example.com", "status": "queued" }
  ]
}
```

#### Header kolom Excel (disarankan)
- **Payslip**: `employeeId | employeeName | position | departement | periode | joinDate | ptkp | targetHK | attendance | Gaji Pokok | Tunjangan makan | Tunjangan Transport | Tunjangan Komunikasi | Tunjangan Jabatan | BPJS Ketenagakerjaan | PPH 21 | email (opsional)`
- **Insentif**: `employeeId | employeeName | position | departement | periode | INSENTIF SAMPLING | INSENTIF SELLOUT | INSENTIF KERAJINAN | INSENTIF TL | earnings | deductions | email (opsional)`
- **THR**: `employeeId | employeeName | position | departement | periode | THR | earnings | deductions | note | email (opsional)`
- **BA Penempatan**: `letterNo | mdsName | nik | birthDate | placementDate | status | category | outlet | region | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional) | callback_url | callback_header`

Kolom umum: `callback_url`, `callback_header` (JSON), `data_json` (override/extra field), `email` (jika penerima berbeda dari akun login).

---

## 5) Bulk Kirim Email Slip
`POST /api/v1/send-slip-emails`  
Auth: `Authorization: Bearer <JWT>`  
Form-data:
- `file` (xls/xlsx, max 5 MB) dengan kolom: `sentTo` (wajib) | `employeeId` (wajib) | `employeeName` | `slipTitle` | `body` | `cc` | `bcc`
- `periode` (opsional, filter lampiran dengan prefix nama file, contoh `2026-03`)

Lampiran dicari di `public/download/{companyName}/{email_user_company}/` dan dipilih berdasar `employeeId` (+nama jika ada). Maks 3 lampiran per email.

Response 200:
```json
{
  "status": "ok",
  "total": 10,
  "queued": 8,
  "failed": 1,
  "skipped": 1,
  "results": [
    { "row": 1, "status": "queued", "to": "a@b.com", "attachments": ["2026-03-PAYSLIP-123.pdf"] },
    { "row": 2, "status": "failed", "message": "employeeId kosong" }
  ]
}
```

---

## 6) Bulk Kirim Email BA Penempatan
`POST /api/v1/send-ba-penempatan-emails`  
Auth: `Authorization: Bearer <JWT>`  
Form-data:
- `file` (xls/xlsx, max 5 MB) dengan kolom: `sentTo` (wajib) | `mdsName` (wajib) | `outlet` (wajib) | `letterNo` (wajib) | `subject` (opsional) | `body` (opsional) | `cc` | `bcc`

Lampiran dicari di `public/download/{companyName}/{email_user_company}/` dan dipilih berdasar pola nama `ba-penempatan.[mdsName].[outlet].[letterNo].[unique].pdf` (karakter `/` di `letterNo` diganti `-`, spasi jadi `_`). Hanya satu lampiran dikirim per baris (pertama yang cocok).

Response 200:
```json
{
  "status": "ok",
  "total": 5,
  "queued": 5,
  "failed": 0,
  "skipped": 0,
  "results": [
    { "row": 1, "status": "queued", "to": "a@b.com", "attachment": "ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf" }
  ]
}
```

---

## 7) Download PDF
`GET /download/:company/:email/:filename`
- `company`, `email`, `filename` harus URL-encoded.
- Hanya file `.pdf` yang dilayani.

Contoh:
```
GET http://localhost:3334/download/Contoh_Corp/user%40email.com/ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf
```

---

## 8) Template Ringkas (payload)
- **musik**: surat perjanjian lisensi musik (lihat contoh di README).
- **invoice**: invoice dengan tabel item, PPN default 11%.
- **payslip**: slip gaji; earnings/deductions array atau kolom terpisah di Excel.
- **insentif**: slip insentif; earnings khusus INSENTIF + custom.
- **thr**: slip THR; earnings “THR” + custom.
- **ba-penempatan**: berita acara penempatan MDS; header/footer otomatis, wilayah/outlet variabel.

---

## 9) Status & Error
- 202 queued (generate-pdf).
- 422 validation_failed (field wajib kosong).
- 401 unauthorized (JWT tidak ada / API key salah / email tidak terdaftar).
- 500 error (misconfig SMTP, gagal baca file, dsb).

---

## 10) Catatan untuk Frontend (React)
- Endpoint single generate memakai `x-api-key`; bulk & list memakai Bearer JWT.
- Untuk upload Excel gunakan `FormData` dengan field `file`.
- Saat dryRun, backend tidak enqueue job tapi mengembalikan payload per baris; gunakan ini untuk preview di UI.
- Download URL diberikan di webhook / list; bisa langsung di-`window.open` atau fetch sebagai blob.
