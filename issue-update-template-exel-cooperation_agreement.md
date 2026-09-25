# Issue: Ubah Tunjangan TL menjadi Tunjangan Jabatan khusus `exel_cooperation_agreement`

## Konteks dan ruang lingkup

- Backend: `D:\eis\core.pdf-generator.indinesia.id`.
- Frontend: `D:\eis\ui-pdf-generator`.
- Template sasaran: **`exel_cooperation_agreement`**. Nama `event_weekly_payslip` pada bagian “Scoop” permintaan dianggap salah tulis, karena seluruh rincian perubahan menyebut template EXEL. Jangan mengubah `event_weekly_payslip`.
- Alur yang harus bekerja: **Generate Single PDF**, **Send Single Email**, dan **Bulk Generate PDF**.
- `cooperation_agreement` dan semua template lain harus mempertahankan kontrak dan hasil PDF yang berlaku sekarang.

## Kondisi saat ini

- Form single untuk EXEL di `src/utils/templateFields.js` masih memakai `tlAllowance`/`tlAllowanceUnit` dengan label **Tunjangan TL**.
- PDF EXEL memakai `app/Templates/cooperation_agreement.js` melalui wrapper `app/Templates/exel_cooperation_agreement.js`. Daftar tunjangan dalam template bersama itu selalu mencetak **Tunjangan TL**.
- Normalisasi serta validasi angka kedua agreement memakai `app/Services/CooperationAgreementService.js`; input bulk dipetakan di `app/Controllers/Http/BulkPdfController.js`.
- Hint kolom bulk EXEL masih mewarisi `tlAllowance`/`tlAllowanceUnit` dari helper bersama di `src/components/forms/BulkGenerateForm.jsx`.
- Dua file Excel EXEL yang sekarang tersedia masih mempunyai header `tlAllowance` dan `tlAllowanceUnit`.
- `Send Single Email` belum menawarkan pilihan EXEL di `src/components/forms/SendSingleEmailForm.jsx`. Route backend `/api/v1/send/exel_cooperation_agreement` sudah ada di `start/routes.js`, tetapi `SingleEmailController.sendExelCooperationAgreement` belum terimplementasi; jalur ini perlu diselesaikan.

## Kontrak hasil yang disepakati untuk implementasi

Gunakan pasangan nama field baru **`jabatanAllowance`** dan **`jabatanAllowanceUnit`** untuk `exel_cooperation_agreement`. Keduanya adalah pengganti `tlAllowance` dan `tlAllowanceUnit` pada template EXEL saja. Label input, hint kolom, dan teks PDF memakai **Tunjangan Jabatan** serta **Satuan Tunjangan Jabatan**. Field tunjangan tetap opsional; nilai positif muncul pada daftar tunjangan PDF, nilai kosong/nol mengikuti perilaku tunjangan yang sudah ada. Satuan tetap memakai aturan format yang berlaku sekarang.

Header workbook EXEL harus berisi `jabatanAllowance` dan `jabatanAllowanceUnit` pada posisi dua kolom lama, tanpa `tlAllowance` maupun `tlAllowanceUnit`. Header lain dan urutannya tetap. Template `cooperation_agreement` tetap memakai `tlAllowance`, `tlAllowanceUnit`, dan teks **Tunjangan TL**. Bila perlu menerima workbook EXEL lama sebagai kompatibilitas, lakukan alias yang khusus untuk template EXEL; jangan mengembalikan nama lama ke template Excel yang diunduh atau ke UI baru. Jangan memakai field payslip `tunjanganJabatan` sebagai kontrak agreement secara diam-diam.

## Rencana implementasi

### 1. Backend: pisahkan perilaku tunjangan menurut template

