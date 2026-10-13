# KAVIO V2.0 — kandidat baseline Operational Ready

Tanggal pemeriksaan: 13 Oktober 2026 (Asia/Jakarta).
Status: UAT diterima pengguna; backup, restore data lokal, rekonsiliasi dan pemeriksaan hak akses database lulus. Kandidat siap untuk penutupan operasional setelah salinan backup kedua dan pengujian runtime pemulihan dibuktikan. Tag Operational Ready final belum dibuat.

## Identitas baseline

- Repository: zarifin8891-spec/KavioSistemV1.0.
- Branch: kavio-v2.0-development.
- Commit aplikasi: 0d359fa3579f91c8b6274734c1b356eea285188b.
- Project database: Kavio_V2.0 / dkjtqqaqzmnoenatjrak, ACTIVE_HEALTHY.
- Deployment aplikasi: Vercel berhasil, https://kavio-sistem-v1-0-git-kavio-v20-development-zarifin8891-spec.vercel.app.
- Migrasi terakhir aplikasi: 20261013081642_retention_requires_finished_spk.sql.
- Tambahan skema nomor SPK permanen: supabase/sql/spk_document_numbers.sql, sudah diterapkan; wajib disertakan pada setup database kosong karena berada di luar daftar migrasi.
- Script verifikasi restore: supabase/tests/v2_restore_verification.sql pada commit f494241ded54b576b668e82cb3c5a1243c503294.
- Edge Function kavio-user-admin versi 2 telah di-deploy ke V2. Source ada di supabase/functions/kavio-user-admin/index.ts; deployment function dan konfigurasi environment terpisah dari dump database.
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

## Backup dan restore data: lulus 13 Oktober 2026

Supabase V2 menggunakan paket Free; backup terkelola tidak tersedia pada dashboard saat diperiksa. Backup manual dibuat dengan pg_dump 17.11 melalui Session Pooler port 5432, format custom, mencakup schema public, kavio_internal, auth dan storage.

- File: C:\Users\Zenal\Documents\Backup-KAVIO\KAVIO-V2-20261013-203315.backup.
- Waktu pembuatan arsip: 13 Oktober 2026 20:33:15 Asia/Jakarta.
- Ukuran: 1.039.941 byte; 1.389 TOC entries.
- Target restore: database lokal kosong kavio_v2_restore_test_20261013 pada PostgreSQL 17.11, localhost:5432. Tidak dilakukan restore ke Supabase aktif.
- pg_restore memakai --single-transaction, --no-owner dan --no-acl. Persiapan lokal menyediakan role authenticated NOLOGIN dan extension pgcrypto/uuid-ossp.
- Bukti pengguna: pesan RESTORE UJI BERHASIL dan screenshot Capture3(20261013-140303).PNG menunjukkan hasil pemeriksaan berikut. Jumlah sesuai pembacaan sumber dan seluruh 23 indikator rekonsiliasi nol.

| Kelompok data | Sumber / hasil restore |
| --- | ---: |
| Kavling | 107 |
| Sales | 4 |
| SPK | 3 |
| Progress | 15 |
| Perincian progress | 17 |
| Kuitansi | 13 |
| User login | 3 |
| Profil user | 3 |
| Pembayaran upah | 4 |
| Counter nomor SPK | 1 |

Batas bukti: perbandingan jumlah bukan perbandingan checksum seluruh isi tabel. Restore membuktikan pemulihan skema/data serta rekonsiliasi bisnis, bukan pemulihan layanan Supabase lengkap. Owner/grant asli tidak diuji karena --no-owner/--no-acl. Login Auth, API, Storage service, Edge Functions, Siteplan melalui aplikasi dan transaksi contoh pada lingkungan pemulihan belum diuji. RLS/payment read test pada sumber tidak menggantikan pengujian izin pada target restore. Dump tidak memuat semua schema platform, role/password server, konfigurasi Supabase/Vercel ataupun binary objek Storage.

