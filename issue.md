# Issue Plan: Template `cooperation_agreement`

## Ringkasan
Buat template PDF baru bernama `cooperation_agreement` berdasarkan draft `docs/cooperation_agreement.pdf`.
Template ini dipakai untuk dokumen cooperation agreement / PKM dengan nomor surat otomatis berformat:

`[UNIQUE NUMBER]/HRD-OMI/PKM/[BULAN]/[TAHUN]`

Contoh hasil nomor surat:

`1/HRD-OMI/PKM/VII/2026`

Dokumen ini disiapkan sebagai panduan implementasi untuk junior programmer atau AI model yang lebih murah.

## Informasi Repo
- Backend: `core.pdf-generator.indinesia.id`
- Frontend: `ui-pdf-generator`
- Referensi layout dan isi: `core.pdf-generator.indinesia.id/docs/cooperation_agreement.pdf`

## Keputusan Implementasi
- Gunakan nama template persis `cooperation_agreement`.
- Implementasikan sebagai legacy JS template agar bisa langsung di-resolve oleh `TemplateResolver` melalui file template.
- Jangan ubah nama menjadi `cooperation-agreement` kecuali product owner menyetujui perubahan nama template.
- Nomor surat harus auto-generate di backend. Nilai `letterNo` dari request atau Excel, jika ada, tidak boleh menjadi final source of truth.
- Bulan pada nomor surat memakai format Romawi seperti `I`, `II`, `III`, sampai `XII`.
- `companyName` punya default `PT. ORIGIN MAGNA INOVASI` jika tidak dikirim dari frontend/API.
- Signature direktur dan mitra dikirim sebagai URL gambar atau hasil upload signature yang sudah ada di sistem frontend.
- Nilai uang dan angka yang muncul di dokumen harus diformat oleh backend/template, bukan mengandalkan format input user.
- Logo `ORIGIN MAGNA INOVASI` wajib muncul di setiap halaman PDF sesuai draft, bukan hanya halaman pertama.

## Variable Input
Gunakan nama field canonical berikut pada `payload.data` dan field map frontend:

| Variable Bisnis | Field Payload | Catatan |
| --- | --- | --- |
| Nama perusahaan | `companyName` | Default `PT. ORIGIN MAGNA INOVASI` |
| Pihak 1 nama | `firstPartyName` | Nama pihak pertama |
| Pihak 1 jabatan | `firstPartyTitle` | Jabatan pihak pertama |
| Mitra nama | `partnerName` | Nama mitra |
| Mitra warga negara | `partnerNationality` | Contoh: `Indonesia` |
| Mitra ID/KTP/SIM | `partnerIdentityNumber` | Nomor identitas mitra |
| Mitra tempat lahir | `partnerBirthPlace` | Tempat lahir mitra |
| Mitra tanggal lahir | `partnerBirthDate` | Format tanggal mengikuti pola form existing |
| Mitra alamat | `partnerAddress` | Alamat mitra |
| Mitra no telp/hp | `partnerPhone` | Nomor telepon atau HP |
| Mitra email | `partnerEmail` | Email mitra |
| BRAND | `brand` | Brand penugasan/perjanjian |
| Salary/gaji | `salary` | Nominal gaji |
| Tunjangan transport | `transportAllowance` | Nominal tunjangan transport |
| Tunjangan makan | `mealAllowance` | Nominal tunjangan makan |
| Tunjangan pulsa | `phoneAllowance` | Nominal tunjangan pulsa |
| Nomor rekening mitra | `partnerBankAccountNumber` | Nomor rekening |
| Nama rekening mitra | `partnerBankAccountName` | Nama pemilik rekening |
| Nama bank mitra | `partnerBankName` | Nama bank |
| Lama perjanjian | `agreementDuration` | Contoh: `6 bulan` |
| Jam kerja per hari | `workHoursPerDay` | Contoh: `8 jam` |
| Wilayah penempatan | `placementArea` | Wilayah/area penempatan |
| Nama PIC | `picName` | Nama PIC |
| Jabatan PIC | `picTitle` | Jabatan PIC |
| Email PIC | `picEmail` | Email PIC |
| Alamat PIC | `picAddress` | Alamat PIC |
| Signature direktur | `directorSignatureUrl` | URL gambar signature direktur |
| Signature mitra | `partnerSignatureUrl` | URL gambar signature mitra |

