# Issue: Samakan Output Production dan Development untuk `cooperation_agreement`

## Ringkasan

Perbaiki masalah layout PDF pada template `cooperation_agreement` di production.

Repositori terkait:

- Backend: `D:\eis\core.pdf-generator.indinesia.id`
- Frontend: `D:\eis\ui-pdf-generator`

Target utama:

- Output production untuk template `cooperation_agreement` harus sama dengan output development.
- Halaman 3 dan seterusnya tidak boleh memiliki margin kanan `0`.
- Teks tidak boleh mepet ke kanan kertas pada halaman mana pun.

## Latar Belakang

Setelah aplikasi deploy ke production, ada masalah saat membuat template `cooperation_agreement`.

File hasil production tersedia di:

```text
output/cooperation_agreement_production.pdf
```

Masalah yang terlihat:

- Pada production, halaman 3 dan seterusnya memiliki margin kanan seperti `0`.
- Teks menjadi terlalu mepet ke sisi kanan kertas.
- Kasus yang sama sudah dites di development dan masalah ini tidak terjadi.

Karena development dan production menghasilkan layout berbeda, implementer harus mencari penyebab perbedaan environment, source template, atau konfigurasi render PDF.

## Scope

### Backend

1. Pastikan template `cooperation_agreement` selalu memiliki margin kanan yang benar di semua halaman.
2. Pastikan output production konsisten dengan development untuk payload yang sama.
3. Verifikasi apakah production memakai template legacy file atau dynamic template dari database.
4. Jika production memakai dynamic template yang berbeda, samakan konfigurasi layout-nya dengan template legacy yang benar.
5. Tambahkan guard agar docDefinition `cooperation_agreement` tidak bisa dirender dengan `pageMargins` yang kosong, salah urutan, atau margin kanan `0`.
6. Buat sample/regression output PDF yang bisa dipakai membandingkan hasil production dan development.

### Frontend

Perubahan frontend kemungkinan tidak diperlukan jika bug hanya berasal dari render PDF backend. Frontend hanya perlu disentuh jika hasil investigasi menemukan payload dari production berbeda dari payload development.

## Analisis Awal Teknis

Template legacy saat ini ada di:

```text
app/Templates/cooperation_agreement.js
resources/pdf-templates/cooperation_agreement.js
```

Template legacy `app/Templates/cooperation_agreement.js` sudah mendefinisikan:

```js
pageSize: 'A4',
pageMargins: [54, 88, 54, 78]
```

Artinya secara desain margin kanan seharusnya `54`, bukan `0`.

Namun resolver backend memprioritaskan dynamic template dari database sebelum fallback ke file legacy:

```text
app/Services/TemplateResolver.js
```

Kemungkinan penyebab yang perlu dicek:

1. Production memakai record aktif di tabel `dynamic_templates` untuk `template_key = cooperation_agreement`, sedangkan development memakai template legacy file.
2. `content_json` dynamic template di production tidak memiliki `pageMargins`, memiliki `pageMargins` salah, atau memiliki node/table dengan width/margin yang membuat konten keluar dari area halaman.
3. Production menjalankan versi code/dependency berbeda dari development.
4. Payload production memiliki teks sangat panjang tanpa spasi atau data berbeda yang mendorong layout melewati margin kanan.
5. Ada perbedaan asset/logo/footer/font di production yang memengaruhi layout page break setelah halaman 2.

Implementer harus membuktikan penyebabnya dari data dan output, bukan hanya menebak dari visual PDF.

## Detail Rencana Investigasi

### 1. Bandingkan source template yang dipakai production dan development

File terkait:

```text
app/Services/TemplateResolver.js
app/Jobs/GeneratePdfJob.js
```

Tambahkan log sementara atau debug yang aman untuk mengetahui hasil resolver:

```text
template_key
source: legacy/dynamic
dynamic_template_id jika ada
company_id
pageMargins final
jumlah content node
```

Yang harus dipastikan:

- Development dan production memakai source template yang sama untuk `cooperation_agreement`.
- Jika production memakai dynamic template, cek isi `dynamic_templates.content_json`.
- Jika dynamic template tidak diperlukan untuk `cooperation_agreement`, pertimbangkan agar template ini selalu memakai legacy file atau dynamic record production diperbaiki.

Catatan: jangan tinggalkan log payload lengkap yang berisi data pribadi di production.

### 2. Bandingkan docDefinition final

File terkait:

```text
app/Templates/cooperation_agreement.js
app/Services/TemplateResolver.js
app/Jobs/GeneratePdfJob.js
```

Buat cara untuk men-dump docDefinition final untuk payload yang sama di development dan production/staging.

Minimal yang perlu dibandingkan:

- `pageSize`
- `pageMargins`
- `defaultStyle`
- `background`
- struktur content mulai halaman sekitar Pasal 3 sampai akhir dokumen
- table/columns yang memiliki width tetap, margin besar, atau width melebihi area halaman

Expected:

```js
pageMargins: [54, 88, 54, 78]
```

Jika docDefinition production berbeda, perbaiki sumber perbedaannya.

### 3. Reproduce memakai payload yang sama

File terkait:

```text
app/Controllers/Http/PdfController.js
app/Jobs/GeneratePdfJob.js
test/unit/cooperation_agreement_template.spec.js
```

Ambil payload yang menghasilkan:

```text
output/cooperation_agreement_production.pdf
```

Generate ulang di development dengan payload yang sama.

Simpan hasil pembanding, misalnya:

```text
output/cooperation_agreement_development_compare.pdf
output/cooperation_agreement_production_compare.pdf
```

Pastikan perbandingan dilakukan dengan input yang sama:

- company yang sama atau field `companyName` yang sama
- logo/signature yang sama atau dinonaktifkan sementara
- field tunjangan yang sama
- field alamat/PIC yang sama
- nomor surat boleh berbeda, tetapi jangan sampai memengaruhi layout signifikan

### 4. Tambahkan guard margin untuk `cooperation_agreement`

File utama:

```text
app/Templates/cooperation_agreement.js
```

Pastikan docDefinition final template legacy tetap eksplisit:

```js
pageSize: 'A4',
pageMargins: [54, 88, 54, 78]
```

Jika implementer menemukan ada flow dynamic yang tetap harus dipakai, tambahkan normalisasi/guard di resolver atau service khusus agar `cooperation_agreement` tidak pernah dirender dengan margin kanan `0`.

Opsi lokasi guard:

```text
app/Services/TemplateResolver.js
app/Services/CooperationAgreementService.js
```

Contoh arah logic:

- Saat template adalah `cooperation_agreement`, validasi `docDefinition.pageMargins`.
- Jika `pageMargins` tidak valid, set ke default `[54, 88, 54, 78]`.
- Jika `pageMargins[2] <= 0`, set kanan ke `54`.
- Jangan mengubah behavior template lain.

Gunakan konstanta agar angka margin tidak tersebar di banyak file.

### 5. Cek struktur content yang berisiko melewati margin kanan

File utama:

```text
app/Templates/cooperation_agreement.js
```

Area yang perlu diperiksa:

- helper `numberedItem`
- helper `indented`
- helper `tableRows`
- helper `correspondenceBlock`
- `signatureSection`
- paragraf penutup yang diawali teks `Demikianlah Perjanjian ini dibuat...`
- Pasal 2 dan Pasal 3, karena halaman 3 dan seterusnya kemungkinan mulai dari area ini

Pastikan setiap `columns` memakai width yang aman:

- total fixed width tidak melebihi content width A4 setelah margin
- kolom teks utama memakai `'*'`
- margin kiri nested list tidak terlalu besar
- tidak ada margin kanan negatif atau width besar yang mendorong teks keluar halaman

Jika ada teks panjang tanpa spasi dari payload, implementer boleh menambahkan sanitasi display atau wrapping khusus pada field tersebut, selama hasil visual tetap sama dengan development.

