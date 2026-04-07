# API Documentation — PDF Generator Service

Dokumen ringkas semua endpoint agar mudah dipakai sebagai referensi dan prompt saat membuat UI (mis. React).

Base URL default: `http://localhost:3334`  
Semua contoh menggunakan environment lokal; sesuaikan host/port di `.env`.

## Autentikasi & Header
- `x-api-key`: **wajib** untuk endpoint companyAuth (`/api/v1/register`, `/api/v1/generate-pdf`). Nilai diambil dari kolom `api_key` tabel `companies`.
- `Authorization: Bearer <JWT>`: **wajib** untuk endpoint yang memakai middleware `auth:jwt` (bulk endpoints, generated-pdfs, bulk email, admin/superadmin).
- `Role`: enum `user | admin | superadmin`.
  - `admin` wajib punya `company_id`, akses dibatasi ke perusahaannya.
  - `superadmin` tidak perlu `company_id`, bisa kelola semua user & company.
- `is_active`: boolean pada user; login ditolak jika `is_active=false`.
- `Company is_active`: jika perusahaan tidak aktif, semua user di perusahaan tersebut tidak bisa login dan tidak lolos `companyAuth`.
- Superadmin yang ingin generate PDF harus menyertakan `company_id` (atau `companyId`) di body; admin otomatis memakai `company_id` miliknya.
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
  "password": "rahasia123",
  "role": "user"   // opsional, default "user"; boleh "admin" jika diizinkan
}
```
Response 201:
```json
{
  "status": "registered",
  "user": { "id": 1, "username": "demo", "email": "user@example.com", "role": "user", "company": { "id": 1, "name": "Contoh Corp" } }
}
```
Contoh error 422:
```json
{ "status": "validation_failed", "message": "Validasi gagal", "errors": [{ "field": "email", "validation": "unique" }] }
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
  "user": { "id": 1, "username": "demo", "email": "user@example.com", "role": "user", "company": { "id": 1, "name": "Contoh Corp" } }
}
```
Jika `is_active=false`, respons 403: `{ "status": "error", "message": "User tidak aktif" }`
Jika perusahaan user tidak aktif, respons 403: `{ "status": "error", "message": "Perusahaan tidak aktif" }`
Jika `role=admin` tanpa `company_id`, respons 403: `{ "status": "error", "message": "Admin tidak terhubung ke perusahaan" }`
Superadmin boleh login tanpa `company_id`, tetapi wajib menyertakan `company_id` saat generate/bulk PDF.
Superadmin boleh login tanpa `company_id`, tetapi saat generate PDF wajib menyertakan `company_id` (lihat generate PDF).

### Change Password (JWT)
`POST /api/v1/change-password`  
Headers: `Authorization: Bearer <JWT>`
```json
{
  "oldPassword": "rahasia123",
  "newPassword": "rahasiaBaru456"
}
```
Rules: both required, min 6; `oldPassword` must match current password.  
Response 200: `{ "status": "password_changed" }`
Contoh error 401 (old password salah):
```json
{ "status": "error", "message": "Password lama salah" }
```

### Buat User (Admin/Superadmin)
`POST /api/v1/admin/users`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`
```json
{
  "username": "userbaru",
  "email": "userbaru@example.com",
  "password": "sekret123",
  "role": "user",        // atau admin/superadmin
  "company_id": 1        // wajib untuk role user/admin saat dibuat superadmin; admin otomatis pakai company-nya
}
```
Response 201:
```json
{
  "status": "created",
  "user": {
    "id": 2,
    "username": "userbaru",
    "email": "userbaru@example.com",
    "role": "user",
    "company_id": 1
  }
}
```
Catatan:
- Admin: selalu memakai `company_id` miliknya, tidak bisa membuat superadmin.
- Superadmin: boleh membuat user/admin/superadmin; untuk user/admin harus isi `company_id`.

### List User (Admin/Superadmin)
`GET /api/v1/admin/users?page=1&perPage=10`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Pagination (`perPage` maks 100), urut `created_at` desc.  
Admin: hanya melihat user di perusahaannya. Superadmin: semua user.

