# Issue: Download Semua File PDF dalam Batch sebagai ZIP

## Ringkasan

Tambahkan fitur download semua file PDF dalam satu batch dari halaman frontend `/batches`.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Target utama:

- Pada frontend halaman `/batches`, tambahkan tombol **Download** setelah tombol **Detail** di daftar batch.
- Tombol **Download** mengunduh seluruh file PDF dalam batch tersebut sebagai satu file `.zip`.
- Proses kompresi ZIP dilakukan di backend.

## Latar Belakang

Saat ini halaman `/batches` sudah bisa menampilkan daftar batch dan detail item per batch. Pada detail item, masing-masing PDF dapat didownload satu per satu lewat `download_url`.

Kebutuhan baru: user perlu mengunduh seluruh file hasil bulk generate dalam satu batch tanpa membuka detail dan download file satu per satu.

## Scope

### Backend

1. Tambahkan endpoint download ZIP untuk batch.
2. Endpoint harus mengambil semua file PDF yang terkait dengan `batch_id`.
3. Backend melakukan kompresi file menjadi ZIP.
4. Endpoint mengirim response sebagai file attachment `.zip`.
5. Endpoint harus tetap mengikuti authorization/scope batch:
   - `user` dan `admin` hanya boleh download batch milik company sendiri.
   - `superadmin` boleh download batch semua company.
6. File yang dimasukkan ke ZIP hanya file yang benar-benar ada di server.
7. Item batch yang gagal atau belum punya file tidak perlu dimasukkan ke ZIP.
8. Jika tidak ada file yang bisa dizip, response harus error yang jelas.

### Frontend

1. Pada halaman `/batches`, tambahkan tombol **Download** setelah tombol **Detail**.
2. Tombol memanggil endpoint download ZIP backend.
3. Browser mengunduh file ZIP dengan nama yang jelas.
4. Tampilkan loading state saat download sedang diproses.
5. Tampilkan error toast jika backend gagal membuat ZIP.

## Detail Rencana Perubahan Backend

### 1. Tambah dependency ZIP

File:

```text
package.json
package-lock.json
```

Saat ini backend belum terlihat memiliki dependency untuk membuat ZIP. Rekomendasi gunakan package `archiver` karena umum dipakai untuk streaming ZIP di Node.js.

Contoh dependency:

```bash
npm install archiver
```

Catatan:

- Jika implementer memilih package lain, pastikan bisa stream ZIP tanpa harus menyimpan file besar di memory.
- Jangan membuat ZIP dengan membaca semua file PDF sekaligus ke memory.

### 2. Tambah route download batch ZIP

File:

```text
start/routes.js
```

Tambahkan route baru di grup `/api/v1` yang sudah memakai JWT:

```js
Route.get('/batches/:batch_id/download', 'BatchController.downloadZip').middleware(['auth:jwt'])
```

Endpoint final:

```text
GET /api/v1/batches/:batch_id/download
```

### 3. Tambah method `downloadZip` di `BatchController`

File:

```text
app/Controllers/Http/BatchController.js
```

Tambahkan method baru:

```js
async downloadZip({ params, response, auth }) {
  // validate batch_id
  // validate role and company scope
  // query batch
  // query successful batch items with file path
  // stream zip response
}
```

Logic yang disarankan:

1. Ambil user login dari `auth.getUser()`.
2. Validasi role memakai helper existing:

```js
resolveRole(actor)
isAllowedRole(role)
```

3. Ambil batch dari `generation_batches` berdasarkan `batch_id`.
4. Jika batch tidak ada, return `404`.
5. Jika role `user` atau `admin` dan `batch.company_id !== actor.company_id`, return `403`.
6. Ambil item dari `generation_batch_items` untuk batch tersebut.
7. Filter item yang valid:
   - `status = 'success'` atau status lain yang memang dipakai sistem untuk PDF selesai.
   - `saved_path` terisi, atau fallback dari join ke `generated_pdfs` jika perlu.
   - file benar-benar ada di filesystem.
   - filename berakhiran `.pdf`.
8. Buat stream ZIP dan append setiap file.
9. Set response header:

```text
Content-Type: application/zip
Content-Disposition: attachment; filename="<batch_id>.zip"
```

10. Return ZIP stream.

### 4. Query file batch

File:

```text
app/Controllers/Http/BatchController.js
```

