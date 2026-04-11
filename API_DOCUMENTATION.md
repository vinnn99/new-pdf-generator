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
- Superadmin yang ingin generate PDF lewat `/api/v1/generate-pdf` harus menyertakan `company_id` (atau `companyId`) di body; admin otomatis memakai `company_id` miliknya.
- Untuk endpoint bulk (`/api/v1/bulk/*`), user login wajib memiliki `company_id` pada akun.
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
  "role": "user"   // opsional, default "user"; boleh "admin" atau "superadmin" jika diizinkan
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

### Ambil API Key Company (JWT)
`GET /api/v1/company/api-key`  
Headers: `Authorization: Bearer <JWT>`  

Catatan:
- User/admin harus terhubung ke company (`company_id`).
- Superadmin tanpa `company_id` akan menerima 404.
- `allowed_templates` dikembalikan sebagai array (sudah diparse dari kolom DB).

Response 200:
```json
{
  "status": "ok",
  "company": {
    "id": 1,
    "name": "Contoh Corp",
    "apiKey": "abc123",
    "allowed_templates": ["payslip", "ba-penempatan"]
  }
}
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
Admin: hanya melihat user di perusahaannya dan wajib punya `company_id` (jika tidak, respons 403). Superadmin: semua user.

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
Admin dengan `company_id` hanya melihat company-nya sendiri; superadmin melihat semua. Jika admin tanpa `company_id` lolos autentikasi, query tidak difilter (melihat semua company).
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

### Buat Company (Admin/Superadmin)
`POST /api/v1/admin/companies`  
Headers: `Authorization: Bearer <JWT admin/superadmin>`  
Body: `name` (wajib), `api_key` (wajib & unik), optional `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_secure` (bool), `mail_from`, `is_active` (default true).  
Response 201: `{ "status": "created", "company": { ... } }`
Catatan: superadmin bisa membuat company baru. Admin hanya boleh membuat company jika `company_id` kosong; jika sudah punya `company_id` akan ditolak 403.
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
Mengembalikan gabungan template file JS di `resources/pdf-templates/` dan template dinamis aktif dari DB.

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

### Kelola Template Dinamis (Admin/Superadmin)
- `GET /api/v1/admin/dynamic-templates?page=1&perPage=10`
  - Headers: `Authorization: Bearer <JWT admin/superadmin>`
  - Query opsional:
    - `includeInactive=true`
    - `company_id=<id>` (khusus superadmin)
    - `company_id=null` (khusus superadmin, hanya template global)
- `POST /api/v1/admin/dynamic-templates`
  - Headers: `Authorization: Bearer <JWT admin/superadmin>`
  - Body:
```json
{
  "template_key": "dyn-kontrak-kerja",
  "name": "Kontrak Kerja Dinamis",
  "required_fields": ["employeeName", "position"],
  "content": {
    "pageSize": "A4",
    "content": [
      { "text": "Kontrak Kerja", "style": "header" },
      { "text": "Nama: {{employeeName}}" },
      { "text": "Posisi: {{position}}" }
    ]
  },
  "is_active": true
}
```
- `PUT /api/v1/admin/dynamic-templates/:id`
- `POST /api/v1/admin/dynamic-templates/:id/activate`
- `POST /api/v1/admin/dynamic-templates/:id/deactivate`

Catatan:
- Admin hanya dapat membuat/mengubah template dinamis untuk company miliknya.
- Superadmin dapat membuat template global (`company_id` null) atau scope company tertentu.
- Runtime bersifat hybrid: template DB diprioritaskan, lalu fallback ke template file JS legacy.

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
Contoh payload `ba-request-id`:
```json
{
  "template": "ba-request-id",
  "email": "user@example.com",
  "data": {
    "letterNo": "102/OMI-TM/BAK/IV/2026",
    "area": "JTU",
    "mdsName": "MUHAMAD MUZAENI",
    "nik": "3328091505990007",
    "birthDate": "1999-05-15",
    "joinDate": "2026-04-09",
    "status": "MOBILE",
    "stores": [
      "GAB TK EKONOMI@*OBP",
      "GAB TK EKONOMI@*OBP - SLEROK",
      "GAB TK EKONOMI@*OBP - TEKSIN"
    ],
    "reason": "REQUEST ID MDS",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
}
```
Semua template BA (`ba-penempatan`, `ba-request-id`, `ba-hold`, `ba-rolling`, `ba-hold-activate`, `ba-takeout`, `ba-terminated`) mendukung field opsional `signerLeftName`, `signerLeftTitle`, `signerRightName`, `signerRightTitle`. Jika tidak dikirim, sistem memakai default “Adi Anto / Team Leader TEMA Agency” dan “Rizqi Arumdhita / Project Manager Tema Agency”.
Contoh payload `ba-hold`:
```json
{
  "template": "ba-hold",
  "email": "user@example.com",
  "data": {
    "letterNo": "097/OMI-TM/BAK/IV/2026",
    "region": "JTU",
    "holdDate": "2026-04-01",
    "mdsName": "INTAN DESMA SYAWALIA",
    "mdsCode": "MDSUJTU207",
    "status": "STAY",
    "outlet": "Tk Harry & Sons@ *Obp",
    "reason": "IJIN JAGA SUAMI KARENA SUAMINYA KECELAKAN",
    "letterDate": "2026-04-06",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
}
```
Contoh payload `ba-rolling`:
```json
{
  "template": "ba-rolling",
  "email": "user@example.com",
  "data": {
    "letterNo": "099/OMI-TM/BAK/IV/2026",
    "region": "JTU",
    "rollingDate": "2026-04-07",
    "mdsName": "NUZULUL NINA QURANI",
    "mdsCode": "MDSUJTU255",
    "status": "STAY",
    "outletFrom": "DJ TEDDY GAB",
    "outletTo": "MAK SUTINAH*OBP",
    "reason": "KARENA TIDAK KUAT DENGAN PERLAKUAN OWNER DENGAN KATA - KATA KEBUN BINATANG ( TEKANAN BATIN )",
    "letterDate": "2026-04-06",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
}
```
Contoh payload `ba-hold-activate`:
```json
{
  "template": "ba-hold-activate",
  "email": "user@example.com",
  "data": {
    "letterNo": "098/OMI-TM/BAK/IV/2026",
    "region": "JTU",
    "reactivateDate": "2026-04-06",
    "mdsName": "INTAN DESMA SYAWALIA",
    "mdsCode": "MDSUJTU207",
    "status": "STAY",
    "outlet": "Tk Harry & Sons@ *Obp",
    "holdReason": "IJIN JAGA SUAMI KARENA SUAMINYA KECELAKAN",
    "letterDate": "2026-04-06",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
}
```
Contoh payload `ba-takeout`:
```json
{
  "template": "ba-takeout",
  "email": "user@example.com",
  "data": {
    "letterNo": "048/OMI-TM/BAK/III/2026",
    "region": "JTS",
    "takeoutDate": "2026-02-12",
    "mdsName": "BEASTRICE ARUM SEKARWANGI",
    "mdsCode": "MDSUJTS262",
    "status": "STAY",
    "outlet": "KIOS MERAH*OBP",
    "reason": "TOKO TAKEOUT KARENA KIOS MERAH ADA TUNGGAKAN PEMBAYARAN KE WILAYAH",
    "letterDate": "2026-03-12",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
}
```
Contoh payload `ba-terminated`:
```json
{
  "template": "ba-terminated",
  "email": "user@example.com",
  "data": {
    "letterNo": "084/OMI-TM/BAK/III/2026",
    "region": "LPB",
    "terminateDate": "2026-04-01",
    "mdsName": "REVINKA NOOR ALQAMARIAH",
    "mdsCode": "MDSULPB182",
    "status": "STAY",
    "outlet": "TOKO POM SIMBAL *OBP - ALT DERRY YUNG",
    "reasons": [
      "MDS TIDAK MENGIKUTI PERATURAN YANG SUDAH DITENTUKAN MENGENAI LIBUR LEBARAN",
      "TIDAK MENJALANKAN KETENTUAN & INSTRUKSI DARI TL",
      "PIHAK TOKO REQUEST MENGGANTI MDS"
    ],
    "letterDate": "2026-03-31",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  }
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
- `ba-request-id`: `letterNo`, `mdsName`, `nik`, `joinDate`
- `ba-hold`: `letterNo`, `region`, `holdDate`, `mdsName`, `mdsCode`, `status`, `outlet`
- `ba-rolling`: `letterNo`, `region`, `rollingDate`, `mdsName`, `mdsCode`, `status`, `outletFrom`, `outletTo`
- `ba-hold-activate`: `letterNo`, `region`, `reactivateDate`, `mdsName`, `mdsCode`, `status`, `outlet`
- `ba-takeout`: `letterNo`, `region`, `takeoutDate`, `mdsName`, `mdsCode`, `status`, `outlet`
- `ba-terminated`: `letterNo`, `region`, `terminateDate`, `mdsName`, `mdsCode`, `status`, `outlet`

**Penamaan file:**
- `payslip`/`insentif`/`thr`: `<periode>.<template>.<employeeId>.<nama>.<unik>.pdf`
- `ba-penempatan`: `ba-penempatan.<mdsName>.<outlet>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-request-id`: `ba-request-id.<mdsName>.<area>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-hold`: `ba-hold.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-rolling`: `ba-rolling.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-hold-activate`: `ba-hold-activate.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-takeout`: `ba-takeout.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-terminated`: `ba-terminated.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
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
- Admin: melihat semua PDF dalam perusahaannya.
- Admin tanpa `company_id`: tidak melihat data apa pun.
- Superadmin: melihat semua PDF.

---

## 4) Bulk Generate via Excel
Auth: `Authorization: Bearer <JWT>`  
Content-Type: `multipart/form-data` dengan field `file` (xls/xlsx, max 10 MB). Opsi umum: `sheet` (nama sheet), `dryRun=true`, `callback_url`, `callback_header` (JSON string), `company` override nama perusahaan.

### Endpoint
- `POST /api/v1/bulk/payslip`
- `POST /api/v1/bulk/insentif`
- `POST /api/v1/bulk/thr`
- `POST /api/v1/bulk/ba-penempatan`
- `POST /api/v1/bulk/ba-request-id`
- `POST /api/v1/bulk/ba-hold`
- `POST /api/v1/bulk/ba-rolling`
- `POST /api/v1/bulk/ba-hold-activate`
- `POST /api/v1/bulk/ba-takeout`
- `POST /api/v1/bulk/ba-terminated`

Catatan: Template yang di-bulk harus termasuk dalam `allowed_templates` company; jika tidak, request ditolak 403 sebelum baris diproses.
Semua template BA mendukung field opsional `signerLeftName`, `signerLeftTitle`, `signerRightName`, `signerRightTitle`; jika dikosongkan akan memakai default tanda tangan.

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
- **BA Request ID**: `letterNo | area | mdsName | nik | birthDate | joinDate | status | stores | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`
- **BA HOLD**: `letterNo | region | holdDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`
- **BA Rolling**: `letterNo | region | rollingDate | mdsName | mdsCode | status | outletFrom | outletTo | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`
- **BA HOLD Activate**: `letterNo | region | reactivateDate | mdsName | mdsCode | status | outlet | holdReason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`
- **BA Takeout**: `letterNo | region | takeoutDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`
- **BA Terminated**: `letterNo | region | terminateDate | mdsName | mdsCode | status | outlet | reasons | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | email (opsional)`

Kolom umum: `callback_url`, `callback_header` (JSON), `data_json` (override/extra field), `email` (jika penerima berbeda dari akun login).

---

## 5) Bulk Kirim Email Slip
`POST /api/v1/send-slip-emails`  
Auth: `Authorization: Bearer <JWT>`  
Form-data:
- `file` (xls/xlsx, max 5 MB) dengan kolom: `sentTo` (wajib) | `employeeId` (wajib) | `employeeName` | `slipTitle` | `template` (opsional: `payslip`/`insentif`/`thr`) | `body` | `cc` | `bcc`
- `periode` (opsional, filter segmen periode pada nama file, contoh `2026-03`)

Lampiran dicari hanya di `public/download/{companyName}/{email_login}/` (folder disanitasi sesuai email user login) dengan format:
`[periode].[template].[employeeId].[nama].[kodeUnique].pdf`.
Jika ditemukan lebih dari satu kandidat untuk baris yang sama, sistem memilih file paling baru (berdasarkan waktu file).
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
    { "row": 1, "status": "queued", "to": "a@b.com", "attachments": ["2026-03.payslip.123.BUDI.X7A12.pdf"] },
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

## 7) Bulk Kirim Email BA (Request ID, HOLD, Rolling, HOLD Activate, Takeout, Terminated)
Auth: `Authorization: Bearer <JWT>`  
Form-data:
- `file` (xls/xlsx, max 5 MB) dengan kolom minimal: `sentTo`, lalu field wajib per template di bawah. Kolom `subject`, `body`, `cc`, `bcc` opsional.  
Lampiran dicari di `public/download/{companyName}/{email_user_company}/`; hanya satu lampiran pertama yang cocok dikirim.

- `POST /api/v1/send-ba-request-id-emails`  
  - Wajib: `mdsName`, `area/region/wilayah`, `letterNo`  
  - Pola lampiran: `ba-request-id.[mdsName].[area].[letterNo].[unik].pdf`

- `POST /api/v1/send-ba-hold-emails`  
  - Wajib: `mdsName`, `region/wilayah`, `letterNo`  
  - Pola: `ba-hold.[mdsName].[region].[letterNo].[unik].pdf`

- `POST /api/v1/send-ba-rolling-emails`  
  - Wajib: `mdsName`, `region/wilayah`, `letterNo`  
  - Pola: `ba-rolling.[mdsName].[region].[letterNo].[unik].pdf`

- `POST /api/v1/send-ba-hold-activate-emails`  
  - Wajib: `mdsName`, `region/wilayah`, `letterNo`  
  - Pola: `ba-hold-activate.[mdsName].[region].[letterNo].[unik].pdf`

- `POST /api/v1/send-ba-takeout-emails`  
  - Wajib: `mdsName`, `region/wilayah`, `letterNo`  
  - Pola: `ba-takeout.[mdsName].[region].[letterNo].[unik].pdf`

- `POST /api/v1/send-ba-terminated-emails`  
  - Wajib: `mdsName`, `region/wilayah`, `letterNo`  
  - Pola: `ba-terminated.[mdsName].[region].[letterNo].[unik].pdf`

---

## 8) Download PDF
`GET /download/:company/:email/:filename`
- `company`, `email`, `filename` harus URL-encoded.
- Hanya file `.pdf` yang dilayani.

Contoh:
```
GET http://localhost:3334/download/Contoh_Corp/user%40email.com/ba-penempatan.SANTI.GLOBAL_CAFE.075-OMI-TM-BAK-III-2026.ab12C.pdf
```

---

## 9) Pencatatan Email Terkirim
- Setiap pengiriman email (bulk maupun single send) otomatis dicatat ke tabel `email_logs` dengan kolom: `user_id`, `company_id`, `template`, `context`, `to_email`, `cc`, `bcc`, `subject`, `body`, `attachments` (JSON array nama file), `status`, `error`, `created_at`, `updated_at`.
- Setiap pengiriman email (bulk/single), termasuk yang gagal, otomatis melakukan upsert ke tabel `contacts` berdasarkan `(user_id, email)` untuk penerima `to`, `cc`, dan `bcc`:
  - jika belum ada: dibuat contact baru (`source` otomatis `auto-bulk`/`auto-single`, `send_count=1`, `last_sent_at` terisi).
  - jika sudah ada: `send_count` bertambah, `last_sent_at` diperbarui, tanpa duplikasi.
- Status: `sent` atau `failed` (jika nodemailer error).
- Nilai `context`:
  - `bulk-slip` untuk `/send-slip-emails`
  - `bulk-ba` untuk semua BA bulk send
  - `single-send` untuk `/send/{template}`
- Jalankan migrasi sebelum memakai fitur ini: `node ace migration:run`
- Akses riwayat via endpoint:
  - `GET /api/v1/email-logs`
  - Headers: `Authorization: Bearer <JWT>`
  - Query opsional:
    - `page`, `perPage` (default 10, max 100)
    - `q` (pencarian cepat di `to_email`, `subject`, `template`, `context`, `status`, `error`, `username`, `email user`)
    - `user_id` (filter berdasarkan user)
    - `status`, `template`, `context`
    - `company_id` (khusus superadmin)
  - Akses data:
    - `superadmin`: semua company
    - `admin`: hanya company sendiri
    - `user`: hanya log milik user login

---

## 10) Dashboard Summary
`GET /api/v1/dashboard/summary`  
Headers: `Authorization: Bearer <JWT>`  
Query opsional: `scope=user|all`; default `scope` adalah perusahaan (company).  
Syarat:
- User biasa/admin wajib punya `company_id`; jika tidak, respons 401.
- `scope=all` hanya boleh dipakai `superadmin` (selain itu respons 403).
- Untuk `superadmin` tanpa `company_id`, default `scope=company` otomatis diperlakukan sebagai `scope=all`.
Ringkasan:
```json
{
  "status": "ok",
  "company": { "id": 1, "name": "Contoh Corp" },
  "scope": "company",
  "pdf": {
    "total": 120,
    "byTemplate": [{ "template": "ba-penempatan", "total": 45 }],
    "recent": [
      { "id": 10, "template": "ba-terminated", "filename": "...pdf", "download_url": "...", "email": "user@ex.com", "created_at": "2026-04-08T03:30:00.000Z" }
    ]
  },
  "email": {
    "totalSent": 300,
    "totalFailed": 5,
    "byTemplate": [
      { "template": "ba-penempatan", "context": "bulk-ba", "total": 40 },
      { "template": "ba-terminated", "context": "single-send", "total": 5 }
    ],
    "recent": [
      { "id": 21, "template": "ba-rolling", "context": "bulk-ba", "to_email": "a@b.com", "subject": "Berita Acara Rolling", "attachments": ["...pdf"], "status": "sent", "error": null, "created_at": "2026-04-08T03:35:00.000Z" }
    ]
  }
}
```
Catatan: default data difilter `company_id` user login. Jika `scope=all`, data lintas company akan dikembalikan. `attachments` pada `recent` sudah di-parse menjadi array.

---

## Contact Management (JWT)
Role scope:
- `user`: hanya contact miliknya (`contacts.user_id = auth.id`).
- `admin`: semua contact di company sendiri (`contacts.company_id = auth.company_id`).
- `superadmin`: semua contact lintas company.
- Admin tanpa `company_id` akan ditolak (`403`).

Normalisasi:
- Field `email` selalu di-trim dan disimpan lowercase.
- Unik per owner: `(user_id, email)`.

### `POST /api/v1/contacts`
Body minimum:
```json
{ "email": "target@example.com" }
```
Body opsional: `name`, `phone`, `notes`, `user_id`.
- `user`: tidak boleh set `user_id` user lain.
- `admin`: boleh set `user_id` selama user target masih company yang sama.
- `superadmin`: boleh set `user_id` ke user mana pun.

Response 201:
```json
{
  "status": "created",
  "data": {
    "id": 1,
    "user_id": 2,
    "company_id": 1,
    "email": "target@example.com",
    "name": "Target",
    "phone": "0812",
    "notes": null,
    "source": "manual",
    "last_sent_at": null,
    "send_count": 0
  }
}
```

### `GET /api/v1/contacts`
Query opsional:
- `page`, `perPage` (default 10, max 100)
- `q` (quick search ke `email`, `name`, `phone`)
- `user_id` (admin/super sesuai scope)
- `company_id` (khusus superadmin)

Response 200:
```json
{
  "status": "ok",
  "total": 1,
  "perPage": 10,
  "page": 1,
  "lastPage": 1,
  "data": [
    {
      "id": 1,
      "user_id": 2,
      "company_id": 1,
      "email": "target@example.com",
      "name": "Target",
      "phone": "0812",
      "notes": null,
      "source": "manual",
      "last_sent_at": null,
      "send_count": 0
    }
  ]
}
```

### `GET /api/v1/contacts/:id`
- Detail satu contact (wajib lolos scope role).
- Out-of-scope -> `403`.

### `PUT /api/v1/contacts/:id`
Field update: `email`, `name`, `phone`, `notes`.
- `email` divalidasi + dinormalisasi lowercase.
- Konflik unik `(user_id,email)` -> `409`.

### `DELETE /api/v1/contacts/:id`
- Hard delete.
- Hanya role yang in-scope yang boleh menghapus.

---

## 11) Template Ringkas (payload)
- **musik**: surat perjanjian lisensi musik (lihat contoh di README).
- **invoice**: invoice dengan tabel item, PPN default 11%.
- **payslip**: slip gaji; earnings/deductions array atau kolom terpisah di Excel.
- **insentif**: slip insentif; earnings khusus INSENTIF + custom.
- **thr**: slip THR; earnings “THR” + custom.
- **ba-penempatan**: berita acara penempatan MDS; header/footer otomatis, wilayah/outlet variabel.
- **ba-request-id**: berita acara request ID MDS.
- **ba-hold**: berita acara MDS hold.
- **ba-rolling**: berita acara rolling MDS.
- **ba-hold-activate**: berita acara MDS hold diaktifkan kembali.
- **ba-takeout**: berita acara pemberitahuan toko takeout MDS.
- **ba-terminated**: berita acara terminasi MDS.

---

## 12) Status & Error
- 202 queued (generate-pdf).
- 422 validation_failed (field wajib kosong).
- 401 unauthorized (JWT tidak ada / API key salah / email tidak terdaftar).
- 500 error (misconfig SMTP, gagal baca file, dsb).

---

## 13) Catatan untuk Frontend (React)
- Endpoint single generate memakai `x-api-key`; bulk & list memakai Bearer JWT.
- Untuk upload Excel gunakan `FormData` dengan field `file`.
- Saat dryRun, backend tidak enqueue job tapi mengembalikan payload per baris; gunakan ini untuk preview di UI.
- Download URL diberikan di webhook / list; bisa langsung di-`window.open` atau fetch sebagai blob.
