# PDF Queue Generator

Service untuk generate PDF secara asinkron berbasis queue. Kirim request → PDF dibuat di background → hasil dikirim ke webhook URL kamu.

**Stack:** AdonisJS 4.1 · MySQL · pdfmake 0.2 · Database Queue

---

## Prasyarat

- Node.js 16+
- MySQL (database `adonis` atau sesuaikan di `.env`)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Buat file `.env`

```env
NODE_ENV=development
APP_KEY=your-random-secret
HOST=0.0.0.0
PORT=3334

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=adonis

QUEUE_DRIVER=database
```

### 3. Jalankan migrasi database

```bash
node ace migration:run
```

Ini membuat tabel `users`, `tokens`, `jobs`, `companies`, dan kolom `company_id` + `api_key`.

### 4. Jalankan server (worker ikut otomatis)

```bash
node server.js
```

Worker queue otomatis di-spawn (`node ace queue --listen`) saat server start.
Set `QUEUE_AUTOSTART=false` atau `NODE_ENV=test` jika ingin mematikannya.

---

## Cara Pakai API

Setiap request harus melewati middleware `companyAuth`:

- Header `x-api-key` wajib; harus cocok dengan kolom `api_key` di tabel `companies`.
- Body `email` wajib; harus terdaftar di tabel `users`.
- `companyName` tidak perlu dikirim; otomatis diambil dari `companies.name` sesuai API key.

### Register User

```
POST http://localhost:3334/api/v1/register
Content-Type: application/json
Header: x-api-key: YOUR_COMPANY_API_KEY
```

Body:

```json
{
  "username": "demo",
  "email": "user@example.com",
  "password": "rahasia123"
}
```

Aturan:
- `username` unik
- `email` valid & unik
- `password` min 6 karakter
- User otomatis dikaitkan ke perusahaan berdasarkan API key

Response (201):

```json
{
  "status": "registered",
  "user": {
    "id": 1,
    "username": "demo",
    "email": "user@example.com",
    "company": {
      "id": 1,
      "name": "Contoh Corp"
    }
  }
}
```

### Login

```
POST http://localhost:3334/api/v1/login
Content-Type: application/json
```

Body:

```json
{
  "email": "user@example.com",
  "password": "rahasia123"
}
```

Validasi:
- `email` wajib & format email
- `password` min 6
- User harus terdaftar (email unik)

Response (200):

```json
{
  "status": "logged_in",
  "token": { "type": "bearer", "token": "<jwt_token>", "refreshToken": null },
  "user": {
    "id": 1,
    "username": "demo",
    "email": "user@example.com",
    "company": {
      "id": 1,
      "name": "Contoh Corp"
    }
  }
}
```

### Endpoint

```
POST http://localhost:3334/api/v1/generate-pdf
Content-Type: application/json
Header: x-api-key: YOUR_COMPANY_API_KEY
```

### Struktur request

```json
{
  "template": "nama_template",
  "email": "user@email.com",
  "data": {
    "...field sesuai template..."
  },
  "callback": {
    "url": "https://webhook-kamu.com/endpoint",
    "header": {
      "x-api-key": "opsional-auth-key"
    }
  }
}
```

- `email` wajib; harus ada di tabel `users`.
- `companyName` tidak perlu dikirim; otomatis diisi dari perusahaan (API key) dan dipakai untuk folder `public/download/{companyName}/{email}/`.

### Response sukses (202)

```json
{
  "status": "queued",
  "message": "PDF generation is being processed"
}
```

Setelah PDF selesai dibuat, hasil dikirim via POST ke `callback.url`:

```json
{
  "success": true,
  "download_url": "http://localhost:3334/download/Nama_Perusahaan/user%40email.com/musik_abc123XYZ.pdf",
  "filename": "musik_abc123XYZ.pdf",
  "saved_at": "public/download/Nama_Perusahaan/user@email.com/musik_abc123XYZ.pdf"
}
```

> PDF **tidak lagi dikirim sebagai base64**. Sebagai gantinya, file disimpan di server dan webhook dikirim berisi `download_url` untuk mengambil file tersebut.

---

## Download PDF

File PDF yang sudah digenerate bisa diunduh langsung via:

```
GET http://localhost:3334/download/:company/:email/:filename
```

Contoh:

```
GET http://localhost:3334/download/Nama_Perusahaan/user%40email.com/musik_abc123XYZ.pdf
```

Response: file PDF (`Content-Type: application/pdf`) siap diunduh.

---

## Template yang Tersedia

### `musik` — Perjanjian Lisensi Musik

