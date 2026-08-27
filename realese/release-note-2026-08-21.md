# Release Note - Event Weekly Payslip

Tanggal rilis: 2026-08-21

## Ringkasan
Rilis ini menambahkan template `event_weekly_payslip` untuk kebutuhan slip gaji mingguan event. Template ini mengikuti pola payslip existing, memakai logo Exel, default perusahaan `PT. EXEL INTEGRASI SOLUSINDO`, judul `SLIP GAJI`, serta mendukung pendapatan harian berdasarkan tanggal kunjungan.

## Backend
- Template baru `event_weekly_payslip` tersedia di backend.
- Logo template menggunakan `resources/images/exel-logo.png`.
- Header bagian `PENDAPATAN` dan `POTONGAN` memakai warna yang disesuaikan dengan warna logo.
- Field wajib template: `employeeName` dan `employeeId`.
- Pendapatan dikirim sebagai array `visitEarnings` dengan item:
  - `tgl_date`
  - `tgl_value`
- Potongan yang didukung:
  - `adjustment`
  - `poTelat`
  - `kasbon`
- Nama file mengikuti pola slip:
  - `<periode>.event_weekly_payslip.<employeeId>.<employeeName>.<unique>.pdf`
- Bulk generate `event_weekly_payslip` membuat `batch_id` dan masuk ke Batch IDs.

## Endpoint
- Single generate PDF:
  - `POST /api/v1/generate-pdf`
  - `template: "event_weekly_payslip"`
- Send single email:
  - `POST /api/v1/send/event_weekly_payslip`
- Bulk generate PDF:
  - `POST /api/v1/bulk/event_weekly_payslip`
- Bulk send email:
  - `POST /api/v1/send-event-weekly-payslip-emails`
- Batch history:
  - `GET /api/v1/batches?template=event_weekly_payslip&page=1&perPage=10`

## Format Payload Single
```json
{
  "template": "event_weekly_payslip",
  "email": "user@example.com",
  "data": {
    "companyName": "PT. EXEL INTEGRASI SOLUSINDO",
    "employeeId": "EIS001",
    "employeeName": "BUDI SANTOSO",
    "status": "ACTIVE",
    "area": "JAKARTA",
    "position": "EVENT CREW",
    "npwp": "09.123.456.7-890.000",
    "workingDays": 5,
    "periode": "Juli 2026",
    "description": "Periode kunjungan 25-31 Juli 2026",
    "visitEarnings": [
      { "tgl_date": "2026-07-25", "tgl_value": 0 },
      { "tgl_date": "2026-07-26", "tgl_value": 0 },
      { "tgl_date": "2026-07-27", "tgl_value": 295000 },
      { "tgl_date": "2026-07-28", "tgl_value": 295000 },
      { "tgl_date": "2026-07-29", "tgl_value": 295000 },
      { "tgl_date": "2026-07-30", "tgl_value": 295000 },
      { "tgl_date": "2026-07-31", "tgl_value": 295000 }
    ],
    "adjustment": 0,
    "poTelat": 0,
    "kasbon": 0
  }
}
```

## Format Excel Bulk Generate
Header pendapatan memakai tanggal sebagai nama kolom. Nilai pada masing-masing kolom tanggal akan dikonversi menjadi item `visitEarnings`.

Kolom yang disarankan:

```text
NIK | employeeName | STATUS | AREA | JABATAN | NPWP | JUMLAH HK | PERIODE | DESKRIPSI | 25/07/2026 | 26/07/2026 | 27/07/2026 | 28/07/2026 | 29/07/2026 | 30/07/2026 | 31/07/2026 | ADJUSTMENT | POT TELAT | KASBON | email | callback_url | callback_header
```

Catatan:
- `NIK` dipakai sebagai `employeeId`.
- `employeeName` wajib diisi.
- Kolom tanggal dapat disesuaikan dengan periode kerja aktual.

## Format Excel Bulk Send Email
Endpoint: `POST /api/v1/send-event-weekly-payslip-emails`

Kolom yang disarankan:

```text
sentTo | NIK | employeeName | periode | body | cc | bcc
```

Catatan:
- `sentTo`, `NIK` atau `employeeId`, dan `employeeName` wajib diisi.
- Endpoint ini tidak membutuhkan `batch_id`.
- Lampiran dicari berdasarkan template `event_weekly_payslip`, periode, NIK/employeeId, dan employeeName.

## Frontend
- Template `event_weekly_payslip` tersedia di Generate Single PDF.
- Template `event_weekly_payslip` tersedia di Send Single Email.
- Mode `event_weekly_payslip` tersedia di Bulk Generate PDF.
- Mode `event_weekly_payslip` tersedia di Bulk Send Email.
- Batch IDs menampilkan batch untuk `event_weekly_payslip`.
- Form single mendukung input `visitEarnings` sebagai array tanggal dan nilai.

## File Template dan Contoh
- Backend bulk template:
  - `resources/templates/event_weekly_payslip-bulk-template.xlsx`
- Frontend bulk generate template:
  - `public/templates/event_weekly_payslip.xlsx`
- Frontend bulk send email template:
  - `public/templates/send-event-weekly-payslip-emails.xlsx`
- Contoh PDF:
  - `output/event_weekly_payslip.sample.pdf`

## Dokumentasi
- `API_DOCUMENTATION.md` backend sudah diperbarui.
- `API_DOCUMENTATION.md` frontend sudah diperbarui.
- Dokumentasi mencakup contoh payload single, endpoint baru, format Excel, bulk send email, dan batch history.

## Validasi
Skenario yang sudah divalidasi:
- Template `event_weekly_payslip` dapat dirender.
- Required fields `employeeName` dan `employeeId` berjalan.
- Bulk send email `event_weekly_payslip` dapat menemukan PDF hasil bulk generate.
- Frontend submit bulk send email memakai endpoint `send-event-weekly-payslip-emails`.
- Dokumentasi Markdown tetap valid secara struktur code fence.

Command test yang sudah pernah dijalankan pada implementasi fitur:
- `npm test -- --files test/unit/event_weekly_payslip_template.spec.js`
- `npm test -- --files test/functional/api_endpoint_matrix.spec.js --grep "send-event-weekly-payslip-emails"`
- `npm test -- src/api/bulkApi.test.js src/components/forms/SendEmailsForm.test.jsx`
