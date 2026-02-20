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

Ini membuat tabel `users`, `tokens`, dan `jobs` yang dibutuhkan queue.

### 4. Jalankan server (Terminal 1)

```bash
node server.js
```

### 5. Jalankan queue worker (Terminal 2)

```bash
node ace queue
```

Queue worker ini yang memproses job generate PDF di background.

---

## Cara Pakai API

### Endpoint

```
POST http://localhost:3334/api/v1/generate-pdf
Content-Type: application/json
```

### Struktur request

```json
{
  "template": "nama_template",
  "companyName": "Nama Perusahaan",
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

> `companyName` dan `email` bersifat opsional. Dipakai untuk mengorganisir file PDF yang tersimpan di `public/download/{companyName}/{email}/`. Jika tidak diisi, akan default ke `unknown`.

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
  "companyName": "Nama Perusahaan",
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
  "companyName": "Nama Perusahaan",
  "email": "user@email.com",
  "data": {
    "companyName":    "PT Nama Perusahaan",
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

> **Field wajib invoice:** `companyName`, `clientName`, `items`
> Sisanya opsional — jika tidak diisi akan pakai nilai default.

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
     invoice:       ['companyName', 'clientName', 'items'],
     namaTemplate:  ['field1', 'field2'],  // ← tambahkan di sini
   }
   ```

---

## Struktur Folder

```
app/
  Controllers/Http/PdfController.js   ← validasi & dispatch job + endpoint download
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
```

---

## Font

Font yang dipakai: **Roboto Condensed** (Regular, Bold, Italic, BoldItalic).
File `.ttf` ada di `app/Fonts/`. Untuk mengganti font, taruh file `.ttf` di folder tersebut dan edit konfigurasi di `app/Jobs/GeneratePdfJob.js`.
