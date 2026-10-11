# Progress perincian SPK — tahap 2

Konfigurasi SPK Kavling dan Fasum tetap disimpan ketika DRAFT: kategori, bobot, total upah, perincian volume/satuan, satu mandor per item, serta retensi 5% atau 0%. Master Kavling dapat disalin melalui tombol Salin Perincian Master. Konfigurasi SPK aktif/berhistori tetap terkunci. Aktivasi memeriksa konfigurasi tersimpan, kesamaan bobot item/kategori, total kategori 100,00% setelah pembulatan, serta mandor aktif.

## Sumber dan rekap

`work_detail_progress` menyimpan progress periode per item, mandor/bobot/retensi/upah sebagai snapshot, keterangan, tanggal, dan pengguna pencatat. Satu item hanya satu input per tanggal; item berbeda dalam kategori dan tanggal yang sama dapat disimpan melalui batch berbeda. Seluruh batch atomic dan memakai lock SPK yang sama, termasuk batas kumulatif item 100%.

Kontribusi kategori = SUM(progress item × bobot item). Progress kategori = kontribusi / bobot kategori. Progress total SPK = SUM(kontribusi seluruh kategori). Rekap kategori diproyeksikan ke `progress_update` untuk engine V2 yang dipakai Dashboard, Decision Engine, laporan, dan Control Sheet. Target kumulatif kategori dibulatkan ke enam desimal mengikuti presisi engine; delta diambil dari target tersebut agar pembulatan per periode tidak menumpuk. Pada 100% seluruh item, kategori tepat 100%.

Input kategori melalui RPC lama dan perubahan langsung via API ditolak untuk SPK PERINCIAN. Input per kategori tetap tersedia untuk SPK KATEGORI. Histori perincian ditampilkan per item dengan paging 25 baris; form menyembunyikan item selesai, memakai filter kategori, dan mempertahankan item terisi ketika berpindah filter. Pesan kesalahan memakai Message Box global dan mempertahankan modal input.

## Dasar tagihan

Total upah item = ROUND(bobot × total upah SPK; -2). Bruto kumulatif = ROUND(progress kumulatif × upah item; 2), retensi kumulatif = ROUND(progress kumulatif × upah item × retensi; 2). Nilai transaksi adalah selisih hak kumulatif baru dan jumlah transaksi terdahulu; netto = bruto − retensi. Ini menghindari selisih pembulatan akibat pemecahan periode. Penugasan mandor serta nilai tagihan terdahulu tidak mengikuti perubahan master.

Tahap ini mencatat dasar tagihan dan menampilkan bruto/retensi/netto per item. Pencatatan pembayaran, persetujuan direktur, serta pencairan retensi setelah akad Kavling atau penutupan Fasum menjadi tahap berikutnya.

Penutupan SPK PERINCIAN memerlukan seluruh item tepat 100%, termasuk total bobot sumber 99,9964% yang diterima sebagai 100,00%. Pemeriksaan sisa material dan kewajiban rekonsiliasi tetap berlaku.

## Validasi

- `supabase/tests/detailed_work_progress.sql`: aktivasi, formulasi item/kategori/SPK, Kavling Decision Engine, Fasum, mandor berbeda, 5%/0% retensi, batch lintas kategori, gabungan kategori pada tanggal sama, duplikat, salah SPK, rollback, penutupan total bobot dibulatkan, stok sisa, RLS, dan hak akses.
- Regresi konfigurasi tahap 1 tetap lolos.
- Uji komponen React: item selesai tersembunyi, mandor tampil, filter mempertahankan input batch, Message Box untuk kelebihan progress, modal tetap terbuka saat error, serta submit valid.
- Build Next.js lolos. Visual pada sesi login pengguna perlu dikonfirmasi melalui preview V2.

Tanggal form serta validasi semua RPC progress menggunakan `Asia/Jakarta`. Uji `supabase/tests/progress_date_jakarta.sql` mencakup pergantian hari, pencatatan kategori pada hari proyek, dan penolakan tanggal masa depan.