```json
{
  "template": "musik",
  "email": "user@email.com",
  "data": {
    "nama":      "Nama artis",
    "judul":     "Judul lagu",
    "nik":       "3271234567890000",
    "address":   "Alamat artis",
    "pt":        "Nama PT label",
    "pencipta":  "Nama pencipta lagu",
    "asNama":    "Nama asosiasi / distributor",
    "bankName":  "Nama bank",
    "npwp":      "01234567890123",
    "imail":     "email@artis.com",
    "phone":     "+6281234567890",
    "norek":     "1234567890"
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

### `invoice` — Invoice / Tagihan

```json
{
  "template": "invoice",
  "email": "user@email.com",
  "data": {
    "companyAddress": "Jl. Alamat No. 1, Kota",
    "companyPhone":   "+6221-555-0100",
    "companyEmail":   "info@perusahaan.com",
    "clientName":     "Nama Klien",
    "clientAddress":  "Alamat Klien",
    "clientEmail":    "klien@email.com",
    "invoiceNo":      "INV/2602/0001",
    "dueDate":        "2026-03-05T00:00:00.000Z",
    "items": [
      { "description": "Jasa Pembuatan Website", "qty": 1, "price": 5000000 },
      { "description": "Hosting 1 Tahun",        "qty": 1, "price": 1200000 }
    ],
    "tax":         11,
    "bankName":    "BCA",
    "accountNo":   "1234567890",
    "accountName": "PT Nama Perusahaan",
    "notes":       "Harap konfirmasi setelah transfer."
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib invoice:** `clientName`, `items`
> `companyName` diisi otomatis dari API key; lainnya opsional — jika tidak diisi akan pakai nilai default.

---

### List Generated PDF (butuh login JWT)

```
GET http://localhost:3334/api/v1/generated-pdfs?page=1&perPage=10
Header: Authorization: Bearer <jwt_token>
```

- Harus login (`/api/v1/login`) untuk mendapatkan JWT.
- Data yang ditampilkan hanya milik user yang sedang login.
- Diurutkan `created_at` terbaru.
- `perPage` dibatasi maks 100; default 10.

Response contoh:

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
      "user_id": 1,
      "company_id": 1,
      "template": "invoice",
      "filename": "invoice_abcd1.pdf",
      "download_url": "http://localhost:3334/download/Contoh_Corp/user%40example.com/invoice_abcd1.pdf",
      "saved_path": "public/download/Contoh_Corp/user@example.com/invoice_abcd1.pdf",
      "email": "user@example.com",
      "company_name": "Contoh Corp",
      "data": { "...": "..." },
      "callback_status": 200,
      "callback_response": "{\"success\":true}",
      "callback_error": null,
      "created_at": "2026-03-06T10:50:00.000Z",
      "updated_at": "2026-03-06T10:50:05.000Z"
    }
  ]
}
```

---

## Menambah Template Baru

1. **Buat logika template** di `app/Templates/namaTemplate.js`

   ```js
   'use strict'
   module.exports = function namaTemplate(payloadData) {
     const { field1, field2 } = payloadData
     return {
       defaultStyle: { font: 'Roboto' },
       content: [ /* pdfmake content */ ],
       styles: {}
     }
   }
   ```

2. **Buat re-export** di `resources/pdf-templates/namaTemplate.js`

   ```js
   'use strict'
   module.exports = require('../../app/Templates/namaTemplate')
   ```

3. **Daftarkan validasi** di `app/Controllers/Http/PdfController.js`

   ```js
   const templateRequiredFields = {
     musik:         ['nama', 'judul', ...],
     invoice:       ['clientName', 'items'],
     namaTemplate:  ['field1', 'field2'],  // ← tambahkan di sini
   }
   ```

---

## Struktur Folder

```
app/
  Controllers/Http/PdfController.js   ← validasi & dispatch job + endpoint download
  Controllers/Http/AuthController.js  ← endpoint register user
  Jobs/GeneratePdfJob.js              ← proses generate PDF, simpan ke disk, kirim webhook
  Templates/                          ← logika template (isi PDF)
    musik.js
    invoice.js
  Services/
    JobService.js                     ← helper dispatch queue
    WebhookSender.js                  ← kirim hasil ke callback URL (dengan retry)
  Fonts/                              ← custom font (.ttf)

resources/pdf-templates/              ← re-export template (dipakai job)
  musik.js
  invoice.js

public/
  download/                           ← folder penyimpanan PDF yang sudah digenerate
    {companyName}/
      {email}/
        {template}_{uniqueId}.pdf

start/
  routes.js                           ← definisi route API & download endpoint
  kernel.js                           ← registrasi middleware `companyAuth`
  queueWorker.js                      ← auto-start queue worker saat server jalan

database/migrations/
  ...company.js                       ← tabel perusahaan (company_id, name, api_key)
  ...add_company_to_users.js          ← kolom company_id di users
```

---

## Menyiapkan data awal

```sql
-- Buat perusahaan + API key
INSERT INTO companies (name, api_key, created_at, updated_at)
VALUES ('Contoh Corp', 'YOUR_COMPANY_API_KEY', NOW(), NOW());

-- Buat user yang valid untuk email request
INSERT INTO users (username, email, password, created_at, updated_at)
VALUES ('demo', 'user@example.com', '$2a$10$hash_password', NOW(), NOW());
```

`api_key` dari tabel `companies` dipakai di header `a-api-key` ketika memanggil API.

---

## Font

Font yang dipakai: **Roboto Condensed** (Regular, Bold, Italic, BoldItalic).
File `.ttf` ada di `app/Fonts/`. Untuk mengganti font, taruh file `.ttf` di folder tersebut dan edit konfigurasi di `app/Jobs/GeneratePdfJob.js`.
