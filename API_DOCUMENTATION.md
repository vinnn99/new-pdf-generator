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

### Get Company API Key (JWT)
`GET /api/v1/company/api-key`  
Headers: `Authorization: Bearer <JWT>`  
Mengembalikan API key perusahaan yang terhubung dengan user login.  
Response 200:
```json
{
  "status": "ok",
  "company": {
    "id": 1,
    "name": "Contoh Corp",
    "apiKey": "abcd1234"
  }
}
```
Jika user belum terhubung ke perusahaan atau perusahaan tidak ditemukan, balikan 404 dengan pesan kesalahan.

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
    "reason": "REQUEST ID MDS"
  }
}
```
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
    "location": "Jakarta"
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
    "location": "Jakarta"
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
    "location": "Jakarta"
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
    "location": "Jakarta"
  }
}
```
Response 202:
```json
{ "status": "queued", "message": "PDF generation is being processed" }
```

### Kirim Email Single + Generate PDF (JWT)
`POST /api/v1/send/{template}`  
Headers: `Authorization: Bearer <JWT>`, `Content-Type: application/json`  
Template yang tersedia: `ba-penempatan`, `ba-request-id`, `ba-hold`, `ba-rolling`, `ba-hold-activate`, `ba-terminated`.

Payload umum:
```json
{
  "to": "penerima@example.com",
  "cc": ["opsional1@example.com"],
  "bcc": ["opsional2@example.com"],
  "subject": "Opsional, akan diisi default jika kosong",
  "body": "Opsional, akan diisi default jika kosong",
  "data": { "... mengikuti field wajib template ..." }
}
```
Field wajib di `data` sama seperti tabel “Field wajib per template” di bawah.  
Response 202:
```json
{
  "status": "queued",
  "message": "PDF digenerate dan email akan dikirim",
  "download_url": "...",
  "filename": "..."
}
```
Catatan: PDF dibuat dulu, lalu pengiriman email dijalankan melalui queue `SendEmailJob` menggunakan SMTP perusahaan (fallback `.env`).

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
- `ba-terminated`: `letterNo`, `region`, `terminateDate`, `mdsName`, `mdsCode`, `status`, `outlet`

**Penamaan file:**
- `payslip`: `YYYY-MM-<slipTitle>-<NIP>-<Nama>-<unik>.pdf`
- `ba-penempatan`: `ba-penempatan.<mdsName>.<outlet>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-request-id`: `ba-request-id.<mdsName>.<area>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-hold`: `ba-hold.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-rolling`: `ba-rolling.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
- `ba-hold-activate`: `ba-hold-activate.<mdsName>.<region>.<letterNo>.<unik>.pdf` (karakter `/` di `letterNo` diganti `-`)
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
- `POST /api/v1/bulk/ba-terminated`

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
- **BA Request ID**: `letterNo | area | mdsName | nik | birthDate | joinDate | status | stores | reason | location | letterDate | email (opsional)`
- **BA HOLD**: `letterNo | region | holdDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | email (opsional)`
- **BA Rolling**: `letterNo | region | rollingDate | mdsName | mdsCode | status | outletFrom | outletTo | reason | location | letterDate | email (opsional)`
- **BA HOLD Activate**: `letterNo | region | reactivateDate | mdsName | mdsCode | status | outlet | holdReason | location | letterDate | email (opsional)`
- **BA Terminated**: `letterNo | region | terminateDate | mdsName | mdsCode | status | outlet | reasons | location | letterDate | email (opsional)`

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

## 7) Bulk Kirim Email BA (Request ID, HOLD, Rolling, HOLD Activate, Terminated)
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

## 9) Template Ringkas (payload)
- **musik**: surat perjanjian lisensi musik (lihat contoh di README).
- **invoice**: invoice dengan tabel item, PPN default 11%.
- **payslip**: slip gaji; earnings/deductions array atau kolom terpisah di Excel.
- **insentif**: slip insentif; earnings khusus INSENTIF + custom.
- **thr**: slip THR; earnings “THR” + custom.
- **ba-penempatan**: berita acara penempatan MDS; header/footer otomatis, wilayah/outlet variabel.

---

## 10) Status & Error
- 202 queued (generate-pdf).
- 422 validation_failed (field wajib kosong).
- 401 unauthorized (JWT tidak ada / API key salah / email tidak terdaftar).
- 500 error (misconfig SMTP, gagal baca file, dsb).

---

## 11) Catatan untuk Frontend (React)
- Endpoint single generate memakai `x-api-key`; bulk & list memakai Bearer JWT.
- Untuk upload Excel gunakan `FormData` dengan field `file`.
- Saat dryRun, backend tidak enqueue job tapi mengembalikan payload per baris; gunakan ini untuk preview di UI.
- Download URL diberikan di webhook / list; bisa langsung di-`window.open` atau fetch sebagai blob.