Catatan:
- `letterNo` tidak dimasukkan sebagai field input user karena dibuat otomatis backend.
- Implementer boleh menambahkan alias Excel yang ramah user, misalnya `nama perusahaan`, `pihak 1 nama`, `mitra nama`, dan seterusnya, tetapi payload final tetap memakai field canonical di atas.

## Aturan Format Nilai
1. Format mata uang
- Field uang: `salary`, `transportAllowance`, `mealAllowance`, dan `phoneAllowance`.
- Pada dokumen akhir, setiap penyebutan nilai uang wajib menampilkan angka dan lafal alfabet/terbilang.
- Format output:
  - `Rp. 100.000 (Seratus ribu rupiah)`
- Angka mata uang wajib memakai separator titik untuk ribuan.
- Nilai mata uang tidak boleh punya angka di belakang koma. Input harus diperlakukan sebagai bilangan bulat.
- Jika input datang sebagai string berformat `10000`, `10.000`, atau `Rp 10.000`, backend harus menormalisasi menjadi integer sebelum dirender.

2. Format angka non-uang
- Field angka non-uang utama: `agreementDuration` dan `workHoursPerDay`.
- Jika nilai berupa angka, dokumen akhir harus menampilkan angka dan lafal alfabet/terbilang.
- Contoh:
  - `6 (enam) bulan`
  - `8 (delapan) jam per hari`
- Jika `agreementDuration` dikirim sebagai teks lengkap seperti `6 bulan`, implementer harus tetap memastikan bentuk akhir di dokumen punya angka dan lafalnya.
- Jika `workHoursPerDay` dikirim sebagai teks lengkap seperti `8 jam`, implementer harus tetap memastikan bentuk akhir di dokumen punya angka dan lafalnya.

3. Helper formatting
- Buat helper reusable untuk:
  - normalisasi integer dari input uang
  - format rupiah dengan separator titik
  - konversi angka ke terbilang Bahasa Indonesia
  - format angka biasa dengan lafal alfabet
- Helper ini dipakai oleh template `cooperation_agreement` agar hasil PDF konsisten untuk generate, preview, single email, dan bulk.

## Scope Backend
1. Tambah template PDF baru
- Buat `app/Templates/cooperation_agreement.js`.
- Buat bridge file `resources/pdf-templates/cooperation_agreement.js` yang me-require template dari `app/Templates`.
- Layout, logo, header/footer, wording, tabel, tanda tangan, dan spacing mengikuti `docs/cooperation_agreement.pdf`.
- Pastikan logo `ORIGIN MAGNA INOVASI` dirender berulang di tiap halaman, misalnya lewat `background`, `header`, atau mekanisme pdfmake lain yang berlaku untuk semua halaman.
- Logo tidak boleh tertutup konten, terpotong, atau berubah posisi antar halaman jika dokumen menjadi lebih dari satu halaman.
- Template harus memakai semua variable input pada tabel di atas sesuai posisi di draft PDF.
- Template harus menerapkan aturan format nilai uang dan angka pada section `Aturan Format Nilai`.

2. Tambah validasi required fields
- Tambah `cooperation_agreement` di `LEGACY_REQUIRED_FIELDS` pada `app/Services/TemplateResolver.js`.
- Required field minimal:
  - `firstPartyName`
  - `firstPartyTitle`
  - `partnerName`
  - `partnerNationality`
  - `partnerIdentityNumber`
  - `partnerBirthPlace`
  - `partnerBirthDate`
  - `partnerAddress`
  - `partnerPhone`
  - `partnerEmail`
  - `brand`
  - `salary`
  - `transportAllowance`
  - `mealAllowance`
  - `phoneAllowance`
  - `partnerBankAccountNumber`
  - `partnerBankAccountName`
  - `partnerBankName`
  - `agreementDuration`
  - `workHoursPerDay`
  - `placementArea`
  - `picName`
  - `picTitle`
  - `picEmail`
  - `picAddress`
- `companyName` boleh optional karena ada default.
- Signature boleh optional jika draft masih bisa dirender dengan placeholder, tetapi field tetap harus didukung.
- Field uang wajib divalidasi sebagai bilangan bulat atau string yang bisa dinormalisasi menjadi bilangan bulat.

3. Tambah helper format uang dan angka
- Tambahkan helper/service kecil untuk format rupiah dan terbilang Bahasa Indonesia.
- Gunakan helper tersebut untuk `salary`, `transportAllowance`, `mealAllowance`, `phoneAllowance`, `agreementDuration`, dan `workHoursPerDay`.
- Jangan simpan nilai formatted sebagai source of truth. Simpan/gunakan nilai mentah, lalu render format akhir saat membuat PDF.

