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
- Role:
  - `user`: akses sesuai haknya.
  - `admin`: wajib punya `company_id`, akses hanya ke perusahaannya (user/company/PDF).
  - `superadmin`: tidak perlu `company_id`, bisa kelola semua user dan company, serta melihat semua PDF.
  - Superadmin yang ingin generate PDF lewat `/api/v1/generate-pdf` harus menyertakan `company_id` (`companyId`) di body.
  - Untuk endpoint bulk (`/api/v1/bulk/*`), user login wajib punya `company_id` pada akun.

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
  "password": "rahasia123",
  "role": "user"   // opsional, default user; boleh admin/superadmin
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
    "role": "user",
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
    "role": "user",
    "company": {
      "id": 1,
      "name": "Contoh Corp"
    }
  }
}
```

Jika perusahaan user tidak aktif, login akan ditolak (403) dengan pesan "Perusahaan tidak aktif". Jika user tidak aktif, ditolak dengan pesan "User tidak aktif".
Jika role = admin tetapi `company_id` kosong, login ditolak (403) dengan pesan "Admin tidak terhubung ke perusahaan".
Superadmin boleh login tanpa `company_id`, tetapi saat generate PDF wajib menyertakan `company_id` (lihat bawah).

### Ganti Password (JWT)

```
POST http://localhost:3334/api/v1/change-password
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

Body:

```json
{
  "oldPassword": "rahasia123",
  "newPassword": "rahasiaBaru456"
}
```

Validasi & aturan:
- `oldPassword` wajib, min 6, harus cocok dengan password saat ini.
- `newPassword` wajib, min 6.

Response (200):

```json
{ "status": "password_changed" }
```

### Buat User (Admin/Superadmin)

```
POST http://localhost:3334/api/v1/admin/users
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body:

```json
{
  "username": "userbaru",
  "email": "userbaru@example.com",
  "password": "sekret123",
  "role": "user",   // atau admin/superadmin
  "company_id": 1   // wajib untuk user/admin jika dibuat superadmin; admin otomatis pakai company-nya
}
```

Catatan:
- Admin hanya bisa membuat user/admin di perusahaannya dan tidak bisa membuat superadmin.
- Superadmin bisa membuat user/admin/superadmin; untuk user/admin wajib isi `company_id`.
- Validasi sama seperti register.

### List User (Admin/Superadmin)

```
GET http://localhost:3334/api/v1/admin/users?page=1&perPage=10
Authorization: Bearer <jwt_token_admin_or_superadmin>
```

Di-paginate (`perPage` maks 100) dan diurutkan `created_at` terbaru.  
Admin hanya melihat user dalam perusahaannya dan wajib punya `company_id` (jika tidak, respons 403). Superadmin melihat semua user.

### Ubah User (Admin/Superadmin)

```
PUT http://localhost:3334/api/v1/admin/users/:id
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body (opsional): `username`, `email`, `role` (`user|admin|superadmin`), `is_active` (boolean), `company_id` (hanya superadmin).  
Admin hanya bisa ubah user dalam perusahaan yang sama, tidak boleh set role `superadmin`, dan tidak boleh ubah `company_id`. Superadmin bebas.

### Nonaktifkan User (Admin/Superadmin)

```
POST http://localhost:3334/api/v1/admin/users/:id/deactivate
Authorization: Bearer <jwt_token_admin_or_superadmin>
```

Set `is_active=false`. Admin dibatasi user di perusahaan sendiri; superadmin semua user.

### Reset Password User (Admin/Superadmin)

