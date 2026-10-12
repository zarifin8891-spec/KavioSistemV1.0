# Audit Integrasi KAVIO V2.0 — 12 Oktober 2026

## Kesimpulan
Status: **belum dapat ditetapkan Operational Ready**. Alur yang diuji dan saldo data saat ini konsisten, tetapi ada celah hak baca pembayaran upah, risiko kelengkapan agregasi pada volume besar, serta kebutuhan blueprint yang belum tertutup.

Audit ini tidak mengubah kode aplikasi atau struktur database. Skrip transaksi memakai rollback; pemeriksaan saldo dan schema bersifat baca saja. Nomor urut database yang memakai sequence dapat maju meskipun fixture di-rollback.

## Baseline dan batas pemeriksaan
- Branch: `kavio-v2.0-development`; remote baseline `571e1d6c5d0a566fa1e1d436dde07f82e0040bb6`.
- Database V2: `dkjtqqaqzmnoenatjrak`. V1/main tidak menjadi sasaran audit.
- Pemeriksaan: kode workspace V2, definisi fungsi/policy database aktif, advisors, rekonsiliasi, build, pengujian SQL dan output laporan.
- Dataset kecil: 2 SPK, 1 Sales, 6 progress perincian, 9 transaksi material, 1 pembayaran upah, 1 pengguna aktif berperan Direktur.
- Sumber cakupan: Blueprint Arsitektur Draft-08 dan keputusan terbaru Bapak dalam percakapan. Dokumen final terkonsolidasi beserta matriks migrasi fisik terbaru belum berhasil ditemukan. Temuan perbedaan blueprint di bawah harus disejajarkan dengan keputusan akhir sebelum dijadikan perubahan bisnis.
- Tidak dilakukan audit visual browser, pengukuran waktu klik tab di browser, load test, uji transaksi paralel, maupun UAT lengkap semua role. Pengujian hak baca Marketing menggunakan fixture sementara, bukan akun operasional.
- Build sukses pada workspace V2 yang berisi perubahan dari pekerjaan sebelumnya. Audit bukan pernyataan bahwa seluruh perubahan lokal identik dengan satu checkout bersih remote.

## Keputusan bisnis terbaru yang menjadi acuan
Satu database per proyek; impor awal hanya master/kavling/siteplan; tenor Cash Bertahap 1–12 bulan; tanggal bisnis transaksi material dapat berbeda dari tanggal input; UI Kartu Stok dihilangkan; engine histori stok tetap dipakai untuk kontrol internal. Perincian pekerjaan menjadi dasar progress/upah, satu mandor per item, retensi 5% dengan pengecualian yang disepakati. Retensi Kavling mengikuti akad dan persetujuan Direktur; Fasum mengikuti penutupan SPK dan persetujuan Direktur. Cetak dan transfer laporan memakai dataset sesuai filter.

Keputusan di atas mengesampingkan bagian Draft-08 yang lebih lama. Penghilangan UI Kartu Stok dan keputusan satu database per proyek bukan kekurangan implementasi.

## Temuan terurut
Prioritas P1 harus dituntaskan sebelum penetapan Operational Ready. P2 diselesaikan sebelum penggunaan dengan volume besar atau ditetapkan sebagai batas operasional yang jelas. Seluruh rekomendasi masih berupa rencana, belum diterapkan.