4. Tambah generator nomor surat khusus PKM
- Buat service kecil atau helper yang menghasilkan nomor surat `cooperation_agreement` dengan format:
  - `{seq}/HRD-OMI/PKM/{romanMonth}/{year}`
- Sequence harus unik dan bertambah secara aman.
- Jika memungkinkan, reuse pola counter yang sudah ada pada `BaLetterNoService`, tetapi jangan campur counter PKM dengan counter template BA.
- Pastikan format tidak memakai `CompanyCode` dan tidak memakai `templateCode` BA.

5. Integrasikan nomor surat ke flow generate PDF
- Update `app/Controllers/Http/PdfController.js` agar `template === 'cooperation_agreement'` mendapat `data.letterNo` otomatis sebelum validasi template.
- Update `app/Jobs/GeneratePdfJob.js` agar nama file output mudah dilacak, misalnya:
  - `cooperation_agreement.<partnerName>.<letterNo>.<unique>.pdf`
- Pastikan karakter `/` pada nomor surat diganti aman untuk filename.

6. Integrasikan single email
- Tambahkan endpoint single send untuk template ini:
  - `POST /api/v1/send/cooperation_agreement`
- Tambahkan method di `app/Controllers/Http/SingleEmailController.js`.
- Subject/body default disesuaikan sebagai dokumen `Cooperation Agreement` atau `Perjanjian Kerja Sama`.
- Nomor surat tetap auto-generate saat single send.

7. Integrasikan preview
- Pastikan `POST /api/v1/preview/cooperation_agreement` bisa membuat preview.
- Preview boleh memakai nomor sementara, misalnya `PREVIEW/HRD-OMI/PKM/[BULAN]/[TAHUN]`, dan tidak boleh menaikkan counter final.
- Jika `BaPreviewService` hanya mendukung BA/static tertentu, tambahkan dukungan template ini tanpa merusak preview BA existing.

8. Integrasikan bulk generate jika dibutuhkan UI bulk
- Tambahkan endpoint:
  - `POST /api/v1/bulk/cooperation_agreement`
- Tambahkan mode baru di `BulkPdfController`.
- Buat payload builder dari Excel untuk field template ini.
- Support alias kolom Excel berdasarkan nama variable bisnis di tabel.
- Normalisasi field uang dari Excel sebelum masuk payload final.
- Nomor surat final harus dibuat per row saat bukan dry run.
- Pada dry run, tampilkan placeholder seperti `[AUTO_GENERATED_ON_EXECUTION]`.

9. Update allowed templates dan dokumentasi backend
- Pastikan `GET /api/v1/admin/templates` menampilkan `cooperation_agreement`.
- Pastikan company bisa mengizinkan template ini lewat `allowed_templates`.
- Update `README.md` dan `API_DOCUMENTATION.md` dengan:
  - nama template
  - contoh payload
  - field wajib
  - aturan format uang dan angka
  - format nomor surat
  - endpoint generate, preview, single email, dan bulk jika diimplementasikan

## Scope Frontend
1. Tambah opsi template
- Update `ui-pdf-generator/src/utils/templateFields.js`.
- Tambahkan label `Cooperation Agreement`.
- Tambahkan field map sesuai tabel variable input.
- `companyName` diisi default `PT. ORIGIN MAGNA INOVASI`.
- Field nominal (`salary`, `transportAllowance`, `mealAllowance`, `phoneAllowance`) harus mendorong input bilangan bulat tanpa desimal.
- Frontend boleh membantu menampilkan separator ribuan, tetapi payload tetap harus bisa diproses backend sebagai integer.
- Field `agreementDuration` dan `workHoursPerDay` harus jelas untuk input angka/durasi agar backend bisa membuat bentuk angka dan terbilang.
- Field signature gunakan input URL/upload signature sesuai pola existing.

2. Update generate dan preview
- Pastikan template muncul di halaman generate PDF dan single email saat diizinkan oleh `allowed_templates`.
- Pastikan tombol preview mengirim template `cooperation_agreement` dan payload field yang benar.
- Jika ada fallback untuk template custom/dinamis, pastikan template ini tetap memakai field map statis.

3. Update single email
- Update daftar template pada `ui-pdf-generator/src/components/forms/SendSingleEmailForm.jsx`.
- Pastikan submit memakai endpoint `/v1/send/cooperation_agreement`.
- Pastikan subject/body default frontend tidak memblokir default backend.

