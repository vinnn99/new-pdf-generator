'use strict'

module.exports = function musikTemplate(payloadData) {
    const {
        nama = '',
        judul = '',
        nik = '',
        address = '',
        pt = '',
        pencipta = '',
        asNama = '',
        bankName = '',
        npwp = '',
        imail = '',
        phone = '',
        norek = '',
        createdAt = new Date().toISOString()
    } = payloadData

    const imageHeader = null

    function toCamelCase(str) {
        if (!str) return ''
        return str.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        })
    }

    function generateLetterheadNumber(name) {
        const now = new Date()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const initials = (name || '').split(' ').map(function (w) { return w[0] || '' }).join('').toUpperCase().slice(0, 3)
        return initials + '/' + month + '/' + year
    }

    function formatPeriod(dateStr) {
        const start = new Date(dateStr)
        const end = new Date(start)
        end.setFullYear(end.getFullYear() + 2)
        const opts = { day: 'numeric', month: 'long', year: 'numeric' }
        return start.toLocaleDateString('id-ID', opts) + ' s/d ' + end.toLocaleDateString('id-ID', opts)
    }

    const _now = new Date()
    const _days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const _months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const indonesianDate = _days[_now.getDay()] + ', ' + _now.getDate() + ' ' + _months[_now.getMonth()] + ' ' + _now.getFullYear()

    const content = [
            {
                stack: [
                    { text: 'PERJANJIAN LISENSI', style: 'header', alignment: 'center' },
                    { text: `${toCamelCase(nama)}`, style: 'subheader', alignment: 'center', bold: true },
                    { text: `No. ${generateLetterheadNumber(nama)}`, style: 'subheader', alignment: 'center' },
                ],
                alignment: 'center',
                margin: [0, 0, 0, 0]
            },
            {
                text: [
                    'Perjanjian Kerjasama ',
                    { text: `${pt}`, style: 'boldUppercase' },
                    ' mengenai pemberian lisensi Konten "',
                    { text: `${judul}`, style: 'boldUppercase' },
                    '".'
                ],
                style: 'paragraph'
            },
            { text: `Perjanjian ini ditandatangani pada hari ${indonesianDate} oleh dan antara :`, style: 'paragraph' },
            {
                ol: [
                    {
                        text: [
                            { text: `${toCamelCase(nama)}`, style: 'boldUppercase' },
                            ' seorang subyek hukum individu mewakili dirinya sendiri beralamat di ',
                            { text: `${address}` },
                            ' dengan NIK ',
                            { text: `${nik}` },
                            {
                                text: [
                                    '. Untuk selanjutnya akan disebut sebagai ',
                                    { text: 'Pemberi Lisensi', style: 'boldUppercase' },
                                    ' (Licensor).'
                                ],
                                style: 'paragraph'
                            },
                        ],
                        style: 'paragraph'
                    },
                    {
                        text: [
                            { text: `${pt}`, style: 'boldUppercase' },
                            ', beralamat di Cetennial Tower Lantai 38 unit H, Jl. Jend. Gatot Subroto Kav 24-25, Karet Semanggi, Setiabudi, Jakarta Selatan, Kode Pos 12930, dalam hal ini diwakili oleh ',
                            { text: 'Lay Laberto', style: 'boldUppercase' },
                            ' dalam jabatannya sebagai Direktur pada perseroan tersebut, selanjutnya akan disebut sebagai ',
                            { text: 'Penerima Lisensi', style: 'boldUppercase' },
                            ' (Licensee).'
                        ],
                        style: 'paragraph'
                    },
                ],
                margin: [0, 0, 0, 0]
            },
            {
                text: [
                    'Pemberi Lisensi dan Penerima Lisensi masing-masing disebut juga sebagai "',
                    { text: 'Pihak', bold: true },
                    '" dan secara bersama-sama akan disebut sebagai "',
                    { text: 'Para Pihak', bold: true },
                    '".'
                ],
                style: 'paragraph'
            },
            { text: 'Para Pihak terlebih dahulu dengan ini menerangkan bahwa :', style: 'paragraph' },
            {
                type: 'upper-alpha',
                ol: [
                    {
                        text: [
                            'Pemberi Lisensi adalah subyek hukum Individual yang bertindak untuk dan atas nama ',
                            { text: `${nama}`, style: 'boldUppercase' },
                            ' dan sebagai pemilik hak eksploitasi atas semua karya musik dan Konten ',
                            { text: `${judul}`, style: 'boldUppercase' },
                            ' yang hak eksploitasinya telah dialihkan atau diberikan lisensi untuk eksploitasi-nya oleh Pemilik atau Pemberi Lisensi atau para penciptanya ',
                            { text: '("Pencipta")', style: 'boldUppercase' },
                            ' kepada Pemberi Lisensi; yang diuraikan pada Lampiran 2;'
                        ],
                        style: 'paragraph',
                    },
                    {
                        text: [
                            'Penerima Lisensi berniat untuk melakukan eksploitasi Konten ',
                            { text: `${judul}`, style: 'boldUppercase' },
                            ' yang hak eksploitasinya berada pada Pemberi Lisensi dengan memproduksi menjadi berbagai produk audio dan media dalam format digital app pada mobile dan komputer ',
                            { text: '("Konten")', style: 'boldUppercase' },
                            '. Penerima Lisensi akan mengadakan kerjasama dengan beberapa website atau aplikasi digital untuk dilakukan eksploitasi hak cipta ',
                            { text: '("Pelanggan")', style: 'boldUppercase' },
                            ' dalam bentuk Full Track.'
                        ],
                        style: 'paragraph',
                    },
                    {
                        text: [
                            'Konten Single/Musik ',
                            { text: `${judul}`, style: 'boldUppercase' },
                            ' yang hak eksploitasinya berada pada Pemberi Lisensi akan disimpan dalam server aplikasi milik Penerima Lisensi dan akan dipasarkan secara digital. Bahwa Pemberi Lisensi nantinya akan memperoleh pembayaran ',
                            { text: '("Bagi Hasil")', style: 'boldUppercase' },
                            ' dari penjualan Konten tersebut.'
                        ],
                        style: 'paragraph',
                    },
                    {
                        text: [
                            'Pemberi Lisensi setuju untuk memberikan lisensi yang diperlukan oleh Penerima Lisensi untuk pengadaan dan pemasaran Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" secara digital yang hak ekploitasinya berada pada Pemberi Lisensi berdasarkan syarat-syarat dan ketentuan-ketentuan yang ditetapkan didalam Perjanjian ini.'
                        ],
                        style: 'paragraph',
                    }
                ],
            },
            { text: 'Selanjutnya Para Pihak dengan ini menyatakan setuju dan terikat pada pernyataan-pernyataan syarat-syarat dan ketentuan-ketentuan sebagai berikut :', style: 'paragraph', pageBreak: 'before' },
            { text: 'Pasal 1', style: 'paragraph', alignment: 'center', bold: true },
            { text: 'JANGKA WAKTU PERJANJIAN DAN PERPANJANGANNYA', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Perjanjian ini diadakan untuk jangka waktu tersebut pada butir 5 Lampiran 1 Perjanjian ini ',
                            { text: '("Periode Perjanjian")', style: 'boldUppercase' },
                            ' kecuali diakhiri lebih awal atau menjadi berakhir lebih awal menurut ketentuan yang ditetapkan didalam Pasal 10 dibawah ini;'
                        ],
                        style: 'paragraph',
                        counter: 1.1
                    },
                    {
                        text: 'Kedua belah pihak dapat memperpanjang Masa Berlakunya Perjanjian sebelum Masa Berlakunya Perjanjian berakhir.',
                        style: 'paragraph',
                        counter: 1.2
                    }
                ],
                type: 'ordered'
            },
            { text: 'Pasal 2', style: 'paragraph', alignment: 'center', bold: true },
            { text: 'PEMBERIAN LISENSI', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Sepanjang Masa Berlakunya Perjanjian dan sepanjang berlakunya lisensi berdasarkan Perjanjian ini, Pemberi-Lisensi memberi lisensi atau izin kepada Penerima-Lisensi untuk melakukan tindakan-tindakan berikut ini dan seperti diuraikan pada Lampiran 1 atas Konten single/musik "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" yang hak eksploitasinya berada pada Pemberi-Lisensi dan menjadi bagian dari Karya Lisensi tersebut pada Ayat 2.2.,  sebagai berikut :'
                        ],
                        style: 'paragraph',
                        counter: 2.1
                    },
                    {
                        type: 'lower-alpha',
                        ol: [
                            {
                                text: [
                                    'Mengorganisir Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" termasuk melakukan editorial pada produk Konten Musik untuk App;'
                                ],
                                style: 'paragraph',
                            },
                            {
                                text: 'Menyimpan Konten dalam server aplikasi Penerima Lisensi;',
                                style: 'paragraph',
                            },
                            {
                                text: [
                                    'Memasarkan serta mempromosikan Konten melalui berbagai media termasuk media cetak dan elektronik dengan menyebutkan, menyatakan, mencatumkan judul Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '", nama Pencipta, dan dimana perlu juga nama Pemberi Lisensi;'
                                ],
                                style: 'paragraph',
                            },
                            {
                                text: 'Memberi akses kepada pelanggan untuk menggunakan Konten melalui telepon, komputer atau gawai mereka;',
                                style: 'paragraph',
                            },
                            {
                                text: 'Menggunakan Konten dalam semua jenis promosi termasuk promosi audio atau audio-visual;',
                                style: 'paragraph',
                            },
                            {
                                text: 'Mengadakan kerjasama dengan aggregator afiliasi yang dipandang baik oleh Penerima Lisensi jika diperlukan.',
                                style: 'paragraph',
                            },
                            {
                                text: [
                                    'Penerima Lisensi akan memberikan laporan kepada pihak Pemberi-Lisensi atas hasil promosi Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '";'
                                ],
                                style: 'paragraph',
                            }
                        ],
                    },
                    {
                        text: [
                            'Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" dengan ini diberikan lisensinya oleh Pemberi-Lisensi kepada Penerima-Lisensi untuk dieksploitasi sebagai Konten diuraikan pada daftar terlampir sebagai Lampiran 2 Perjanjian ini, beserta tambahan sepanjang Masa Berlakunya Perjanjian.'
                        ],
                        style: 'paragraph',
                        counter: 2.2
                    },
                    {
                        text: 'Lisensi ini diberikan hanya untuk digunakan didalam wilayah negara Republik Indonesia ("Territori").',
                        style: 'paragraph',
                        counter: 2.3
                    }
                ],
                type: 'ordered'
            },
            { text: 'Pasal 3', style: 'paragraph', alignment: 'center', bold: true, pageBreak: 'before' },
            { text: `KONTEN "${judul}"`, style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Setiap penambahan Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" ke dalam daftar Konten Lisensi atau penghapusan suatu Konten dari daftar Lisensi hanya sah jika diadakan atas pesetujuan tegas kedua belah pihak dan akan berlaku setelah dituangkan dalam suatu naskah yang ditandatangani oleh wakil-wakil yang sah dari kedua belah pihak;'
                        ],
                        style: 'paragraph',
                        counter: 3.1
                    },
                    {
                        text: 'Dalam hal edit Konten Lisensi, kedua belah pihak sepakat bahwa hal itu hanya bersifat redaksional dan tidak akan mengubah bagian ataupun jalinan Konten Lisensi yang utuh:',
                        style: 'paragraph',
                        counter: 3.2
                    },
                    {
                        text: 'Penambahan Konten setelah Pemberi-Lisensi menerima bagi hasil tidak akan dikenakan biaya tambahan oleh pihak Pemberi-Lisensi kepada Penerima-Lisensi.',
                        style: 'paragraph',
                        counter: 3.3
                    }
                ],
                type: 'ordered'
            },
            { text: 'Pasal 4', style: 'paragraph', alignment: 'center', bold: true, },
            { text: 'CARA PEMBAYARAN PEMBAGIAN KEUNTUNGAN DAN BAGI HASIL', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Penerima Lisensi akan menyampaikan suatu laporan tentang transaksi berdasarkan Data Konsolidasi ',
                            { text: '"Laporan Transaksi"', bold: true },
                            ' paling lambat 2 (dua) bulan setelah Pemberi Lisensi meminta Data Konsolidasi tersebut dari Penerima Lisensi. Atas ',
                            { text: '"Laporan Transaksi"', bold: true },
                            ' ini Pemberi Lisensi dapat meminta verifikasi kepada Penerima Lisensi dalam waktu 14 (empat belas) hari terhitung tanggal laporan tersebut. Apabila Pemberi Lisensi tidak mengajukan suatu keberatan atau permintaan verifikasi dalam batas waktu tersebut maka Pemberi Lisensi telah menerima baik kebenaran dari transaksi dalam ',
                            { text: '"Laporan Transaksi"', bold: true },
                            ' tersebut oleh karenanya tidak dapat mengajukan keberatan atau permintaan verifikasi dikemudian hari atas laporan yang bersangkutan;'
                        ],
                        style: 'paragraph',
                        counter: 4.1
                    },
                    {
                        text: 'Pemberi Lisensi akan menerbitkan invoice kepada Penerima Lisensi berdasarkan Laporan Transaksi dan Penerima Lisensi akan membayar invoice dalam waktu 30 (tiga puluh) hari terhitung tanggal diterimanya invoice bersangkutan;',
                        style: 'paragraph',
                        counter: 4.2
                    },
                    {
                        text: 'Pemberi Lisensi memahami bahwa jadwal pembayaran atas invoice sebagaimana diatur pada pasal 4.2 yang dilakukan oleh Penerima Lisensi hanyalah dilakukan setiap akhir bulan;',
                        style: 'paragraph',
                        counter: 4.3
                    },
                    {
                        text: 'Atas pembayaran pembagian keuntungan kepada Pemberi Lisensi akan berlaku ketentuan perpajakan Indonesia.',
                        style: 'paragraph',
                        counter: 4.4
                    }
                ],
                type: 'ordered'
            },
            { text: 'Pasal 5', style: 'paragraph', alignment: 'center', bold: true },
            { text: 'HAK MILIK INTELEKTUAL', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Pemberi Lisensi dengan ini mengaku dan menyatakan bahwa Pemberi Lisensi mempunyai hak dan/atau lisensi secara utuh dari Pencipta semua pihak yang mempunyai hak atau turut mempunyai hak milik intelektual atas Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" tetapi tidak terbatas pada copyrights dan hak untuk mendistribusikan melalui segala media dan saluran distribusi serta hak untuk menggunakan judul Lisensi untuk keperluan publikasi promosi melalui media cetak atau elektronik serta penggunaan Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" dan lainnya untuk promosi audio;'
                        ],
                        style: 'paragraph',
                        counter: 5.1
                    },
                    {
                        text: [
                            'Untuk menguatkan hak-hak tersebut pada ayat lalu maka atas setiap Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" Pemberi-Lisensi akan melengkapinya dengan surat pernyataan pencipta atau dokumen-dokumen konfirmasi tentang pemberian hak yang ditandatangani oleh Pemberi Lisensi dan pihak-pihak lain yang berhak atas Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '". Tetapi ketiadaan atau kurangnya surat atau dokumen demikian tidak mengurangi berlakunya pernyataan maupun jaminan Pemberi Lisensi tersebut pada ayat lalu dan ayat 6.1. ayat 6.2. dan ayat 6.3. dibawah ini;'
                        ],
                        style: 'paragraph',
                        counter: 5.2
                    },
                    {
                        text: [
                            'Pemberi Lisensi dari waktu-kewaktu sepanjang Masa Berlakunya Perjanjian dan sepanjang lisensi yang diberikan dalam Perjanjian ini berlaku akan menjaga dan memastikan agar hak-hak intelektual tersebut pada Ayat 5.1 tetap berlaku. Apabila dalam Masa Berlakunya Perjanjian dan sepanjang lisensi yang diberikan dalam Perjanjian ini berlaku terdapat hak atas Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" menjadi berakhir atau hilang maka Pemberi-Lisensi wajib memberitahukan dengan cara menyampaikan hal itu secara tertulis kepada Penerima-Lisensi paling sedikit 45 (empat puluh lima) hari sebelum berakhir atau diakhirinya hak tersebut. Semua beban dan kerugian yang timbul pada Penerima-Lisensi sebagai akibat dari kelalaian Pemberi-Lisensi melaksanakan pemberitahuan tersebut akan dipikul oleh Pemberi-Lisensi;'
                        ],
                        style: 'paragraph',
                        counter: 5.3
                    },
                    {
                        text: [
                            'Penerima Lisensi adalah pemilik hak milik intelektual satu-satunya dan untuk keseluruhannya atas Konten ',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '.'
                        ],
                        style: 'paragraph',
                        counter: 5.4
                    }
                ],
                type: 'ordered'
            },
            {
                stack: [
                    { text: 'Pasal 6', style: 'paragraph', alignment: 'center', bold: true, },
                    { text: 'PERNYATAAN JAMINAN', style: 'paragraph', alignment: 'center', bold: true },
                    {
                        ol: [
                            { text: `Pemberi Lisensi dengan ini menyatakan dan menjamin kepada Penerima Lisensi bahwa:`, style: 'paragraph', bold: true, counter: 6.1 },
                            {
                                type: 'lower-alpha',
                                ol: [
                                    { text: `Pemberi Lisensi berhak dan tidak mempunyai ikatan dengan pihak lain yang menjadi halangan hukum untuk mengadakan dan melaksanakan Perjanjian ini;`, style: 'paragraph', },
                                    { text: `Pemberi Lisensi diperbolehkan secara hukum atau telah memperoleh semua perizinan dan/atau persetujuan dari sisi korporasi yang diperlukan untuk bekerja sama di bawah Perjanjian ini;`, style: 'paragraph', },
                                    { text: `Pemberian lisensi oleh Pemberi Lisensi kepada Penerima Lisensi dan pelaksanaan hak-hak oleh Penerima Lisensi berdasarkan lisensi ini tidak akan melanggar hak milik intelektual pihak lain;`, style: 'paragraph', },
                                    {
                                        text: [
                                            'Pemberi Lisensi mempunyai semua persetujuan-persetujuan lisensi dan/atau hak milik intelektual secara utuh yang diperlukan untuk melaksanakan Perjanjian ini terutama hak untuk eksploitasi copyrights atas Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '";'
                                        ],
                                        style: 'paragraph',
                                    },
                                    {
                                        text: [
                                            'Pemberi Lisensi dari waktu ke waktu sepanjang Masa Berlakunya Perjanjian dan sepanjang berlakunya lisensi berdasarkan Perjanjian ini akan menjaga agar setiap lisensi dan setiap hak yang berkenaan dengan setiap Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '", tanpa kecuali, termasuk hak dan lisensi, tetap berlaku, yang memungkinkan Penerima Lisensi untuk secara sah menggunakan nama Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '" untuk aktivitas publikasi promosi baik melalui media cetak maupun elektronik;'
                                        ],
                                        style: 'paragraph',
                                    },
                                    {
                                        text: [
                                            'Pemberi Lisensi dari waktu kewaktu sepanjang Masa Berlakunya Perjanjian dan sepanjang berlakunya lisensi berdasarkan Perjanjian ini akan menjaga dan memastikan bahwa substansi Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '" tidak bersifat mempertentangkan atau merendahkan ras, agama, suku, golongan atau etnik tertentu, begitu pula tidak bertentangan dengan nilai-nilai kesusilaan dan kesopanan yang berlaku umum di Indonesia serta tidak melanggar hukum yang berlaku di Indonesia.'
                                        ],
                                        style: 'paragraph',
                                    }
                                ]
                            },
                            {
                                text: [
                                    { text: 'Pemberi Lisensi dengan ini juga menyatakan dan menjamin kepada Penerima Lisensi bahwa', style: 'bold' },
                                    ' setiap kerugian yang diderita oleh Penerima Lisensi baik secara langsung ataupun tidak langsung maupun karena beban tuntutan pihak lain terutama namun tidak terbatas pada tuntutan para pemegang hak milik intelektual lembaga kolektif royati atau pemerintah sebagai akibat dari dilanggarnya salah satu atau lebih jaminan-jaminan Pemberi Lisensi pada ayat 6.1. di atas maka kerugian itu sepenuhnya tanpa kecuali akan dipikul oleh Pemberi Lisensi;'
                                ],
                                style: 'paragraph',
                                counter: 6.2
                            },
                            { text: `Penerima Lisensi dengan ini menyatakan dan menjamin kepada Pemberi Lisensi bahwa:`, style: 'paragraph', bold: true, counter: 6.3 },
                            {
                                type: 'lower-alpha',
                                ol: [
                                    { text: `Penerima Lisensi berhak dan tidak mempunyai ikatan dengan pihak lain yang menjadi halangan hukum untuk mengadakan dan melaksanakan Perjanjian ini;`, style: 'paragraph', },
                                    { text: `Penerima Lisensi telah memperoleh semua perizinan dan/atau persetujuan dari sisi korporasi yang diperlukan untuk mengadakan Perjanjian ini;`, style: 'paragraph', },
                                    {
                                        text: [
                                            'Penerima Lisensi dari waktu-kewaktu sepanjang Masa Berlakunya Perjanjian dan sepanjang berlakunya lisensi berdasarkan Perjanjian ini akan menggunakan upaya yang wajar secara komersial demi menjaga dan memastikan bahwa Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '" hanya akan dieksploitasi dalam batas-batas dan untuk tujuan sebagaimana ditetapkan didalam Perjanjian ini;'
                                        ],
                                        style: 'paragraph',
                                    },
                                    {
                                        text: [
                                            'Penerima Lisensi tidak akan mengalihkan hak-hak atas Konten "',
                                            { text: `${judul}`, style: 'boldUppercase' },
                                            '" yang diperoleh berdasarkan Perjanjian ini baik sebagian maupun seluruhnya kepada pihak lain tanpa persetujuan tertulis terlebih dahulu dari Pemberi Lisensi'
                                        ],
                                        style: 'paragraph',
                                    }
                                ]
                            },
                            { text: `Penerima Lisensi dengan ini juga menyatakan dan menjamin kepada Pemberi Lisensi bahwa setiap kerugian yang diderita oleh Pemberi Lisensi baik secara langsung maupun karena tuntutan pihak lain terutama tuntutan para pemegang hak milik intelektual sebagai akibat dari dilanggarnya salah satu atau lebih jaminan-jaminan Penerima Lisensi pada ayat 6.3 diatas maka kerugian itu sepenuhnya tanpa kecuali akan dipikul oleh Penerima Lisensi;`, style: 'paragraph', counter: 6.4 },
                            { text: `Jaminan-jaminan dalam Pasal ini merupakan bagian penting dari Perjanjian ini yang tanpa adanya jaminan demikian Perjanjian ini tidak akan diadakan.`, style: 'paragraph', counter: 6.5 }
                        ]
                    }
                ],
                pageBreak: 'avoid'
            },
            {
                stack: [
                    { text: `Pasal 7`, style: 'paragraph', alignment: 'center', bold: true },
                    { text: `EKSKLUSIVITAS`, style: 'paragraph', alignment: 'center', bold: true },
                    {
                        ol: [
                            {
                                text: [
                                    'Sepanjang Masa Berlakunya Perjanjian dan sepanjang lisensi yang diberikan dalam Perjanjian ini berlaku Pemberi Lisensi tidak akan dengan nama dan dalam bentuk apapun memberi lisensi atas Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" kepada pihak lain yang berada didalam Territori untuk melakukan eksploitasi sebagai mobile Konten begitu juga tidak akan memberi lisensi atas Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" untuk platform sesuai lampiran 2 kepada pihak lain kecuali kepentingan eksploitasi dari Pemberi lisensi yang berada diluar Territori bisnis ',
                                    { text: `${pt}`, style: 'boldUppercase' },
                                    ' untuk melakukan eksploitasi pada aplikasi internet mobile atau gawai-gawai lain untuk dipasarkan kedalam Territori;'
                                ],
                                style: 'paragraph',
                                counter: 7.1
                            },
                            {
                                text: [
                                    'Bahwa pemberian lisensi yang diberikan oleh pemberi lisensi atas Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" kepada penerima lisensi adalah bersifat eksklusif diantara para pihak. Apabila dikemudian hari terdapat tuntutan dari pihak ketiga terkait pemberian lisensi ini maka pihak penerima lisensi tidak dapat dilibatkan sebagai pihak yang berperkara dan pemberi lisensi akan bertanggung jawab penuh terhadap segala kemungkinan tuntutan yang muncul dari pihak ketiga.'
                                ],
                                style: 'paragraph',
                                counter: 7.2
                            },
                            {
                                text: [
                                    'Sepanjang Masa Berlakunya Perjanjian dan sepanjang lisensi yang diberikan dalam Perjanjian ini berlaku Pemberi Lisensi tidak akan dengan nama dan dalam bentuk apapun mengubah Konten "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" kedalam format digital untuk disajikan atau dipasarkan di dalam maupun di luar Territori'
                                ],
                                style: 'paragraph',
                                counter: 7.3
                            }
                        ],
                        type: 'ordered'
                    }
                ],
                pageBreak: 'avoid'
            },
            { text: `Pasal 8`, style: 'paragraph', alignment: 'center', bold: true, pageBreak: 'before' },
            { text: `FORCE MAJEURE`, style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: `Force majeure adalah suatu kejadian yang berada diluar kendali pihak yang mempunyai tanggung jawab untuk menjalankan suatu kewajiban berdasarkan Perjanjian ini, sedemikian rupa sehingga kewajiban itu tidak dapat dilaksanakan atau terhalang pelaksanaannya, termasuk tetapi tidak terbatas pada kejadian bencana alam, kerusuhan atau huru-hara, dikeluarkannya kebijakan pemerintah yang melarang pelaksanaan kewajiban demikian, dan perang sipil.`,
                        style: 'paragraph',
                        counter: 8.1
                    },
                    {
                        text: `Jika ada force majeure yang menghalangi pelaksanaan suatu kewajiban berdasarkan Perjanjian ini wajib segera diberitahukan secara tertulis kepada pihak lainnya dalam tenggang waktu 2 (dua) hari sejak diketahui atau dialaminya force majeure itu, dengan menyebutkan dengan jelas peristiwa tersebut.`,
                        style: 'paragraph',
                        counter: 8.2
                    },
                    {
                        text: `Kewajiban yang terhalang pelaksanaannya karena force majeure harus dilaksanakan atau dilaksanakan kembali seketika setelah halangan itu berakhir atau berkurang.`,
                        style: 'paragraph',
                        counter: 8.3
                    }
                ],
                type: 'ordered'
            },
            {
                stack: [
                    { text: 'Pasal 9', style: 'paragraph', alignment: 'center', bold: true },
                    { text: 'BERAKHIR DAN DIAKHIRINYA PERJANJIAN', style: 'paragraph', alignment: 'center', bold: true },
                    {
                        ol: [
                            { text: `Perjanjian ini akan berakhir dengan sendirinya ketika Masa Berlakunya Perjanjian berakhir;`, style: 'paragraph', counter: 9.1 },
                            { text: `Perjanjian ini dapat diakhiri setiap saat melalui persetujuan pengakhiran yang diadakan secara tertulis oleh kedua belah pihak;`, style: 'paragraph', counter: 9.2 },
                            {
                                text: `Perjanjian ini dapat diakhiri lebih awal oleh salah satu pihak dengan cara memberitahukan secara tertulis kepada pihak lainnya paling sedikit 31 (tiga puluh satu) hari dimuka, apabila pihak yang belakangan :`,
                                style: 'paragraph',
                                counter: 9.3
                            },
                            {
                                type: 'lower-alpha',
                                ol: [
                                    { text: `melanggar ketentuan atau ketentuan-ketentuan dalam Perjanjian ini, dan tidak memperbaikinya dalam tenggang waktu yang ditetapkan dalam surat tegoran pertama yang diterbitkan oleh pihak yang terdahulu.`, style: 'paragraph', counter: 'a' },
                                    { text: `terhalang untuk melaksanakan suatu atau beberapa kewajiban dalam Perjanjian karena force majeure untuk waktu lebih dari 30 (tiga puluh) hari berturut-turut.`, style: 'paragraph', counter: 'b' },
                                    { text: `tidak menjalankan aktivitas bisnisnya untuk waktu lebih dari 14 (empat belas) hari berturut-turut.`, style: 'paragraph', counter: 'c' },
                                    { text: `mengajukan permohonan pailit atau penundaan pembayaran atau dimohonkan pailit oleh krediturnya.`, style: 'paragraph', counter: 'd' }
                                ]
                            },
                            { text: `Masing-masing pihak dapat mengakhiri Perjanjian ini secara sepihak dan seketika dengan menyampaikan pemberitahuan tertulis kepada pihak lainnya apabila pihak yang lainnya melakukan pelanggaran atas ketentuan atau ketentuan-ketentuan jaminan tersebut pada Pasal 6 diatas;`, style: 'paragraph', counter: 9.4 },
                            { text: `Untuk pengakhiran secara sepihak berdasarkan ketentuan dalam Pasal ini, Para Pihak dengan ini mengesampingkan ketentuan-ketentuan dalam Pasal 1266 dan Pasal 1267 Kitab Undang-undang Hukum Perdata Indonesia sepanjang mengenai diperlukannya izin dari hakim untuk pengakhiran suatu perjanjian.`, style: 'paragraph', counter: 9.5 }
                        ]
                    }
                ],
                pageBreak: 'avoid'
            },
            { text: `Pasal 10`, style: 'paragraph', alignment: 'center', bold: true, pageBreak: 'before' },
            { text: `AKIBAT BERAKHIR DAN DIAKHIRINYA PERJANJIAN`, style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            "Sejak tanggal berakhir atau diakhirinya Perjanjian ini maka semua lisensi yang diberikan oleh Pemberi Lisensi kepada Penerima Lisensi atas Konten \"",
                            { text: `${judul}`, style: "boldUppercase" },
                            "\" sebagaimana dimaksud dalam Perjanjian ini menjadi berakhir oleh karenanya Penerima Lisensi tidak lagi berhak memasarkan atau menjual Konten \"",
                            { text: `${judul}`, style: "boldUppercase" },
                            "\" tersebut. Menyimpang dari ketentuan pada ayat lalu semua pelanggan yang telah diberi akses kepada Konten akan tetap dapat akses dan menggunakan Konten tersebut;"
                        ],
                        style: "paragraph",
                        counter: 10.1
                    },
                    {
                        text: [
                            "Menyimpang dari ketentuan pada ayat lalu pada pengakhiran perjanjian berdasarkan ketentuan dalam ayat 9.4 maka lisensi atas Konten \"",
                            { text: `${judul}`, style: "boldUppercase" },
                            "\" yang dengan ini diberikan oleh Pemberi Lisensi kepada Penerima Lisensi akan berakhir 31 (tiga puluh satu) hari setelah Perjanjian diakhiri;"
                        ],
                        style: "paragraph",
                        counter: 10.2
                    },
                    {
                        text: "Tindakan pengakhiran perjanjian berdasarkan ketentuan dalam ayat 9.3. dan 9.4. tidak mengurangi tanggung jawab pada pihak bersalah yang menyebabkan pengakhiran itu untuk memenuhi seluruh kewajiban keuangan yang terhutang berdasarkan perjanjian ini - jika ada- dan membayar ganti rugi atas kerugian yang diderita oleh pihak lainnya menurut hukum yang berlaku;",
                        style: "paragraph",
                        counter: 10.3
                    },
                    {
                        text: "Para Pihak wajib mengadakan perhitungan dan pemberesan berkenaan dengan pelaksanaan perjanjian ini termasuk penyelesaian kewajiban keuangan yang timbul berdasarkan Perjanjian ini dalam tenggang waktu 30 (tiga puluh) hari terhitung tanggal berakhir atau diakhirinya perjanjian ini;",
                        style: "paragraph",
                        counter: 10.4
                    },
                    {
                        text: "Berakhir atau diakhiri perjanjian ini tidak akan mengakhiri berlakunya ketentuan dalam Pasal 6 dan Pasal 11 Perjanjian ini.",
                        style: "paragraph",
                        counter: 10.5
                    }
                ]
            },
            {
                stack: [
                    { text: "Pasal 11", style: "paragraph", alignment: "center", bold: true, pageBreak: "avoid" },
                    { text: "KERAHASIAAN", style: "paragraph", alignment: "center", bold: true },
                    {
                        ol: [
                            {
                                text: "Para Pihak dengan ini satu terhadap lainnya berjanji untuk menjaga semua informasi dan data yang diperoleh pihak yang satu dari pihak lainnya dalam rangka mengadakan dan melaksanakan Perjanjian ini sebagai informasi dan data rahasia yang harus dijaga dengan sepatutnya untuk mencegah kebocoran dan tidak akan membuka atau dengan nama atau cara apapun membiarkan terbuka atau mengalihkan atau memberikan atau berbagi data dan informasi itu dengan pihak lain tanpa persetujuan tegas dan tertulis terlebih dahulu dari pihak yang memberikan data dan informasi itu;",
                                style: "paragraph",
                                counter: 11.1
                            },
                            {
                                text: "Para Pihak dengan ini satu terhadap lainnya berjanji untuk tidak menggunakan atau memanfaatkan data dan informasi itu untuk tujuan atau kepentingan lain dari sekedar untuk mengadakan dan menjalankan syarat-syarat dalam Perjanjian ini;",
                                style: "paragraph",
                                counter: 11.2
                            },
                            {
                                text: "Informasi dan data mengenai identitas Pelanggan yang diberikan atau secara teknis menjadi didapat atau dapat diakses oleh Pemberi-Lisensi akan berstatus sebagai data dan informasi rahasia yang dimaksud dalam Pasal ini.",
                                style: "paragraph",
                                counter: 11.3
                            }
                        ]
                    }
                ],
                pageBreak: "avoid"
            },
            {
                stack: [
                    { text: 'Pasal 12', style: 'paragraph', alignment: 'center', bold: true, pageBreak: 'before' },
                    { text: 'KETENTUAN TAMBAHAN\n', style: 'paragraph', alignment: 'center', bold: true },
                    {
                        ol: [
                            {
                                text: 'Para Pihak dengan ini menetapkan ketentuan tambahan terhadap ketentuan-ketentuan dalam Perjanjian ini akan diuraikan pada Lampiran 1.',
                                style: 'paragraph',
                                counter: 12.1
                            }
                        ]
                    }
                ]
            },
            { text: 'Pasal 13', style: 'paragraph', alignment: 'center', bold: true },
            { text: 'LAIN-LAIN', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: 'Semua perjanjian atau kesepakatan yang diadakan sebelumnya diantara Para Pihak mengenai pokok Perjanjian ini dengan nama dan dalam bentuk apapun baik secara lisan maupun tertulis menjadi tidak berlaku lagi sejak ditandatanganinya Perjanjian ini kecuali sekedar kesepakatan atau perjanjian yang secara tegas dicantumkan dalam naskah Perjanjian ini;',
                        style: 'paragraph',
                        counter: 13.1
                    },
                    {
                        text: 'Perubahan tambahan atau penggantian terhadap syarat-syarat atau bagian-bagian dari Perjanjian ini hanya sah dan mengikat apabila diadakan dengan persetujuan kedua belah pihak dan dituangkan dalam naskah yang ditandatangani oleh wakil-wakil yang sah dari masing-masing pihak;',
                        style: 'paragraph',
                        counter: 13.2
                    },
                    {
                        text: 'Semua lampiran Perjanjian ini adalah merupakan bagian tetap dan essensial dari naskah Perjanjian ini.',
                        style: 'paragraph',
                        counter: 13.3
                    }
                ]
            },
            { text: 'Pasal 14', style: 'paragraph', alignment: 'center', bold: true },
            { text: 'KOMUNIKASI', style: 'paragraph', alignment: 'center', bold: true },
            {
                ol: [
                    {
                        text: [
                            'Semua komunikasi diantara Para Pihak mengenai Perjanjian ini dan pelaksanaannya akan dilakukan kealamat koresponden tersebut pada butir 10 ',
                            { text: 'Lampiran 1', bold: true },
                            ' Perjanjian ini;'
                        ],
                        style: 'paragraph',
                        counter: 14.1
                    },
                    {
                        text: 'Setiap perubahan alamat komunikasi harus diberitahukan kepada pihak lainnya 7 (tujuh) hari dimuka.',
                        style: 'paragraph',
                        counter: 14.2
                    }
                ]
            },
            {
                stack: [
                    {
                        text: 'Pasal 15',
                        style: 'paragraph',
                        alignment: 'center',
                        bold: true,
                        pageBreak: 'before'
                    },
                    {
                        text: 'PENYELESAIAN PERSELISIHAN',
                        style: 'paragraph',
                        alignment: 'center',
                        bold: true
                    },
                    {
                        ol: [
                            {
                                text: 'Perselisihan yang timbul diantara Para Pihak mengenai Perjanjian ini atau pelaksanaannya akan terlebih dahulu diselesaikan secara musyawarah;',
                                style: 'paragraph',
                                counter: 15.1
                            },
                            {
                                text: 'Apabila karena apapun dalam 30 (tiga puluh) hari sejak terjadinya perselisihan itu musyawarah tidak dapat diadakan atau musyawarah yang diadakan gagal mencapai penyelesaian yang disetujui oleh kedua belah pihak maka masing-masing pihak dapat mengajukan perselisihan itu kemuka Badan Arbitrase Nasional Indonesia (BANI) di Jakarta sesuai dengan ketentuan-ketentuan dalam Undang-undang Nomor 30 tahun 1999 tentang Arbitrase dan Alternatif Penyelesaian Sengketa.',
                                style: 'paragraph',
                                counter: 15.2
                            },
                        ]
                    },
                ],
                pageBreak: 'avoid'
            },
            {
                text: 'Perjanjian ini dibuat dan ditandatangani dalam rangkap dua ditandatangani oleh perwakilan yang sah dengan bermeterai cukup dan berlaku sebagai asli serta mempunyai kekuatan hukum yang sama.',
                style: 'paragraph',
            },
            {
                stack: [
                    {
                        columns: [
                            {
                                width: '50%',
                                stack: [
                                    { text: 'Pemberi-Lisensi', style: 'subheader', alignment: 'left' },
                                    // signature image removed; user will sign physically
                                    { text: '\n\n\n_____________________', alignment: 'left', margin: [0, 30, 0, 0] },
                                    { text: toCamelCase(nama), alignment: 'left', margin: [0, 10, 0, 10] }
                                ]
                            },
                            {
                                width: '50%',
                                stack: [
                                    { text: 'Penerima-Lisensi', style: 'subheader', alignment: 'right' },
                                    { text: 'PT. MAGDA INOVASI CEMERLANG', alignment: 'right', bold: true },
                                    { text: '\n\n\n_____________________', alignment: 'right', margin: [0, 100, 0, 0] },
                                    {
                                        text: [
                                            { text: 'Lay Laberto\n', alignment: 'right' },
                                            { text: 'Direktur Lapanbar', alignment: 'right' }
                                        ]
                                    }
                                ],
                                alignment: 'right'
                            }
                        ],
                        margin: [0, 0, 0, 30]
                    }
                ],
                pageBreak: 'avoid'
            },
            { text: '', pageBreak: 'before' },
            { text: 'DAFTAR LAMPIRAN', style: 'paragraph' },
            { text: 'Lampiran 1 :', style: 'paragraph' },
            {
                ol: [
                    {
                        table: {
                            widths: ['auto', '*'],
                            body: [
                                [
                                    { text: 'Territory', style: 'paragraph' },
                                    { text: ': Indonesia', style: 'paragraph' }
                                ],
                                [
                                    { text: 'Format', style: 'paragraph' },
                                    { text: ': Konten Musik Full Track dan Voice Content', style: 'paragraph' }
                                ],
                                [
                                    { text: 'Platform', style: 'paragraph' },
                                    { text: ': Meta Youtube dan saluran distribusi digital. Lainnya.', style: 'paragraph' }
                                ],
                                [
                                    { text: 'Media', style: 'paragraph' },
                                    { text: ': Mobile telephone website dan semua media yang Memungkinkan.', style: 'paragraph' }
                                ],
                                [
                                    { text: 'Period', style: 'paragraph' },
                                    { text: `: ${formatPeriod(createdAt)}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'Eksklusif/Non-eksl.', style: 'paragraph' },
                                    { text: ': Eksklusif', style: 'paragraph' }
                                ]
                            ]
                        },
                        layout: 'noBorders'
                    },
                    {
                        text: `Revenue Share/Bagi Hasil : 30% (tiga puluh persen) untuk Penerima Lisensi ${pt} 70% (tujuh puluh persen) untuk Pemberi Lisensi ${toCamelCase(nama)} Profit setelah pengurangan biaya promo relevan. Semua pembayaran harus dilaksanakan bersih dari segala potongan pajak atau potongan lainnya yang dipersyaratkan oleh undang-undang.`,
                        style: 'paragraph'
                    },
                    {
                        text: 'Alamat Komunikasi :',
                        style: 'paragraph'
                    },
                    {
                        table: {
                            widths: ['auto', '*'],
                            body: [
                                [
                                    { text: 'NAMA', style: 'paragraph' },
                                    { text: `: ${toCamelCase(nama)}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'EMAIL', style: 'paragraph' },
                                    { text: `: ${imail}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'No tlp', style: 'paragraph' },
                                    { text: `: ${phone}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'No Rekening', style: 'paragraph' },
                                    { text: `: ${norek}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'A/N', style: 'paragraph' },
                                    { text: `: ${asNama}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'Nama Bank', style: 'paragraph' },
                                    { text: `: ${bankName}`, style: 'paragraph' }
                                ],
                                [
                                    { text: 'NPWP', style: 'paragraph' },
                                    { text: `: ${npwp}`, style: 'paragraph' }
                                ]
                            ]
                        },
                        layout: 'noBorders'
                    },
                    {
                        text: [
                            'Ketentuan Tambahan : Pemberi Lisensi wajib mempromosikan Konten "',
                            { text: `${judul}`, style: 'boldUppercase' },
                            '" dan website Penerima Lisensi di media sosial milik Pemberi Lisensi (Facebook, Twitter, Instagram, dan Media Sosial lainnya) atas keberadaaan musik app milik Penerima Lisensi.'
                        ],
                        style: 'paragraph'
                    }
                ]
            },
            {
                text: 'Lampiran 2 : DAFTAR KONTEN',
                style: 'paragraph',
            },
            {
                stack: [
                    {
                        ol: [
                            {
                                text: [
                                    'Materi yang dipasarkan dibawah nama "',
                                    { text: `${judul}`, style: 'boldUppercase' },
                                    '" termasuk beserta video, foto, lagu, lirik lagu, material promosi dan material lain yang disebutkan di dalam Perjanjian ini dan material lain yang disepakati di antara Para Pihak dari masa ke masa.'
                                ],
                                style: 'paragraph'
                            },
                            {
                                text: 'Daftar Konten/Lagu:',
                                listType: 'none',
                                style: 'paragraph',
                                margin: [0, 10, 0, 0]
                            },
                            {
                                type: 'lower-alpha',
                                ol: [
                                    {
                                        text: `"${judul}"`, bold: true,
                                        style: 'paragraph',
                                    }
                                ],
                                style: 'paragraph',
                                margin: [0, 10, 0, 0]
                            }
                        ]
                    }
                ]
            },
        ];

        // build docDefinition from content
        const docDefinition = {
            content: content,
            defaultStyle: {
                font: 'Roboto'
            },
            styles: {
                header: { fontSize: 16, bold: true, margin: [0, 20, 0, 10] },
                subheader: { fontSize: 12, margin: [0, 10, 0, 5] },
                paragraph: { fontSize: 11, margin: [0, 5, 0, 5], alignment: 'justify' },
                footer: { fontSize: 10, margin: [0, 10, 0, 10] },
                signaturePlaceholder: { fontSize: 12, italics: true },
                boldUppercase: {
                    bold: true,
                    textTransform: 'uppercase'
                }
            },
            pageMargins: [40, 80, 40, 40],
            footer: function (currentPage, pageCount) {
                return {
                    columns: [
                        { text: 'RAHASIA', bold: true, alignment: 'left', margin: [70, 10, 0, 0] },
                        { text: `Halaman ${currentPage} dari ${pageCount}`, alignment: 'center', margin: [-50, 10, 0, 0] },
                    ]
                };
            },
            header: function (currentPage, pageCount, pageSize) {
                if (!imageHeader) return null;
                return {
                    image: imageHeader,
                    alignment: 'center',
                    width: pageSize.width,
                    margin: [0, 0, 0, 0]
                };
            }
        };

    return docDefinition
}