Query bisa memanfaatkan tabel yang sudah ada:

```text
generation_batches
generation_batch_items
generated_pdfs
```

Contoh arah query:

```js
const items = await Database.from('generation_batch_items as gbi')
  .leftJoin('generated_pdfs as gp', 'gbi.generated_pdf_id', 'gp.id')
  .where('gbi.batch_id', batchId)
  .where('gbi.company_id', batch.company_id)
  .select(
    'gbi.row_no',
    'gbi.status',
    'gbi.filename',
    'gbi.saved_path',
    'gp.filename as generated_filename'
  )
```

Path file utama sebaiknya dari:

```text
gbi.saved_path
```

Jika kosong, boleh fallback ke data `generated_pdfs` jika path bisa diturunkan secara aman.

### 5. Keamanan path file

File:

```text
app/Controllers/Http/BatchController.js
```

Endpoint ini akan membaca file dari server, jadi wajib ada guard path:

- Resolve path absolut dari `saved_path`.
- Pastikan path akhir tetap berada di dalam folder:

```text
public/download
```

- Tolak path yang keluar dari root tersebut.
- Hanya masukkan file `.pdf`.
- Jangan percaya penuh isi `saved_path` dari DB tanpa validasi.

Contoh helper yang boleh dibuat:

```js
function resolveSafeDownloadPath(savedPath) {
  const downloadRoot = path.resolve(process.cwd(), 'public', 'download')
  const abs = path.resolve(process.cwd(), savedPath)
  if (!abs.startsWith(downloadRoot + path.sep)) return null
  return abs
}
```

### 6. Nama file dalam ZIP

File:

```text
app/Controllers/Http/BatchController.js
```

Gunakan nama yang mudah dibaca dan tidak bentrok.

Rekomendasi:

```text
row-<row_no>-<filename>
```

Contoh:

```text
row-1-event_weekly_payslip.3171000000000001.Budi.pdf
row-2-event_weekly_payslip.3171000000000002.Siti.pdf
```

Sanitize nama file dalam ZIP:

- Hilangkan path separator `/` dan `\`.
- Gunakan fallback jika filename kosong.

### 7. Behavior error yang diharapkan

Endpoint:

```text
GET /api/v1/batches/:batch_id/download
```

Expected errors:

- `400` jika `batch_id` kosong/tidak valid.
- `403` jika user tidak punya akses ke batch.
- `404` jika batch tidak ditemukan.
- `422` jika batch belum memiliki file PDF yang bisa didownload.
- `500` jika proses ZIP gagal.

Contoh response error:

```json
{
  "status": "error",
  "message": "Tidak ada file PDF yang bisa didownload untuk batch ini"
}
```

### 8. Update dokumentasi backend

File:

```text
API_DOCUMENTATION.md
README.md
```

Tambahkan dokumentasi:

```text
GET /api/v1/batches/:batch_id/download
```

Jelaskan:

- Response berupa file ZIP.
- Butuh JWT.
- Scope akses mengikuti batch history.
- ZIP hanya berisi PDF yang sudah berhasil dibuat.
- Batch yang masih processing mungkin belum berisi semua file.

## Detail Rencana Perubahan Frontend

### 1. Tambah API helper download ZIP

File:

```text
D:\eis\ui-pdf-generator\src\api\batchApi.js
```

Tambahkan function baru:

```js
export const downloadBatchZip = async ({ batchId } = {}) => {
  if (!batchId) throw 'Batch ID wajib diisi'

  const encodedId = encodeURIComponent(batchId)
  const res = await api.get(`/v1/batches/${encodedId}/download`, {
    responseType: 'blob'
  })

  return res
}
```

Implementer perlu menangani:

- Extract filename dari header `Content-Disposition` jika tersedia.
- Fallback filename:

```text
batch-<batch_id>.zip
```

- Error response blob JSON harus bisa dibaca agar toast menampilkan pesan backend.

Jika sudah ada pattern download blob di project, ikuti pattern itu.

### 2. Tambah tombol Download di halaman `/batches`

File:

```text
D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx
```

Di bagian kolom `batch_id`, saat ini ada tombol:

```text
Copy
Detail
```

Tambahkan tombol **Download** setelah **Detail**:

```text
Copy
Detail
Download
```

Tombol `Download` memanggil `downloadBatchZip({ batchId: row.batch_id })`.

### 3. Implement download blob di browser

File:

```text
D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx
```

Alur:

1. Set state `downloadingBatchId`.
2. Panggil API `downloadBatchZip`.
3. Buat object URL dari blob.
4. Buat temporary `<a>` dengan `download`.
5. Trigger click.
6. Revoke object URL.
7. Reset loading state.

Expected UI:

- Tombol batch yang sedang diproses disabled.
- Label bisa berubah menjadi `Downloading...` atau tetap `Download` dengan disabled state.
- Jika error, tampilkan `toast.error(...)`.

### 4. Batasi atau beri warning untuk batch belum selesai

File:

```text
D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx
```

Rekomendasi behavior:

- Tetap tampilkan tombol Download untuk semua batch.
- Jika batch masih `processing`, backend akan mengembalikan ZIP dari file yang sudah ada atau error jika belum ada file.
- Frontend boleh memberi tooltip/title sederhana:

```text
Download file PDF yang sudah selesai dalam batch ini
```

Tidak perlu membuat flow baru yang kompleks.

## File yang Kemungkinan Perlu Dimodifikasi

Backend:

```text
package.json
package-lock.json
start/routes.js
app/Controllers/Http/BatchController.js
API_DOCUMENTATION.md
README.md
```

Frontend:

```text
D:\eis\ui-pdf-generator\src\api\batchApi.js
D:\eis\ui-pdf-generator\src\pages\BatchHistoryPage.jsx
```

File test yang kemungkinan perlu diupdate atau ditambah:

```text
test/functional/api_endpoint_matrix.spec.js
D:\eis\ui-pdf-generator\src\api\batchApi.test.js
```

Jika ingin memisahkan logic ZIP agar controller tetap tipis, boleh buat service baru:

```text
app/Services/BatchZipService.js
```

Service ini bisa berisi:

- query file batch
- validasi safe path
- sanitize filename ZIP
- pembuatan archive stream

Namun untuk scope kecil, implementasi langsung di `BatchController.downloadZip` masih dapat diterima selama rapi.

## Acceptance Criteria

1. Halaman `/batches` menampilkan tombol **Download** setelah tombol **Detail** pada setiap row batch.
2. Klik tombol **Download** memanggil endpoint backend download ZIP untuk `batch_id` terkait.
3. Backend membuat ZIP berisi seluruh PDF yang sudah berhasil dibuat dalam batch tersebut.
4. File ZIP terdownload di browser.
5. Nama file ZIP jelas, minimal mengandung `batch_id`.
6. User/admin tidak bisa download ZIP batch milik company lain.
7. Superadmin bisa download ZIP batch lintas company.
8. Batch tanpa file PDF valid mengembalikan error yang jelas.
9. File gagal atau file yang belum selesai dibuat tidak masuk ke ZIP.
10. Endpoint tidak membaca file di luar folder `public/download`.
11. Download detail item satuan yang sudah ada tetap berjalan seperti sebelumnya.

## Skenario Test yang Perlu Dilakukan

Backend:

- Download ZIP untuk batch valid yang semua itemnya sukses.
- Download ZIP untuk batch valid dengan sebagian item gagal.
- Download ZIP untuk batch yang masih processing dan baru sebagian file tersedia.
- Download ZIP untuk batch tanpa file PDF valid.
- User/admin mencoba download batch company lain.
- Superadmin download batch company lain.
- Batch ID tidak ditemukan.
- Validasi bahwa file ZIP berisi nama file yang benar dan jumlah file sesuai.

Frontend:

- Tombol Download muncul setelah Detail di halaman `/batches`.
- Klik Download menghasilkan file `.zip`.
- Loading/disabled state muncul saat request berjalan.
- Error dari backend tampil sebagai toast.
- Tombol Detail dan Copy tetap berfungsi.

## Catatan Implementasi

- Gunakan route baru, jangan ubah behavior `GET /api/v1/batches` dan `GET /api/v1/batches/:batch_id`.
- ZIP dibuat di backend, bukan frontend.
- Jangan menyimpan ZIP permanen kecuali ada kebutuhan bisnis tambahan.
- Prioritaskan streaming ZIP agar aman untuk batch besar.
- Jangan memasukkan item gagal atau file yang tidak ditemukan ke ZIP.
- Hindari refactor besar; target issue ini spesifik pada download ZIP per batch.