```
POST http://localhost:3334/api/v1/admin/users/:id/password
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body: `{ "password": "minimal6karakter" }`  
Password di-hash otomatis melalui hook model User. Admin dibatasi user di perusahaan sendiri; superadmin semua user.

### Ambil API Key Company (JWT)

```
GET http://localhost:3334/api/v1/company/api-key
Authorization: Bearer <jwt_token>
```

Catatan:
- User/admin harus memiliki `company_id`.
- Superadmin tanpa `company_id` akan menerima respons 404.
- `allowed_templates` pada respons sudah berupa array.

Contoh respons:

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

### Contact Management (JWT)

Semua endpoint contact memakai `Authorization: Bearer <jwt_token>`.

Role scope:
- `user`: hanya contact miliknya sendiri.
- `admin`: semua contact user di company yang sama.
- `superadmin`: semua contact lintas company.

Endpoint:
- `POST /api/v1/contacts`
  - Body minimum: `{ "email": "target@example.com" }`
  - Opsional: `name`, `phone`, `notes`, `user_id`
- `GET /api/v1/contacts?page=1&perPage=10&q=target`
  - Query filter opsional: `user_id` (admin/super sesuai scope), `company_id` (khusus superadmin)
- `GET /api/v1/contacts/:id`
- `PUT /api/v1/contacts/:id`
  - Field update: `email`, `name`, `phone`, `notes`
- `DELETE /api/v1/contacts/:id`

Catatan:
- Email selalu dinormalisasi ke lowercase + trim.
- Unik per user berdasarkan `(user_id, email)`.
- Pengiriman email (bulk/single), termasuk gagal kirim, otomatis upsert ke tabel `contacts` untuk semua penerima `to/cc/bcc` dan menaikkan `send_count`.

### Histori Signature URL BA (JWT)

Histori URL tanda tangan BA disimpan otomatis saat:
- `POST /api/v1/generate-pdf` (single BA)
- `POST /api/v1/send/ba-*` (single send BA)

Aturan:
- Hanya URL `http/https` yang dicatat.
- Nama/jabatan signer disimpan dari `signerLeftName`/`signerLeftTitle` dan `signerRightName`/`signerRightTitle`.
- URL disimpan unik per company berdasarkan `(company_id, url_normalized)`.
- URL yang dipakai ulang akan menambah `use_count` dan memperbarui `last_used_at`.

Endpoint list:
- `GET /api/v1/signature-urls?page=1&perPage=10&q=signature&sort=last_used_at`
- Query:
  - `q` (search URL)
  - `sort=last_used_at|created_at`
  - `company_id` (hanya superadmin)
- Role scope:
  - `user/admin`: otomatis hanya company sendiri
  - `superadmin`: bisa lintas company (opsional filter `company_id`)

Endpoint CRUD:
- `GET /api/v1/signature-urls/:id`
- `POST /api/v1/signature-urls`
  - Body: `url` (wajib), opsional `name`, `title`
  - `company_id` hanya boleh diisi oleh `superadmin`
- `PUT /api/v1/signature-urls/:id`
  - Body updatable: `url`, `name`, `title`
  - `company_id` hanya boleh diisi oleh `superadmin`
- `DELETE /api/v1/signature-urls/:id`

Aturan tambahan:
- `user/admin` hanya bisa CRUD data di company sendiri.
- `show/update/delete` data di luar scope mengembalikan `404`.
- `url` harus valid `http/https`.
- Duplikasi URL per company (`company_id + url_normalized`) mengembalikan `409`.
- Field sistem tidak boleh diisi manual: `url_normalized`, `use_count`, `last_used_at`, `created_by`, `created_at`, `updated_at`.

### Preview PDF (JWT, tanpa mengubah nomor final BA)

- Endpoint utama: `POST /api/v1/preview/:template`
- Endpoint kompatibilitas lama BA: `POST /api/v1/preview/ba/:template`
  - Role: `user`, `admin`, `superadmin`
  - Template didukung: semua template single yang tersedia (termasuk `payslip`, `insentif`, `thr`, semua `ba-*`, dan template dinamis aktif)
  - Body minimum mengikuti field wajib tiap template (contoh `ba-penempatan`: `mdsName`, `placementDate`, `outlet`; contoh `payslip`: `employeeName`, `position`, `period`)
  - Khusus `superadmin` tanpa `company_id` di akun, kirim `company_id` atau `companyId` di body
- Response sukses:
  - `status: "ok"`
  - `message: "Preview generated"`
  - `data.preview_url`
  - `data.expires_at` (TTL 24 jam)
- Untuk template BA (`ba-*`), nomor surat preview menggunakan format sementara `PREVIEW/{CompanyCode}/{templateCode}/{romanMonth}/{Year}` dan **tidak** mengubah counter `LetterNo` final.
- Akses file preview:
  - `GET /api/v1/preview/file/:id` (JWT)
  - Alias kompatibilitas lama: `GET /api/v1/preview/ba/file/:id`
  - PDF yang expired mengembalikan `410`.
- Cleanup otomatis:
  - Scheduler `start/previewCleanup.js` berjalan default tiap 5 menit (config `PREVIEW_CLEANUP_INTERVAL_MINUTES`).
  - File preview expired dihapus dan metadata ditandai `status=expired`.

### List Company (Admin/Superadmin)

```
GET http://localhost:3334/api/v1/admin/companies?page=1&perPage=10
Authorization: Bearer <jwt_token_admin_or_superadmin>
```

Pagination (`perPage` maks 100) dan diurutkan `created_at` terbaru.  
Admin dengan `company_id` hanya melihat company-nya sendiri; superadmin melihat semua company. Jika admin tanpa `company_id` lolos autentikasi, query tidak difilter (melihat semua company).

### Buat Company (Admin/Superadmin)

```
POST http://localhost:3334/api/v1/admin/companies
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body wajib: `name`, `api_key` (unik). Opsional: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_secure` (bool), `mail_from`, `is_active` (default true).
Catatan: superadmin boleh membuat company. Admin hanya boleh membuat company jika `company_id` kosong; jika sudah terhubung company akan ditolak 403.

### Edit Company (Admin/Superadmin)

```
PUT http://localhost:3334/api/v1/admin/companies/:id
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body opsional: `name`, `api_key`, SMTP fields, `is_active` (boolean).
Admin dengan `company_id` hanya boleh mengedit company miliknya; superadmin bebas.