| ID | Prioritas | Kategori | Temuan dan bukti | Dampak / tindakan berikutnya |
|---|---|---|---|---|
| A01 | P1 | Hak akses, terkonfirmasi | Policy SELECT `wage_payment` dan `wage_payment_item` hanya memeriksa pengguna aktif. Fixture Marketing: izin bayar false, tetap dapat membaca 1 pembayaran upah; kuitansi penjualan tidak terlihat. Sumber: migration `20261012033126_wage_payments_and_retention.sql`. | Data pembayaran upah/retensi terbaca melalui API di luar kewenangan transaksi. Tetapkan hak baca keuangan secara eksplisit, selaraskan RLS, view dan route, lalu uji role positif/negatif. Menyembunyikan menu saja tidak cukup. |
| A02 | P1 | Material Control, gap blueprint | RAB tersedia: 1 template dan 105 item. Tidak ditemukan integrasi RAB pada aplikasi atau snapshot rencana material per SPK; perbandingan kebutuhan RAB vs aktual dan kontrol kelebihan belum tersedia. | Material Control sudah mencatat stok/pemakaian, belum mengontrol rencana vs aktual sebagaimana Draft-08. Konfirmasi cakupan final; bila tetap berlaku, lanjutkan snapshot RAB dan laporan deviasi melalui engine bersama Kavling/Fasum. |
| A03 | P1 | Persetujuan dan audit, gap blueprint | Fungsi aktif `save_sales_v2_atomic` menimpa tenor/pola pembayaran melalui upsert, atau menghapusnya saat jenis pembayaran berubah. Tidak ditemukan addendum, riwayat versi dan persetujuan perubahan syarat sales. | Syarat aktif dapat berubah tanpa jejak versi khusus. Selaraskan ketentuan addendum Draft-08; pisahkan koreksi draft dan perubahan perjanjian aktif. |
| A04 | P1 | Persetujuan material, gap blueprint | Fungsi aktif `post_spk_material_reconciliation_atomic` menerima HILANG_RUSAK dengan alasan lalu langsung POSTED menggunakan izin gudang. Tidak ada tahap persetujuan khusus Direktur/delegasi. | Pengurangan stok karena hilang/rusak belum memakai kontrol persetujuan yang disebut Draft-08. Tetapkan delegasi dan titik posting sebelum menambah workflow. |
| A05 | P1 | Persetujuan pembatalan, gap blueprint | Fungsi aktif `save_sales_cancellation_settlement_atomic` memeriksa PAYMENT_RECEIPT_WRITE; keputusan serta status pembayaran refund dapat di-upsert, pelaku dicatat sebagai pemutus. Tidak ada status persetujuan Direktur/delegasi atau versi keputusan khusus. | Persetujuan kasus pembatalan belum terpisah dari pencatatan pembayaran. Cocokkan dengan keputusan final, kemudian lindungi perubahan keputusan dan pembayaran refund. |
| A06 | P1 | Ketepatan KPI pada skala besar | `app/dashboard/page.tsx` membatasi data decision engine ke 50 SPK; data ini digunakan untuk rata-rata progress/health dan distribusi Project Health. Pembacaan Sales/Kavling Dashboard serta posisi Piutang tidak seluruhnya dipaginasi. | KPI bisa menggambarkan 50 SPK yang terburuk, bukan seluruh proyek; jumlah/saldo berisiko terpotong oleh batas respons API saat data membesar. Pisahkan agregat seluruh proyek dari daftar perhatian; uji lebih dari 50 SPK dan lebih dari batas API. Data kecil sekarang belum memunculkan kesalahan ini. |
| A07 | P2 | Pemeliharaan pengujian | `piutang_v2_rollback.sql` masih mengharapkan saldo konsumen 4 juta setelah dana jaminan dialihkan ke bank. Skrip KPR yang lebih baru mengharapkan saldo konsumen nol dan lulus. | Satu kegagalan berasal dari ekspektasi lama. Perbarui assertion setelah audit, pertahankan pembuktian nominal bruto, kas netto, piutang bank, pencairan bertahap dan pembatalan kuitansi. |
| A08 | P2 | Performa pemuatan data | Gudang membaca master/stok/permintaan lintas tab. Laporan mengambil semua hasil filter dalam batch 500 sebelum paging lokal; perubahan filter bisa memicu pemuatan ulang dataset besar. | Total/cetak/CSV lengkap, tetapi biaya transfer dan memori naik sesuai volume. Pertahankan kelengkapan output, pisahkan paging layar, agregat dan pengambilan ekspor; ukur browser sebelum menyebut penyebab delay. |
| A09 | P2 | Indeks | Advisor menemukan 2 FK tanpa indeks: `material_transaction_dibatalkan_oleh_fkey` dan `work_detail_progress_input_by_fkey`. | Tinjau query dan tambahkan indeks bila mendukung akses/relasi yang relevan. 44 indeks yang dilaporkan belum dipakai tidak menjadi alasan untuk langsung menghapus indeks pada dataset kecil. |

### Perbedaan cakupan yang perlu diselaraskan, bukan langsung dianggap bug
- Draft-08 mencantumkan dana titipan yang belum dialokasikan dan beberapa metode pembayaran dalam satu kuitansi. Form terkini memakai satu Kas/Bank/metode dan menolak kelebihan pembayaran. Keputusan final atas cakupan ini perlu dicatat.
- QR kuitansi sudah dibuat dari token barcode. Belum ditemukan jalur verifikasi status kuitansi publik/terotorisasi yang dimaksud Draft-08. Permintaan terbaru Bapak hanya memastikan QR; kebutuhan verifikasi perlu diselaraskan.
- Laporan Piutang terkini merupakan posisi saat ini. Laporan posisi historis per tanggal dan aging yang disebut Draft-08 belum dibuktikan tersedia.
- Advisor keamanan mencatat perlindungan terhadap password bocor belum aktif. Tinjau pengaturan Auth sebelum penggunaan operasional. Peringatan EXECUTE SECURITY DEFINER untuk authenticated bukan bukti kebocoran dengan sendirinya; fungsi memang perlu dapat dipanggil dan harus memeriksa kewenangan.

## Rekonsiliasi data aktif
Semua 16 indikator menghasilkan **0 anomali**.

| Area | Indikator |
|---|---|
| Sales/SPK | Sales aktif ganda per Kavling; SPK Kavling ganda; SPK aktif tanpa configured_at |
| Progress | Akumulasi progress item melebihi 100% |
| Material | Stok gudang negatif; stok SPK negatif; saldo gudang berbeda dari histori akhir; saldo SPK berbeda dari histori akhir |
| Upah/retensi | Sisa upah/retensi/retensi tersedia negatif; total header pembayaran berbeda dari detail; retensi POSTED tanpa pemberi persetujuan |
| Kas/piutang | Kas netto berbeda dari bruto minus dana jaminan; saldo konsumen negatif; saldo konsumen tidak sesuai rumus; saldo bank negatif; saldo bank tidak sesuai rumus |