4. Update bulk generate jika endpoint bulk dibuat
- Update `ui-pdf-generator/src/components/forms/BulkGenerateForm.jsx`.
- Tambahkan mode `cooperation_agreement`.
- Tambahkan hint kolom Excel berdasarkan tabel variable input.
- Tambahkan file contoh Excel di `ui-pdf-generator/public/templates/cooperation_agreement.xlsx`.

5. Update dokumentasi frontend
- Update `ui-pdf-generator/API_DOCUMENTATION.md` bila file ini masih dipakai sebagai referensi UI.

## Perkiraan File Yang Disentuh
Backend:
- `app/Templates/cooperation_agreement.js`
- `resources/pdf-templates/cooperation_agreement.js`
- `app/Services/TemplateResolver.js`
- `app/Services/*LetterNo*` atau service baru untuk numbering PKM
- `app/Services/*NumberFormat*` atau helper baru untuk rupiah dan terbilang
- `app/Controllers/Http/PdfController.js`
- `app/Controllers/Http/SingleEmailController.js`
- `app/Controllers/Http/BulkPdfController.js` jika bulk dibuat
- `app/Services/BaPreviewService.js` atau service preview terkait
- `app/Jobs/GeneratePdfJob.js`
- `start/routes.js`
- `README.md`
- `API_DOCUMENTATION.md`

Frontend:
- `src/utils/templateFields.js`
- `src/components/forms/SendSingleEmailForm.jsx`
- `src/components/forms/BulkGenerateForm.jsx` jika bulk dibuat
- `public/templates/cooperation_agreement.xlsx` jika bulk dibuat
- `API_DOCUMENTATION.md`

## Skenario Test
- Generate PDF `cooperation_agreement` dengan payload valid berhasil masuk queue atau menghasilkan output sesuai flow yang dipakai.
- Output PDF mengikuti layout utama dari `docs/cooperation_agreement.pdf`.
- Logo `ORIGIN MAGNA INOVASI` tampil di setiap halaman PDF sesuai draft.
- Semua variable input tampil pada PDF di posisi yang benar.
- `companyName` memakai default `PT. ORIGIN MAGNA INOVASI` saat tidak dikirim.
- Field uang tampil dengan format angka dan terbilang, contoh `Rp. 100.000 (Seratus ribu rupiah)`.
- Field uang memakai separator titik dan tidak memiliki angka di belakang koma.
- Input uang dari variasi umum seperti `10000`, `10.000`, atau `Rp 10.000` menghasilkan format akhir yang konsisten.
- `agreementDuration` tampil dengan angka dan lafal alfabet/terbilang.
- `workHoursPerDay` tampil dengan angka dan lafal alfabet/terbilang.
- Nomor surat final mengikuti format `[UNIQUE NUMBER]/HRD-OMI/PKM/[BULAN]/[TAHUN]`.
- Nomor surat bertambah unik untuk request berikutnya.
- Nilai `letterNo` manual dari request tidak menjadi final.
- Payload dengan field wajib kosong mengembalikan validasi yang jelas.
- Template ditolak saat tidak ada di `allowed_templates` company.
- Single email `cooperation_agreement` menghasilkan PDF, membuat email log, dan enqueue email dengan attachment.
- Preview `cooperation_agreement` berhasil dibuat tanpa menaikkan counter nomor surat final.
- Bulk generate, jika dibuat, memproses row valid dan menandai row invalid dengan error.
- Frontend menampilkan template hanya saat diizinkan dan mengirim payload sesuai field backend.
- Link download Excel bulk, jika dibuat, mengarah ke file yang tersedia.

## Acceptance Criteria
- Template `cooperation_agreement` tersedia dari backend dengan nama persis tersebut.
- PDF yang dihasilkan mengikuti draft `docs/cooperation_agreement.pdf`.
- Logo `ORIGIN MAGNA INOVASI` selalu ada di setiap halaman PDF.
- Semua variable input pada tabel didukung oleh backend dan frontend.
- Nilai uang dan angka pada dokumen mengikuti aturan format nilai yang ditentukan.
- Nomor surat otomatis memakai format `[UNIQUE NUMBER]/HRD-OMI/PKM/[BULAN]/[TAHUN]`.
- Generate, preview, single email, dan bulk jika masuk scope berjalan konsisten dengan template existing.
- Frontend bisa memilih dan submit template ini sesuai izin `allowed_templates`.
- Dokumentasi backend dan frontend sudah sinkron dengan implementasi.