Pemeriksaan ulang Storage sumber pada sesi ini menemukan 0 objek. Tidak ada objek Storage yang perlu disalin pada snapshot ini; metadata Storage di dump tidak boleh dianggap backup isi file. Bila nanti ada objek, backup binary harus ditambahkan. Gambar Siteplan yang disimpan dalam kolom database public ikut cakupan data; tampilan Siteplan pada aplikasi pemulihan tetap belum diuji.

## Pemeriksaan hak akses akhir: lulus

supabase/tests/v2_role_capabilities_rollback.sql memeriksa 18 capability untuk tujuh role dalam kondisi aktif dan nonaktif: 252 pemeriksaan lulus. Capability tidak dikenal, identitas kosong, dan akses anonymous juga ditolak. Matriks ini menguji keputusan kavio_can_action, bukan seluruh endpoint atau seluruh policy tabel.

| Role | Aksi yang diberikan |
| --- | --- |
| Direktur | Semua 18 capability, termasuk persetujuan retensi, keputusan keuangan dan material hilang/rusak |
| Admin | Master, Sales, SPK, Progress, mapping, manajemen user, material, penerimaan dan upah; tanpa tiga persetujuan khusus Direktur |
| Marketing | Sales dan baca perjanjian Sales |
| Pelaksana | SPK, Progress, permintaan dan pemakaian material |
| Gudang | Transaksi gudang, permintaan dan pemakaian material |
| Keuangan | Rencana pembayaran, penerimaan, baca perjanjian, baca dan bayar upah |
| User | Tidak memiliki capability mutasi; menu baca tetap mengikuti aturan frontend/RLS |

supabase/tests/wage_payment_read_access.sql juga lulus: header/detail/bukti upah, mutasi kas/bank dan settlement terbaca hanya oleh Direktur/Admin/Keuangan. Akun nonaktif/anonymous ditolak dan penulisan langsung ke tabel pembayaran diblokir. Semua user/transaksi fixture di-rollback; setelah uji tetap terdapat 3 auth.users, 3 user_profiles dan 4 wage_payment. Semua tabel public memiliki RLS aktif; ini tidak berarti setiap policy telah diaudit secara exhaustif.

Lima suite Node pada sesi penutupan ini lulus: user-admin (Auth API mock), payment-history, siteplan-curve, report-output dan wage-payment-groups. Build produksi terakhir berasal dari rilis aplikasi sebelum perubahan dokumentasi/test SQL ini. Tidak ada perubahan runtime atau skema pada tahap penutupan ini.

## Gate operasional yang tersisa

1. Salinan backup kedua di media/lokasi terpisah belum dikonfirmasi. Rekomendasi: backup setelah hari kerja dan sebelum pembaruan, arsip harian 30 hari. Ini rekomendasi, belum merupakan jadwal otomatis yang dipasang atau kebijakan yang telah dijalankan.
2. Uji pemulihan runtime Supabase pada lingkungan terpisah: owner/grants/RLS, login role terkait, akses aplikasi, Siteplan dan transaksi contoh, serta deployment Edge Function. Uji lokal yang telah selesai tidak menutup gate ini.
3. RPO/RTO belum dijamin. Jadwal harian membatasi kehilangan data hingga satu hari kerja hanya jika dijalankan; durasi pemulihan end-to-end belum diukur.
4. Benchmark navigasi/volume besar dan catatan advisor di atas tetap menjadi tindak lanjut, bukan klaim uji beban atau sertifikasi keamanan lengkap.

## Pemulihan dan perubahan berikutnya

Jika rilis frontend bermasalah, rollback ke deployment baseline di Vercel. Ini tidak mengembalikan isi database atau menghapus migrasi. Pemulihan data memerlukan backup yang sudah diuji, dilakukan di lingkungan terpisah lebih dahulu. Tidak ada restore ke database aktif atau penghapusan data yang diotorisasi oleh pemeriksaan ini.

Sesudah salinan backup kedua dan gate pemulihan runtime terbukti, catat referensi bukti, tutup status kandidat dan buat tag rilis final dari baseline yang disetujui. Perbaikan bug berikutnya menggunakan patch V2.0.x; pengembangan fitur baru memakai branch terpisah. Tidak ada tag Operational Ready final yang dibuat sebelum gate tersebut selesai.
