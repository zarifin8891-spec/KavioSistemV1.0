# KAVIO V2.0 — kandidat baseline Operational Ready

Tanggal pemeriksaan: 13 Oktober 2026 (Asia/Jakarta).
Status: UAT diterima pengguna; pemeriksaan fungsional akhir lulus. Penetapan Operational Ready final menunggu bukti backup dan uji pemulihan terpisah.

## Identitas baseline

- Repository: zarifin8891-spec/KavioSistemV1.0.
- Branch: kavio-v2.0-development.
- Commit aplikasi: 0766906a510769c51744db9db6ac70e40029bd1a.
- Project database: Kavio_V2.0 / dkjtqqaqzmnoenatjrak, ACTIVE_HEALTHY.
- Deployment aplikasi: Vercel berhasil, https://kavio-sistem-v1-0-git-kavio-v20-development-zarifin8891-spec.vercel.app.
- Migrasi terakhir aplikasi: 20261013081642_retention_requires_finished_spk.sql.
- V1/main dan database V1 tetap menjadi baseline terpisah. Tidak ada promosi ke main pada tahap ini.

## Cakupan yang dikunci

Satu database per proyek. Sales Cash/Cash Bertahap/KPR, Piutang/Penerimaan dan histori pembayaran, dana jaminan bank, pembatalan/refund dengan persetujuan, SPK Kavling/Fasum, konfigurasi dan progress pekerjaan, material multibarang, snapshot RAB, rekonsiliasi serta pengajuan hilang/rusak, pembayaran upah dan retensi, laporan/cetak/CSV, Siteplan, Dashboard, serta hak akses menggunakan Global Foundation.

Cash/Cash Bertahap mencatat akad setelah harga jual lunas; KPR mencatat akad sebelum pencairan bank. AKAD/SOLD tetap dapat dibuatkan SPK pertama. Penutupan SPK memerlukan seluruh pekerjaan selesai dan rekonsiliasi sisa material. Upah dipilih melalui rekap SPK/tanggal progress/mandor; retensi melalui rekap seluruh periode SPK selesai/mandor. Retensi Kavling juga menunggu AKAD dan persetujuan Direktur. Kontrol RAB berupa peringatan; pemblokiran transaksi kelebihan RAB tidak termasuk baseline ini. Kartu Stok tidak ditampilkan dalam menu pengguna.

## Bukti pemeriksaan

Penerimaan UAT berdasarkan pernyataan pengguna bahwa pengujian sudah OK dan permintaan melanjutkan Operational Ready. Ini bukan klaim bahwa agen melakukan pengujian browser lengkap sendiri.

Pada pemeriksaan akhir: build produksi lulus; tests/report-output.cjs, tests/payment-history.cjs, dan tests/wage-payment-groups.cjs lulus. Pembacaan lengkap 1.251 baris, saldo aktif/kuitansi batal, pelunasan KPR bruto versus uang bersih, grouping upah/retensi, alokasi proporsional dua desimal dan batas pembayaran diuji.

Rekonsiliasi database melalui supabase/tests/v2_integration_audit_readonly.sql: 23 indikator, seluruhnya nol anomali. Pengujian transaksi rollback sebelumnya mencakup Sales/refund, KPR/jaminan, material/RAB/hilang-rusak, SPK setelah AKAD, progress perincian, kelayakan retensi SPK selesai serta hak akses. Data fixture tidak dipertahankan.

Pengukuran EXPLAIN ANALYZE sebagai authenticated Direktur pada dataset saat pemeriksaan:

| Query | Waktu eksekusi DB | Baris hasil |
| --- | ---: | ---: |
| Dashboard summary | 4,314 ms | 1 |
| Posisi piutang | 2,742 ms | 4 |
| Stok SPK | 2,039 ms | 3 |
| Settlement upah | 2,984 ms | 17 |

Pengukuran ini hanya waktu query database, bukan latensi jaringan/render browser atau uji beban. Dataset masih kecil. Audit performa navigasi/volume besar A08 belum ditutup dengan benchmark menyeluruh.

Advisor mempertahankan catatan sebelumnya: 51 RPC SECURITY DEFINER authenticated yang diperiksa izin, perlindungan password bocor belum aktif, dua FK tanpa indeks pendukung, dan indeks belum terpakai pada dataset kecil. Tidak ditemukan kategori keamanan baru dalam pemeriksaan ini. Temuan tersebut tetap dicatat untuk tindak lanjut; dokumen ini tidak menyatakan seluruh advisor bersih.

## Gate yang belum dibuktikan

1. Backup database terbaru beserta tanggal, cakupan, lokasi penyimpanan dan kebijakan pengulangan/retensinya. GitHub menyimpan kode/migrasi, bukan backup isi database.
2. Backup aset Storage yang digunakan, termasuk Siteplan jika disimpan di Storage. Backup database Supabase tidak mencakup isi objek Storage.
3. Pemulihan backup pada lingkungan terpisah, kemudian pemeriksaan jumlah data, 23 rekonsiliasi, akses pengguna, Siteplan dan transaksi contoh. Belum ada uji restore yang dilakukan pada tahap ini.
4. Batas kehilangan data dan waktu pemulihan operasional perlu ditetapkan berdasarkan jadwal backup dan hasil uji; belum ada RPO/RTO yang dijamin.

Halaman pemeriksaan backup: https://supabase.com/dashboard/project/dkjtqqaqzmnoenatjrak/database/backups/scheduled.
Dokumentasi: https://supabase.com/docs/guides/platform/backups.
Jika backup terkelola tidak tersedia pada paket proyek, siapkan ekspor terjadwal menggunakan CLI/pg_dump serta salinan aset terpisah. Paket proyek belum diverifikasi; tidak diasumsikan memakai backup otomatis.

## Pemulihan dan perubahan berikutnya

Jika rilis frontend bermasalah, rollback ke deployment baseline di Vercel. Ini tidak mengembalikan isi database atau menghapus migrasi. Pemulihan data memerlukan backup yang sudah diuji, dilakukan di lingkungan terpisah lebih dahulu. Tidak ada restore ke database aktif atau penghapusan data yang diotorisasi oleh pemeriksaan ini.

Sesudah gate backup/pemulihan terbukti, catat referensi bukti, tutup status kandidat dan buat tag rilis final dari baseline yang disetujui. Perbaikan bug berikutnya menggunakan patch V2.0.x; pengembangan fitur baru memakai branch terpisah. Tidak ada tag Operational Ready final yang dibuat sebelum gate tersebut selesai.