### Ubah User (Admin/Superadmin)
`PUT /api/v1/admin/users/:id`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`
Body (opsional): `username`, `email`, `role` (`user|admin|superadmin`), `is_active` (boolean), `company_id` (hanya superadmin)  
Admin: hanya bisa ubah user di perusahaannya, tidak bisa set role superadmin atau ubah `company_id`.  
Superadmin: bebas ubah role (termasuk superadmin) dan `company_id`.

### Nonaktifkan User (Admin/Superadmin)
`POST /api/v1/admin/users/:id/deactivate`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Admin hanya bisa nonaktifkan user perusahaannya; superadmin semua.  
Respons 200: `{ "status": "deactivated", "user_id": 5 }`

### Reset Password User (Admin/Superadmin)
`POST /api/v1/admin/users/:id/password`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Body: `{ "password": "minimal6karakter" }`  
Admin dibatasi perusahaan sendiri; superadmin semua.  
Respons 200: `{ "status": "password_reset", "user_id": 5 }`

### Daftar Company (Admin/Superadmin)
`GET /api/v1/admin/companies?page=1&perPage=10`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Pagination (`perPage` maks 100), urut `created_at` desc.  
Admin dengan `company_id` hanya melihat company-nya sendiri; superadmin melihat semua.
Contoh respons:
```json
{
  "status": "ok",
  "total": 2,
  "perPage": 10,
  "page": 1,
  "lastPage": 1,
  "data": [
    { "company_id": 1, "name": "Contoh Corp", "api_key": "abc123", "is_active": true, "allowed_templates": "[\"payslip\",\"ba-penempatan\"]" }
  ]
}
```

### Buat Company (Superadmin)
`POST /api/v1/admin/companies`  
Headers: `Authorization: Bearer <JWT superadmin>`  
Body: `name` (wajib), `api_key` (wajib & unik), optional `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_secure` (bool), `mail_from`, `is_active` (default true).  
Response 201: `{ "status": "created", "company": { ... } }`
Catatan: superadmin bisa membuat company baru; admin yang sudah punya `company_id` tidak diizinkan.
Contoh respons:
```json
{
  "status": "created",
  "company": {
    "company_id": 3,
    "name": "Perusahaan Baru",
    "api_key": "NEWKEY123",
    "is_active": true,
    "allowed_templates": "[\"payslip\",\"ba-penempatan\"]"
  }
}
```

### Edit Company (Admin/Superadmin)
`PUT /api/v1/admin/companies/:id`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Body opsional: `name`, `api_key` (unik), SMTP fields, `is_active` (bool).  
Response 200: `{ "status": "updated", "company": { ... } }`
Admin dengan `company_id` hanya boleh mengedit company miliknya; superadmin bebas.

### Aktifkan Company (Admin/Superadmin)
`POST /api/v1/admin/companies/:id/activate`  
Response 200: `{ "status": "activated", "company": { ... } }`  
Admin dengan `company_id` hanya boleh mengubah status company miliknya; superadmin bebas.

### Nonaktifkan Company (Admin/Superadmin)
`POST /api/v1/admin/companies/:id/deactivate`  
Response 200: `{ "status": "deactivated", "company": { ... } }`  
Admin dengan `company_id` hanya boleh mengubah status company miliknya; superadmin bebas.  
Catatan: ketika nonaktif, semua user perusahaan tersebut tidak dapat login / melewati `companyAuth`.

### Daftar Template (Superadmin)
`GET /api/v1/admin/templates`  
Headers: `Authorization: Bearer <JWT superadmin>`  
Mengembalikan semua template yang tersedia di `resources/pdf-templates/`.

### Atur Template Per Company (Superadmin)
`POST /api/v1/admin/companies/:id/templates`  
Headers: `Authorization: Bearer <JWT superadmin>`  
Body: `templates` (array atau string dipisah koma)  
Menyimpan ke kolom `allowed_templates`; generate/bulk akan memeriksa daftar ini (jika kosong, semua template diizinkan).
Contoh request body:
```json
{ "templates": ["payslip", "ba-penempatan"] }
```
Contoh respons:
```json
{
  "status": "updated",
  "allowed_templates": ["payslip","ba-penempatan"],
  "company": { "company_id": 1, "name": "Contoh Corp", "allowed_templates": "[\"payslip\",\"ba-penempatan\"]" }
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
Contoh error 403 (template tidak diizinkan):
```json
{ "status": "forbidden", "message": "Template 'musik' tidak diizinkan untuk company ini" }
```
Catatan:
- Superadmin harus menyertakan `company_id` (atau `companyId`) di body agar lolos `companyAuth`.
- Template yang boleh dipakai mengikuti `allowed_templates` pada company; jika daftar tidak kosong dan template tidak ada di dalamnya, respons 403.
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
Hak akses:
- User biasa: hanya melihat PDF yang ia generate sendiri.
- Admin: melihat semua PDF dalam perusahaannya (jika `company_id` null, akan melihat semua).

---

## 4) Bulk Generate via Excel
Auth: `Authorization: Bearer <JWT>`  
Content-Type: `multipart/form-data` dengan field `file` (xls/xlsx, max 10 MB). Opsi umum: `sheet` (nama sheet), `dryRun=true`, `callback_url`, `callback_header` (JSON string), `company` override nama perusahaan.

### Endpoint
- `POST /api/v1/bulk/payslip`
- `POST /api/v1/bulk/insentif`
- `POST /api/v1/bulk/thr`
- `POST /api/v1/bulk/ba-penempatan`

Catatan: Template yang di-bulk harus termasuk dalam `allowed_templates` company; jika tidak, request ditolak 403 sebelum baris diproses.

Contoh request `bulk/payslip` (form-data):
- Header: `Authorization: Bearer <JWT>`
- Body:
  - `file`: attach `payroll.xlsx`
  - `sheet`: `Sheet1`
  - `dryRun`: `false`

Contoh respons sukses:
```json
{
  "status": "ok",
  "mode": "payslip",
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
Contoh error 403 (template tidak diizinkan):
```json
{ "status": "forbidden", "message": "Template 'payslip' tidak diizinkan untuk company ini" }
```

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

Lampiran dicari hanya di `public/download/{companyName}/{email_login}/` (folder disanitasi sesuai email user login) dan dipilih berdasar `employeeId` (+nama jika ada). Maks 3 lampiran per email.
SMTP: jika semua field SMTP di tabel `companies` terisi (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, opsional `smtp_secure`, `mail_from`) maka dipakai; jika tidak lengkap, fallback ke `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`).

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

Lampiran dicari di `public/download/{companyName}/{email_login}/` dan dipilih berdasar pola nama `ba-penempatan.[mdsName].[outlet].[letterNo].[unique].pdf` (karakter `/` di `letterNo` diganti `-`, spasi jadi `_`). Hanya satu lampiran dikirim per baris (pertama yang cocok).

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