### 6. Validasi paragraf penutup dan tanda tangan

File utama:

```text
app/Templates/cooperation_agreement.js
```

Ada paragraf penutup berikut menjelang bagian tanda tangan:

```text
"Demikianlah Perjanjian ini dibuat oleh Para Pihak dalam 2 (dua) rangkap dan telah benar-benar memahami seluruh ketentuan dalam Perjanjian ini dan oleh karenanya telah sepakat melaksanakan Perjanjian ini. Para Pihak saat menandatangani Perjanjian ini dalam keadaan sehat jasmani dan rohani tanpa adanya paksaan ataupun tekanan dari pihak manapun"
```

Di template saat ini paragraf tersebut berada sebelum:

```js
signatureSection(...)
```

Requirement tambahan:

- Paragraf penutup harus tampil normal sebelum tanda tangan.
- Paragraf penutup tidak boleh keluar dari margin kanan.
- Kolom tanda tangan kedua belah pihak tidak boleh berbeda halaman.
- Kolom `PIHAK PERTAMA` dan `PIHAK KEDUA` harus tetap dalam satu table/section yang sama dan muncul pada halaman yang sama.
- Jika ruang di halaman tidak cukup, seluruh section tanda tangan harus pindah ke halaman berikutnya, bukan terbelah antara dua halaman.

Rencana pengecekan:

- Cek apakah penggunaan `unbreakableParagraph(...)` pada paragraf penutup sudah tepat atau justru memicu overflow/margin rusak di production.
- Cek apakah `signatureSection(...)` perlu diberi `unbreakable: true` pada level section/table tanda tangan.
- Jika paragraf penutup dan tanda tangan harus dijaga bersama, pertimbangkan wrapper stack yang menjaga block akhir tetap rapi tanpa membuat teks keluar margin.
- Jangan mengubah isi teks legal kecuali ada instruksi bisnis terpisah.
- Pastikan titik akhir kalimat tetap ada di output PDF final.

Expected result:

- Paragraf penutup wrap normal dan rata kiri-kanan di dalam margin.
- Setelah paragraf penutup, tanda tangan `PIHAK PERTAMA` dan `PIHAK KEDUA` tampil pada halaman yang sama.
- Tidak ada kondisi satu kolom tanda tangan berada di akhir halaman dan kolom lainnya pindah ke halaman berikutnya.

### 7. Pastikan dependency dan font production sama dengan development

File terkait:

```text
package.json
package-lock.json
app/Jobs/GeneratePdfJob.js
app/Fonts/
```

Hal yang perlu dicek:

- Versi `pdfmake` yang terinstall di production sesuai `package-lock.json`.
- Font Roboto Condensed tersedia di production.
- Tidak ada perbedaan install dependency antara development dan production.
- Production tidak memakai cache/container image lama.

Jika root cause adalah perbedaan dependency atau missing font, perbaikan harus masuk ke deployment/build process, bukan hanya code.

## Detail Rencana Perubahan Backend

### 1. Tambah konstanta layout cooperation agreement

File yang bisa dimodifikasi:

```text
app/Services/CooperationAgreementService.js
```

Tambahkan konstanta default layout, misalnya:

```js
const DEFAULT_PAGE_MARGINS = Object.freeze([54, 88, 54, 78])
```

Expose lewat getter atau method kecil:

```js
static defaultPageMargins() {
  return DEFAULT_PAGE_MARGINS.slice()
}
```

Tujuannya agar margin default bisa dipakai konsisten oleh template dan guard.

### 2. Pakai konstanta margin di template legacy

File:

```text
app/Templates/cooperation_agreement.js
```

Ganti hardcoded margin dengan konstanta dari service:

```js
pageMargins: CooperationAgreementService.defaultPageMargins()
```

Pastikan output visual development tetap sama.

### 3. Tambahkan guard untuk dynamic docDefinition jika dibutuhkan

File:

```text
app/Services/TemplateResolver.js
```

Jika production terbukti memakai dynamic template untuk `cooperation_agreement`, tambahkan normalisasi khusus setelah `renderDynamicDocDefinition` atau saat resolve dynamic template.

Rekomendasi:

- Buat helper kecil seperti `normalizeTemplateDocDefinition(templateKey, docDefinition)`.
- Untuk `cooperation_agreement` dan `exel_cooperation_agreement`, validasi `pageMargins`.
- Jangan override margin template lain.

Expected result:

```js
docDefinition.pageMargins[2] > 0
```

Minimal margin kanan harus sama dengan development:

```js
54
```

### 4. Tambahkan logging diagnostik yang aman

File:

```text
app/Jobs/GeneratePdfJob.js
```

Tambahkan log ringkas ketika template adalah `cooperation_agreement`:

```text
[cooperation_agreement] template_source=legacy|dynamic pageMargins=[54,88,54,78]
```

Jika log hanya dibutuhkan sementara untuk investigasi production, bungkus dengan env flag, misalnya:

```text
PDF_DEBUG_LAYOUT=true
```

Jangan log payload lengkap karena mengandung data mitra.

### 5. Buat script pembanding output jika diperlukan

File baru opsional:

```text
scripts/generate-cooperation-agreement-sample.js
```

Script ini bisa digunakan developer untuk generate sample PDF dari payload fixture yang sama tanpa harus lewat UI.

Output yang disarankan:

```text
output/cooperation_agreement.layout-regression.pdf
```

Jika sudah ada cara generate sample di test existing, boleh pakai yang ada dan tidak perlu buat script baru.

### 6. Update dokumentasi internal issue/release

File opsional:

```text
README.md
API_DOCUMENTATION.md
```

Tambahkan catatan singkat hanya jika ada perubahan behavior penting, misalnya:

- `cooperation_agreement` selalu memakai legacy template.
- dynamic template `cooperation_agreement` tetap didukung tetapi margin dinormalisasi.
- ada env flag debug layout baru.

## Detail Rencana Perubahan Frontend

Kemungkinan besar frontend tidak perlu diubah.

Frontend hanya perlu dimodifikasi jika investigasi menemukan payload dari UI production berbeda dari payload development.

File yang mungkin perlu dicek:

```text
D:\eis\ui-pdf-generator\src\components\forms\GeneratePdfForm.jsx
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
D:\eis\ui-pdf-generator\src\utils\templateFields.js
D:\eis\ui-pdf-generator\src\api\pdfApi.js
D:\eis\ui-pdf-generator\src\api\bulkApi.js
```

Hal yang perlu dicek:

- Payload `cooperation_agreement` dari production sama dengan payload development.
- Tidak ada field panjang/format berbeda yang hanya muncul di production.
- Tidak ada perubahan template selection yang membuat production mengirim `exel_cooperation_agreement` atau dynamic key lain tanpa sengaja.

Jika payload frontend sudah sama, jangan lakukan perubahan frontend.

## File yang Kemungkinan Perlu Dimodifikasi atau Dibuat

Backend kemungkinan dimodifikasi:

```text
app/Templates/cooperation_agreement.js
app/Services/CooperationAgreementService.js
app/Services/TemplateResolver.js
app/Jobs/GeneratePdfJob.js
test/unit/cooperation_agreement_template.spec.js
```

Backend kemungkinan hanya dicek:

```text
resources/pdf-templates/cooperation_agreement.js
resources/pdf-templates/exel_cooperation_agreement.js
app/Templates/exel_cooperation_agreement.js
app/Controllers/Http/PdfController.js
app/Controllers/Http/BulkPdfController.js
package.json
package-lock.json
```

Backend file baru opsional:

```text
scripts/generate-cooperation-agreement-sample.js
test/functional/cooperation_agreement_pdf_layout.spec.js
```

Frontend kemungkinan hanya dicek:

```text
D:\eis\ui-pdf-generator\src\components\forms\GeneratePdfForm.jsx
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
D:\eis\ui-pdf-generator\src\utils\templateFields.js
D:\eis\ui-pdf-generator\src\api\pdfApi.js
D:\eis\ui-pdf-generator\src\api\bulkApi.js
```

Frontend kemungkinan dimodifikasi hanya jika payload berbeda:

```text
D:\eis\ui-pdf-generator\src\components\forms\GeneratePdfForm.jsx
D:\eis\ui-pdf-generator\src\components\forms\BulkGenerateForm.jsx
```

## Acceptance Criteria

1. Dengan payload yang sama, output `cooperation_agreement` di production sama secara layout dengan development.
2. Halaman 3 dan seterusnya memiliki margin kanan yang normal, bukan `0`.
3. Tidak ada teks yang mepet atau keluar dari sisi kanan kertas.
4. `docDefinition.pageMargins` final untuk `cooperation_agreement` bernilai `[54, 88, 54, 78]` atau nilai lain yang disepakati, tetapi margin kanan harus lebih dari `0`.
5. Jika production memakai dynamic template, dynamic template sudah disamakan atau dinormalisasi agar layout sama dengan development.
6. Perbaikan tidak mengubah output template lain seperti payslip, BA, atau invoice.
7. Generate single PDF dan bulk generate untuk `cooperation_agreement` tetap berjalan.
8. Paragraf penutup `Demikianlah Perjanjian ini dibuat...` tampil normal sebelum tanda tangan dan tidak keluar dari margin kanan.
9. Kolom tanda tangan `PIHAK PERTAMA` dan `PIHAK KEDUA` tampil pada halaman yang sama.
10. File sample/regression output tersedia agar hasil bisa dicek ulang setelah deploy.

## Skenario Test yang Perlu Dilakukan

Backend:

- Generate `cooperation_agreement` di development menggunakan payload yang sama dengan kasus production.
- Generate `cooperation_agreement` di production/staging setelah fix menggunakan payload yang sama.
- Bandingkan halaman 1, 2, 3, dan halaman terakhir.
- Pastikan halaman 3 dan seterusnya tidak memiliki teks mepet ke kanan.
- Pastikan paragraf penutup `Demikianlah Perjanjian ini dibuat...` wrap normal dan tidak menyebabkan overflow sebelum bagian tanda tangan.
- Pastikan tanda tangan kedua belah pihak berada di halaman yang sama.
- Test ketika resolver memakai legacy template.
- Test ketika resolver menemukan dynamic template aktif untuk `cooperation_agreement`.
- Test bulk generate `cooperation_agreement`.
- Test `exel_cooperation_agreement` untuk memastikan tidak ikut rusak.

Frontend:

- Generate single PDF `cooperation_agreement` dari UI.
- Bulk generate `cooperation_agreement` dari UI.
- Pastikan payload yang dikirim UI sesuai dan tidak berubah format.

Manual/visual:

- Buka PDF hasil fix dan cek margin kanan dari halaman 1 sampai akhir.
- Bandingkan dengan `output/cooperation_agreement_production.pdf`.
- Cek paragraf penutup yang diawali `Demikianlah Perjanjian ini dibuat...` pada halaman akhir.
- Cek kolom tanda tangan `PIHAK PERTAMA` dan `PIHAK KEDUA` tidak terpisah halaman.
- Pastikan footer/logo/signature tetap tampil normal.

## Catatan Implementasi

- Fokus issue ini adalah konsistensi production vs development untuk template `cooperation_agreement`.
- Jangan lakukan refactor besar di luar flow PDF generation.
- Jangan mengubah wording legal template kecuali memang diperlukan untuk layout.
- Jangan menghapus support dynamic template tanpa validasi dampak ke company yang memakai fitur tersebut.
- Jika root cause berasal dari data production di database, dokumentasikan query/record yang diperbaiki.
- Setelah fix deploy, generate ulang sample production dan simpan hasil pembanding untuk validasi.