1. Pada `app/Services/CooperationAgreementService.js`, normalisasi `jabatanAllowance`/`jabatanAllowanceUnit` untuk EXEL, termasuk parsing angka dan normalisasi satuan. Pastikan nilai EXEL diteruskan sampai renderer PDF. Pertahankan cabang `tlAllowance` untuk `cooperation_agreement`. Jika validasi menerima nama template, teruskan template secara eksplisit dari pemanggil agar pemilihan cabang tidak bergantung pada keberadaan `data.template` secara kebetulan.
2. Pada `app/Templates/cooperation_agreement.js`, pilih label, field angka, dan field satuan berdasarkan template ketika membentuk daftar tunjangan. Wrapper `app/Templates/exel_cooperation_agreement.js` sudah menetapkan identitas template EXEL; ubah wrapper hanya jika diperlukan untuk menjaga identitas tersebut. Jangan mengganti label bersama secara global.
3. Pada `app/Controllers/Http/BulkPdfController.js`, petakan header baru ke field EXEL saat membangun payload. Cabang `cooperation_agreement` harus tetap membaca header lamanya. Pastikan dry run dan pemrosesan normal sama-sama memakai pemetaan baru.
4. Tinjau pemanggilan normalisasi/validasi di `app/Controllers/Http/PdfController.js` dan `app/Controllers/Http/SingleEmailController.js`. Kedua jalur single harus menerima field baru, menggunakan default EXEL yang sudah ada, dan menghasilkan PDF dengan label baru.
5. Implementasikan `sendExelCooperationAgreement` di `app/Controllers/Http/SingleEmailController.js` untuk route EXEL yang telah tersedia. Gunakan konfigurasi agreement dengan `template: exel_cooperation_agreement`, field wajib yang sama, penomoran surat yang sesuai, dan alur kirim/attachment yang sudah dipakai agreement. Jangan sampai konfigurasi selalu menetapkan `cooperation_agreement`.

### 2. Frontend: form single dan bulk

1. Pada `src/utils/templateFields.js`, ubah **hanya** daftar field `exel_cooperation_agreement`: nama field serta label pasangan tunjangan menjadi kontrak baru. Daftar `cooperation_agreement` tetap.
2. `src/components/forms/GeneratePdfForm.jsx` sudah mengenali kedua agreement dan menggunakan `templateFieldMap`; verifikasi payload dan preview mengirim `jabatanAllowance`/`jabatanAllowanceUnit`. Ubah file ini hanya jika ada pemrosesan khusus yang masih merujuk field lama.
3. Pada `src/components/forms/SendSingleEmailForm.jsx`, tambahkan EXEL ke pilihan template, dan sertakan EXEL dalam perlakuan agreement untuk logo, tanda tangan, preview, field wajib, serta payload email. `src/api/sendApi.js` sudah membentuk URL dari nama template; ubah hanya bila verifikasi menemukan kebutuhan nyata. Pilihan tetap mengikuti `allowed_templates` company.
4. Pada `src/components/forms/BulkGenerateForm.jsx`, buat hint kolom agreement peka terhadap template: EXEL menampilkan `jabatanAllowance`/`jabatanAllowanceUnit`, agreement biasa tetap menampilkan `tlAllowance`/`tlAllowanceUnit`. Link unduh EXEL yang ada tetap mengarah ke `/templates/exel_cooperation_agreement.xlsx`.

### 3. Excel yang diunduh dan sumber pembuatnya

1. Ubah definisi `exel_cooperation_agreement` di `scripts/create-bulk-template.js`. Saat ini definisi tersebut menyalin seluruh header `cooperation_agreement`; ganti hanya dua nama kolom untuk EXEL dan pertahankan data contoh pada posisi yang sesuai. Definisi template lain tetap.
2. Buat ulang `resources/templates/exel_cooperation_agreement-bulk-template.xlsx` di backend dan `public/templates/exel_cooperation_agreement.xlsx` di frontend. Pastikan keduanya valid, mempunyai header identik, dan dapat diunggah lewat mode EXEL. Tidak perlu membuat file Excel bernama baru.
3. Jangan mengubah `public/templates/cooperation_agreement.xlsx` atau workbook template lain.

## Perkiraan file yang berubah