### Aktivasi/Nonaktifkan Company (Admin/Superadmin)

```
POST http://localhost:3334/api/v1/admin/companies/:id/activate
POST http://localhost:3334/api/v1/admin/companies/:id/deactivate
Authorization: Bearer <jwt_token_admin_or_superadmin>
```

Jika company nonaktif, semua user perusahaan tersebut tidak bisa login maupun melewati `companyAuth`.
Admin dengan `company_id` hanya boleh mengubah status company miliknya; superadmin bebas.

### Kelola Template Dinamis (Admin/Superadmin)

```
GET http://localhost:3334/api/v1/admin/dynamic-templates?page=1&perPage=10
Authorization: Bearer <jwt_token_admin_or_superadmin>
```

Query opsional:
- `includeInactive=true`
- `company_id=<id>` (khusus superadmin)
- `company_id=null` (khusus superadmin, hanya template global)

```
POST http://localhost:3334/api/v1/admin/dynamic-templates
Authorization: Bearer <jwt_token_admin_or_superadmin>
Content-Type: application/json
```

Body contoh:

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

Endpoint tambahan:
- `PUT /api/v1/admin/dynamic-templates/:id`
- `POST /api/v1/admin/dynamic-templates/:id/activate`
- `POST /api/v1/admin/dynamic-templates/:id/deactivate`

Catatan:
- Admin membuat template dinamis untuk company-nya sendiri.
- Superadmin bisa membuat template global (`company_id` null) atau untuk company tertentu.
- Runtime bersifat hybrid: template dinamis (DB) diprioritaskan, template file JS lama tetap fallback.

### Endpoint

```
POST http://localhost:3334/api/v1/generate-pdf
Content-Type: application/json
Header: x-api-key: YOUR_COMPANY_API_KEY
```

Catatan:
- Superadmin harus menyertakan `company_id`/`companyId` di body agar melewati `companyAuth`.
- Jika kolom `allowed_templates` pada company tidak kosong, template di luar daftar akan ditolak 403.

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

### `ba-penempatan` — Berita Acara Penempatan MDS (Outlet)

```json
{
  "template": "ba-penempatan",
  "email": "user@email.com",
  "data": {
    "letterNo": "075/OMI-TM/BAK/III/2026",
    "region": "SMS",                     // opsional, default "SMS"
    "mdsName": "SANTI",
    "nik": "1505046404980001",
    "birthDate": "1998-04-24",
    "placementDate": "2026-04-01",
    "status": "STAY",
    "category": "BIR",
    "outlet": "GLOBAL CAFE",
    "reason": "Alasan penempatan / catatan",
    "location": "Jakarta",               // opsional, default "Jakarta"
    "letterDate": "2026-03-30",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-penempatan`:** `mdsName`, `placementDate`, `outlet` (validasi di API). `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-penempatan.[namaMDS].[outlet].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-request-id` — Berita Acara Request ID MDS