Rumus yang diperiksa:
- Konsumen: total tagihan dikurangi pelunasan konsumen; transaksi pembatalan mempunyai saldo konsumen nol.
- Dana jaminan bank: nominal tagihan dikurangi penerimaan dana jaminan.
- Pencairan dana jaminan tidak dihitung kembali sebagai pelunasan konsumen.
- Kas netto pencairan KPR = nilai bruto dikurangi dana jaminan.

Sebagian cek persamaan membaca field dalam view yang sama. Ini adalah cek konsistensi, bukan pembuktian independen ledger seluruh saldo. Bukti perilaku transaksi berasal dari fixture regresi KPR/material/upah. Data kecil dan tidak adanya anomali saat ini tidak membuktikan kebenaran seluruh kemungkinan transaksi.

## Hasil pengujian
| Skrip di supabase/tests | Hasil |
|---|---|
| detailed_work_progress.sql | Lulus |
| fasum_wage_budget_and_configuration_gate.sql | Lulus |
| material_document_dates.sql | Lulus |
| chronological_stock_card.sql | Lulus; engine internal, bukan usulan mengembalikan UI |
| wage_payments_and_retention.sql | Lulus |
| piutang_v2_rollback.sql | Gagal: assertion dana jaminan lama, A07 |
| kpr_retention_items_rollback.sql | Lulus |
| guarantee_multi_item_rollback.sql | Lulus |
| receivable_reports_readonly.sql | Lulus |
| wage_report_period_ledger.sql | Lulus |

Pengujian tambahan:
- `node tests/report-output.cjs`: lulus; 1.251 baris terbaca melewati batas API, total 12.510, propagasi error, escape HTML/CSV dan penetralan teks mirip formula CSV.
- `npm run build` dengan konfigurasi V2: lulus.
- Seluruh tabel public memiliki RLS; view public dengan nama v_% memakai security_invoker; tidak ditemukan hak EXECUTE anon untuk fungsi public SECURITY DEFINER.
- Probe Marketing di-rollback dan menunjukkan celah baca A01.
- EXPLAIN ANALYZE posisi piutang aktif: 1 baris, execution 0,524 ms dan planning 2,180 ms pada snapshot kecil, dijalankan lewat koneksi administratif. Ini bukan waktu halaman/API dan bukan benchmark RLS semua role.
- Waktu panggilan pengujian SQL yang panjang mencakup transport/orchestrator; tidak dipakai sebagai bukti bahwa query database lambat.

## Global Foundation
Kontrak berulang tersedia untuk FormActions, FilterBar/Field/Actions, ReportHeading/Actions, TableTotals, TransactionHeader dan tabel. Token lebar tanggal/pencarian, jarak, nominal, subtotal, footer total serta cetak telah didokumentasikan di `docs/GLOBAL-UI-FOUNDATION.md`. Ini merupakan pemeriksaan pemakaian kode dan kontrak, belum pengesahan visual seluruh halaman.

Perbaikan audit harus tetap memakai Foundation untuk pola berulang. Jangan membuat pipeline atau panel tambahan hanya untuk menutup temuan yang sebenarnya terkait data/izin.

## Urutan pekerjaan sesudah audit
1. Tutup A01 dan koreksi assertion A07; uji role serta regresi pembayaran/retensi.
2. Koreksi A06: KPI lengkap dengan agregat server, daftar perhatian tetap terbatas; buktikan dengan data di atas batas.
3. Selaraskan baseline final untuk A02–A05 dan perbedaan cakupan. Implementasi kontrol bisnis mengikuti hasil penyelarasan, tanpa menambah persetujuan yang belum ditetapkan.
4. Lengkapi Material Control RAB sesuai scope final melalui engine bersama Kavling/Fasum.
5. Ukur pemuatan halaman dan volume realistis; tangani A08/A09 berdasarkan bukti.
6. UAT Bapak: satu skenario Cash Bertahap, satu KPR dengan jaminan multi-item, satu Kavling dengan beberapa mandor/pengecualian retensi, satu Fasum hingga tutup, rekonsiliasi sisa, serta pembatalan/refund sesuai aturan final.
7. Tetapkan Operational Ready setelah temuan P1 selesai, UAT diterima dan rollback/backup operasional dibuktikan.

## Kriteria penerimaan
Role tanpa hak baca upah tidak bisa membaca tabel/view/API terkait; total proyek konsisten di atas batas pagination; nominal KPR/kas/piutang bank tidak terhitung ganda; tidak ada overpayment upah/retensi; persetujuan retensi tidak dapat dilewati; penutupan SPK memeriksa sisa stok; kontrol blueprint yang masih berlaku tersedia dan telah diuji. Batas operasional serta perubahan cakupan harus dicatat sebelum penetapan siap operasi.