| Repo | Aksi | File | Tujuan |
| --- | --- | --- | --- |
| Backend | Ubah | `app/Services/CooperationAgreementService.js` | Normalisasi dan validasi field EXEL baru |
| Backend | Ubah | `app/Templates/cooperation_agreement.js` | Pilih label/field tunjangan sesuai template |
| Backend | Ubah | `app/Controllers/Http/BulkPdfController.js` | Baca header bulk EXEL baru |
| Backend | Ubah | `app/Controllers/Http/SingleEmailController.js` | Aktifkan endpoint single email EXEL dan normalisasi datanya |
| Backend | Ubah jika diperlukan | `app/Controllers/Http/PdfController.js`, `app/Templates/exel_cooperation_agreement.js` | Jaga identitas template pada alur single/render |
| Backend | Ubah | `scripts/create-bulk-template.js` | Hasilkan header EXEL baru |
| Backend | Buat ulang | `resources/templates/exel_cooperation_agreement-bulk-template.xlsx` | Workbook sumber EXEL |
| Frontend | Ubah | `src/utils/templateFields.js` | Field dan label form single EXEL |
| Frontend | Ubah | `src/components/forms/SendSingleEmailForm.jsx` | Pilihan dan alur single email EXEL |
| Frontend | Ubah | `src/components/forms/BulkGenerateForm.jsx` | Hint header EXEL tanpa memengaruhi agreement biasa |
| Frontend | Ubah jika diperlukan | `src/components/forms/GeneratePdfForm.jsx` | Pastikan form/preview EXEL mengirim field baru |
| Frontend | Buat ulang | `public/templates/exel_cooperation_agreement.xlsx` | File download yang dipakai UI |
| Keduanya | Ubah/tambah seperlunya | `test/unit/cooperation_agreement_template.spec.js`, `test/functional/api_endpoint_matrix.spec.js`, `src/utils/templateFields.test.js`, test form terkait di `src/components/forms/` | Verifikasi perubahan dan regresi |

`start/routes.js`, `src/api/sendApi.js`, dan `src/api/bulkApi.js` cukup diverifikasi dahulu; route dan pola URL yang dibutuhkan sudah ada. Tidak ada kebutuhan membuat endpoint baru jika route tersebut berfungsi setelah controller dilengkapi.

## Kriteria penerimaan

1. Di **Generate Single PDF**, memilih EXEL menampilkan **Tunjangan Jabatan** dan **Satuan Tunjangan Jabatan**. Payload/preview memakai dua field baru, dan PDF bernilai positif mencetak **Tunjangan Jabatan**, tanpa teks **Tunjangan TL** pada bagian tunjangan tersebut.
2. Di **Send Single Email**, EXEL dapat dipilih bila diizinkan company, pengisian dan preview memakai field baru, endpoint `/api/v1/send/exel_cooperation_agreement` berjalan, dan lampiran PDF memakai label baru.
3. Di **Bulk Generate PDF**, hint EXEL serta header file unduhan memakai `jabatanAllowance` dan `jabatanAllowanceUnit`. Tidak ada header `tlAllowance` atau `tlAllowanceUnit` di workbook EXEL frontend maupun backend.
4. File Excel EXEL yang diunduh dapat diunggah kembali untuk dry run dan pemrosesan normal; nilai tunjangan dan satuannya muncul benar di PDF.
5. `cooperation_agreement` tetap menerima field/header `tlAllowance` dan mencetak **Tunjangan TL**. `event_weekly_payslip` serta template lain tidak berubah.
6. Pembatasan `allowed_templates`, default branding EXEL, penomoran surat, dan field wajib agreement tetap bekerja pada ketiga alur.

## Skenario pengujian

- Form Generate Single PDF dan Send Single Email: pilih EXEL, isi tunjangan beserta satuan, cek payload, preview, hasil PDF, serta kondisi nilai kosong/nol.
- Endpoint single email EXEL: cek request valid dan invalid, lalu pastikan lampiran PDF dan pencatatan/template yang dipakai benar.
- Bulk EXEL: unduh workbook, periksa header dan baris contoh, unggah untuk dry run serta generate normal, lalu cek hasil PDF.
- Regresi: jalankan skenario agreement biasa dengan `tlAllowance` dan bandingkan label PDF; cek satu template lain, termasuk `event_weekly_payslip`, tidak berubah.
- Hak akses: company yang tidak mengizinkan EXEL tidak dapat memakai pilihan/endpoint EXEL.

Detail kode test dan fixture diserahkan kepada implementer.