```json
{
  "template": "ba-request-id",
  "email": "user@email.com",
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
    "location": "Jakarta",
    "letterDate": "2026-04-07",
    "signerLeftName": "Adi Anto",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Rizqi Arumdhita",
    "signerRightTitle": "Project Manager Tema Agency"
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-request-id`:** `area`, `mdsName`, `nik`, `joinDate`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-request-id.[namaMDS].[area].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-hold` — Berita Acara MDS HOLD

```json
{
  "template": "ba-hold",
  "email": "user@email.com",
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
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-hold`:** `region`, `holdDate`, `mdsName`, `mdsCode`, `status`, `outlet`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-hold.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-rolling` — Berita Acara Rolling MDS

```json
{
  "template": "ba-rolling",
  "email": "user@email.com",
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
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-rolling`:** `region`, `rollingDate`, `mdsName`, `mdsCode`, `status`, `outletFrom`, `outletTo`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-rolling.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-hold-activate` — Berita Acara MDS HOLD Diaktifkan Kembali

```json
{
  "template": "ba-hold-activate",
  "email": "user@email.com",
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
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-hold-activate`:** `region`, `reactivateDate`, `mdsName`, `mdsCode`, `status`, `outlet`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-hold-activate.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-takeout` — Berita Acara Toko Takeout MDS

```json
{
  "template": "ba-takeout",
  "email": "user@email.com",
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
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-takeout`:** `region`, `takeoutDate`, `mdsName`, `mdsCode`, `status`, `outlet`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-takeout.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.


### `ba-terminated` ? Berita Acara Terminasi MDS

```json
{
  "template": "ba-terminated",
  "email": "user@email.com",
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
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-terminated`:** `region`, `terminateDate`, `mdsName`, `mdsCode`, `status`, `outlet`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-terminated.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.

### `ba-cancel-join` - Berita Acara Batal Join MDS

```json
{
  "template": "ba-cancel-join",
  "email": "user@email.com",
  "data": {
    "letterNo": "001/POMI/BABJ/IV/2026",
    "region": "SMS",
    "cancelJoinDate": "2026-04-17",
    "mdsName": "VINALIA",
    "mdsCode": "MDSHSMS114",
    "status": "MOBILE",
    "outlet": "CAFE SAYANGAN DAN ANA BEERHOUSE",
    "reason": "TIDAK DAPAT MENGIKUTI INSTRUKSI TL DAN KETENTUAN KERJA MDS",
    "letterDate": "2026-04-17",
    "location": "Jakarta",
    "signerLeftName": "Adi Anto Gustuti",
    "signerLeftTitle": "Team Leader TEMA Agency",
    "signerRightName": "Nuryah",
    "signerRightTitle": "PIC TEMA Agency"
  },
  "callback": {
    "url": "https://webhook.site/xxx"
  }
}
```

> **Field wajib `ba-cancel-join`:** `region`, `cancelJoinDate`, `mdsName`, `mdsCode`, `status`, `outlet`. `data.letterNo` selalu di-generate otomatis (override nilai request). Nama file output: `ba-cancel-join.[namaMDS].[region].[letterNo].[unique].pdf` (karakter `/` pada `letterNo` diganti `-`). Header/footer otomatis memakai `resources/images/header_omi.png` dan `resources/images/footer_omi.png`.


---

### List Generated PDF (butuh login JWT)

```
GET http://localhost:3334/api/v1/generated-pdfs?page=1&perPage=10
Header: Authorization: Bearer <jwt_token>
```

- Harus login (`/api/v1/login`) untuk mendapatkan JWT.
- User biasa: hanya melihat PDF miliknya.
- Admin: melihat semua PDF dalam perusahaannya.
- Admin tanpa `company_id`: tidak melihat data apa pun.
- Superadmin: melihat semua PDF.
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
    'ba-penempatan': ['mdsName', 'placementDate', 'outlet'],
    'ba-request-id': ['area', 'mdsName', 'nik', 'joinDate'],
    'ba-takeout': ['region', 'takeoutDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    'ba-cancel-join': ['region', 'cancelJoinDate', 'mdsName', 'mdsCode', 'status', 'outlet'],
    namaTemplate:  ['field1', 'field2'],  // ← tambahkan di sini
  }
  ```

---

## Struktur Folder

```
app/
  Controllers/Http/PdfController.js   ? validasi & dispatch job + endpoint download
  Controllers/Http/AuthController.js  ? endpoint register user
  Jobs/GeneratePdfJob.js              ? proses generate PDF, simpan ke disk, kirim webhook
  Templates/                          ? logika template (isi PDF)
    musik.js
    invoice.js
    payslip.js
    thr.js
    ba-penempatan.js
    ba-request-id.js
    ba-hold.js
    ba-rolling.js
    ba-hold-activate.js
    ba-takeout.js
    ba-terminated.js
    ba-cancel-join.js
  Services/
    JobService.js                     ? helper dispatch queue
    WebhookSender.js                  ? kirim hasil ke callback URL (dengan retry)
  Fonts/                              ? custom font (.ttf)

resources/pdf-templates/              ? re-export template (dipakai job)
  musik.js
  invoice.js
  payslip.js
  thr.js
  ba-penempatan.js
  ba-request-id.js
  ba-hold.js
  ba-rolling.js
  ba-hold-activate.js
  ba-takeout.js
  ba-terminated.js
  ba-cancel-join.js

public/
  download/                           ? folder penyimpanan PDF yang sudah digenerate
    {companyName}/
      {email}/
        {periode}.{template}.{employeeId}.{nama}.{unique}.pdf

start/
  routes.js                           ? definisi route API & download endpoint
  kernel.js                           ? registrasi middleware `companyAuth`
  queueWorker.js                      ? auto-start queue worker saat server jalan

database/migrations/
  ...company.js                       ? tabel perusahaan (company_id, name, api_key)
  ...add_company_to_users.js          ? kolom company_id di users
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

## Bulk API (Upload XLSX -> Queue PDF)

Autentikasi: login dulu (`/api/v1/login`) lalu kirim header `Authorization: Bearer <token>`. Tidak perlu `x-api-key` di endpoint ini. Semua endpoint menerima `multipart/form-data` dengan field `file` berisi XLS/XLSX. Opsi umum: `sheet` (nama sheet, default sheet pertama), `dryRun` (true/false, hanya validasi), `callback_url`, `callback_header` (JSON), `slip_title`, `company/company_name`, `note` (khusus THR).  
Catatan: kolom `email` opsional; jika kosong, sistem memakai email akun yang login sebagai penerima.

### Endpoint
- `POST /api/v1/bulk/payslip`  
  - Minimal kolom: `employeeName`, `position`, `period/periode`. Kolom `email` boleh ditambahkan jika penerima berbeda dari akun login.  
  - Earnings otomatis jika ada: `Gaji Pokok`, `Tunjangan makan`, `Tunjangan Transport`, `Tunjangan Komunikasi`, `Tunjangan Jabatan`, atau kolom bebas `earnings`.  
  - Deductions: `BPJS Ketenagakerjaan`, `PPH 21`/`PPH21`, atau kolom bebas `deductions`.  
  - Format Excel contoh tersedia di `resources/templates/*.xlsx` (buat/refresh via `node scripts/create-bulk-template.js --all`). Header kolom:  
    `employeeID | employeeName | position | departement | ptkp | periode | joinDate | targetHK | attendance | Gaji Pokok | Tunjangan makan | Tunjangan Transport | Tunjangan Komunikasi | Tunjangan Jabatan | BPJS Ketenagakerjaan | PPH 21 | email (opsional)`

- `POST /api/v1/bulk/insentif`  
  - Minimal: `employeeName`, `position`, `period/periode`. Kolom `email` opsional jika penerima bukan akun login.  
  - Earnings otomatis: `INSENTIF SAMPLING`, `INSENTIF SELLOUT` (dua ejaan), `INSENTIF KERAJINAN`, `INSENTIF TL`, plus `earnings` bebas.  
  - Deductions: `PPH21`/`PPH 21`, atau `deductions` bebas.  
  - `slip_title` default: "Payslip Insentif".
  - Contoh header Excel yang disarankan:  
    `employeeId | employeeName | position | departement | periode | joinDate | ptkp | targetHK | attendance | INSENTIF SAMPLING | INSENTIF SELLOUT | INSENTIF KERAJINAN | INSENTIF TL | earnings | deductions | note | callback_url | callback_header | email (opsional)`

- `POST /api/v1/bulk/thr`  
  - Minimal: `employeeName`, `position`, `period/periode`. Kolom `email` opsional jika penerima bukan akun login.  
  - Earnings: kolom `THR` otomatis jadi earning "THR", plus `earnings` bebas.  
  - Deductions: `deductions` bebas.  
  - `slip_title` default: "Payslip THR"; `note` default: "Biaya Admin jika Beda Bank ( TEMA BCA )".
  - Contoh header Excel yang disarankan:  
    `employeeId | employeeName | position | departement | periode | joinDate | ptkp | targetHK | attendance | THR | earnings | deductions | note | callback_url | callback_header | email (opsional)`

- `POST /api/v1/bulk/ba-penempatan`  
  - Minimal: `mdsName`, `placementDate`, `outlet`. Kolom `email` opsional jika penerima berbeda dari akun login.  
  - Kolom opsional: `region/wilayah`, `nik`, `birthDate/tanggal lahir`, `status`, `category/kategori`, `reason/alasan`, `location/lokasi`, `letterDate/tanggal surat`, `signerLeftName/Title`, `signerRightName/Title`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Contoh header Excel yang disarankan:  
    `mdsName | nik | birthDate | placementDate | status | category | outlet | region | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-request-id`  
  - Minimal: `area`, `mdsName`, `nik`, `joinDate`.  
  - Kolom lain: `area/wilayah/region`, `birthDate`, `status`, `stores/toko`, `reason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `area | mdsName | nik | birthDate | joinDate | status | stores | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-hold`  
  - Minimal: `region`, `holdDate`, `mdsName`, `mdsCode`, `status`, `outlet`.  
  - Tambahan: `reason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | holdDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-rolling`  
  - Minimal: `region`, `rollingDate`, `mdsName`, `mdsCode`, `status`, `outletFrom`, `outletTo`.  
  - Tambahan: `reason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | rollingDate | mdsName | mdsCode | status | outletFrom | outletTo | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-hold-activate`  
  - Minimal: `region`, `reactivateDate`, `mdsName`, `mdsCode`, `status`, `outlet`.  
  - Tambahan: `holdReason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | reactivateDate | mdsName | mdsCode | status | outlet | holdReason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-takeout`  
  - Minimal: `region`, `takeoutDate`, `mdsName`, `mdsCode`, `status`, `outlet`.  
  - Tambahan: `reason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | takeoutDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-terminated`  
  - Minimal: `region`, `terminateDate`, `mdsName`, `mdsCode`, `status`, `outlet`.  
  - Tambahan: `reasons` (bisa multi baris/koma), `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | terminateDate | mdsName | mdsCode | status | outlet | reasons | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`
- `POST /api/v1/bulk/ba-cancel-join`  
  - Minimal: `region`, `cancelJoinDate`, `mdsName`, `mdsCode`, `status`, `outlet`.  
  - Tambahan: `reason`, `location`, `letterDate`, `signerLeft*`, `signerRight*`, `signatureLeftUrl`, `signatureRightUrl`, `callback_url`, `callback_header`, `data_json`.  
  - Header contoh: `region | cancelJoinDate | mdsName | mdsCode | status | outlet | reason | location | letterDate | signerLeftName | signerLeftTitle | signerRightName | signerRightTitle | signatureLeftUrl | signatureRightUrl | email (opsional) | callback_url | callback_header`

Catatan khusus BA:
- `letterNo` selalu di-generate otomatis sistem (format default: `{seq}/{CompanyCode}/{templateCode}/{romanMonth}/{Year}`, timezone server `Asia/Jakarta`).
- Jika request bulk BA bukan `dryRun`, response akan mengembalikan `batch_id` untuk referensi kirim email bulk BA.

Kolom opsional umum (semua mode): `employeeId`, `department/departement/departemen`, `joinDate`, `ptkp`, `targetHK`, `attendance`, `note`, `data_json` (JSON string untuk override/tambah field data), `callback_url`, `callback_header`.

### Contoh cURL
```bash
curl -X POST http://localhost:3334/api/v1/bulk/payslip \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@payroll.xlsx" \
  -F "sheet=Sheet1" \
  -F "dryRun=true"
```

### Respons
`200 OK` dengan ringkasan: `status`, `mode`, `total`, `queued`, `failed`, `dryRun`, `sheet`, dan `results[]` per baris (`queued`, `failed`, atau `dry-run` dengan pesan error jika ada). Untuk mode BA non-`dryRun`, response juga mengandung `batch_id`. Job sukses masuk queue `GeneratePdfJob` dan webhook dikirim bila callback tersedia.

---

## Bulk Kirim Email Slip

Endpoint: `POST /api/v1/send-slip-emails` (auth: JWT).  
Form-data:
- `file` (wajib): XLS/XLSX dengan kolom (case-insensitive): `sentTo`, `employeeId`, `employeeName`, `slipTitle`, `template` (opsional: `payslip`/`insentif`/`thr`), `body`, `cc`, `bcc`.
- `periode` (opsional): contoh `2026-03`; filter segmen periode pada nama file.

Perilaku:
- Lampiran dicari hanya di `public/download/{companyName}/{email_login}/` (folder disanitasi sesuai email user yang login).
- Format file lampiran yang diprioritaskan: `[periode].[template].[employeeId].[nama].[kodeUnique].pdf`.
- Jika ada lebih dari satu kandidat lampiran yang cocok (beda `kodeUnique`), sistem memilih file terbaru.
- Satu lampiran dikirim per baris email.
- Log tercatat di `logs/bulk-email.log`.
- SMTP: jika semua field SMTP di tabel `companies` terisi (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, opsional `smtp_secure`, `mail_from`) maka dipakai; jika tidak lengkap, fallback ke `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`).

## Bulk Kirim Email BA Penempatan

Endpoint: `POST /api/v1/send-ba-penempatan-emails` (auth: JWT).  
Form-data:
- `batch_id` (wajib): id batch dari endpoint `POST /api/v1/bulk/ba-penempatan`.
- `file` (wajib): XLS/XLSX dengan kolom (case-insensitive): `sentTo`, `mdsName`, `outlet`, `subject` (opsional), `body` (opsional), `cc`, `bcc`.

Perilaku:
- Lampiran dicari dari metadata batch (`generation_batch_items`) dengan kunci `batch_id + template + match_key`.
- Jika kandidat attachment lebih dari satu, sistem memilih file terbaru.
- Satu lampiran per email.
- Log tercatat di `logs/bulk-email.log`.

## Bulk Kirim Email BA Lain
Endpoint (auth: JWT, form-data `batch_id` + `file` xls/xlsx; kolom minimal `sentTo`, plus field wajib per template; `subject`/`body`/`cc`/`bcc` opsional). Lookup lampiran memakai metadata batch (`batch_id + template + match_key`).

- `POST /api/v1/send-ba-request-id-emails` — wajib: `mdsName`, `area/region/wilayah`
- `POST /api/v1/send-ba-hold-emails` — wajib: `mdsName`, `region/wilayah`
- `POST /api/v1/send-ba-rolling-emails` — wajib: `mdsName`, `region/wilayah`
- `POST /api/v1/send-ba-hold-activate-emails` — wajib: `mdsName`, `region/wilayah`
- `POST /api/v1/send-ba-takeout-emails` — wajib: `mdsName`, `region/wilayah`
- `POST /api/v1/send-ba-terminated-emails` — wajib: `mdsName`, `region/wilayah`
- `POST /api/v1/send-ba-cancel-join-emails` — wajib: `mdsName`, `region/wilayah`

## History Batch BA
- `GET /api/v1/batches?template=<ba-template>&page=1&perPage=10`
- `GET /api/v1/batches/:batch_id?page=1&perPage=20`

Scope akses:
- `user`/`admin`: hanya batch company sendiri
- `superadmin`: bisa lintas company

---

## Font

Font yang dipakai: **Roboto Condensed** (Regular, Bold, Italic, BoldItalic).
File `.ttf` ada di `app/Fonts/`. Untuk mengganti font, taruh file `.ttf` di folder tersebut dan edit konfigurasi di `app/Jobs/GeneratePdfJob.js`.
