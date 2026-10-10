# KAVIO V2 — Master perincian dan konfigurasi SPK

Tahap 1 menyiapkan master dan snapshot konfigurasi. Input progress perincian,
tagihan mandor, pembayaran upah, dan pencairan retensi merupakan tahap berikutnya.

## Alur pengguna

1. Data Master → Tipe Rumah: isi total upah borongan.
2. Data Master → Perincian Pekerjaan: pilih tipe, atur bobot kategori dan item,
   nama, volume, satuan, serta retensi 5% atau tanpa retensi.
3. Simpan Draft untuk pengisian bertahap. Simpan & Siap Digunakan memerlukan
   total kategori tepat 100%, jumlah bobot item sama dengan kategori, dan upah positif.
4. Buat SPK. Setelah tersimpan sebagai draft, buka Konfigurasi Pekerjaan.
   Pada Kavling, salin master yang sudah siap. Atur bobot custom bila diperlukan.
   Pada Fasum, isi perincian sesuai kelompok pekerjaan yang dibuat pada SPK.
5. Tetapkan satu mandor per item; default mandor utama SPK. Mandor item berbeda
   dapat dipilih tanpa mengubah mandor utama.
6. Pengaturan → Input Progress menentukan default SPK baru. Konfigurasi SPK
   berjalan tetap terkunci. Perubahan master tidak merambat ke snapshot SPK.

SPK mode KATEGORI tetap dapat diaktifkan melalui perintah Aktivasi.
SPK mode PERINCIAN dapat dikonfigurasi dan disimpan sebagai DRAFT, tetapi aktivasi
menunggu implementasi input progress perincian. Perubahan SPK draft melalui form
pembuatan kini tetap DRAFT; aktivasi merupakan perintah terpisah.

## Kontrak data dan perhitungan

- `spk_work_item` tetap merupakan engine kategori/kelompok pekerjaan bersama.
- `master_work_detail` menyimpan rincian per tipe dan kategori.
- `spk_work_detail` menyimpan rincian yang disalin/diatur untuk satu SPK,
  termasuk mandor dan retensi; tidak bergantung pada baris master setelah disimpan.
- Bobot disimpan sebagai pecahan dengan enam angka desimal, ditampilkan
  sebagai persen dengan dua angka desimal pada form dan tabel. Nilai rinci sumber
  dipertahankan sampai pengguna mengedit bobot, agar format tampilan tidak mengubah upah.
- Total upah item = ROUND(bobot item terhadap seluruh SPK × total upah SPK; -2), dibulatkan ke ratusan rupiah terdekat. Aturan bersama digunakan pada editor, katalog master, dan konfigurasi SPK.
- Harga satuan = total upah item setelah pembulatan ÷ volume.
- Kedua RPC penyimpanan memvalidasi dan menulis seluruh konfigurasi secara atomik.
- RLS aktif; tabel rincian hanya dapat ditulis melalui RPC dengan MASTER_WRITE
  atau SPK_WRITE. Anon tidak diberi izin menjalankan RPC.
- Snapshot SPK yang aktif, selesai, atau memiliki histori progress tidak dapat diubah.

## Referensi T36

Tombol Muat Contoh T36 memuat 70 item dari PDF yang diberikan pengguna ke form,
sebagai draft yang bisa ditinjau; tidak menimpa master secara otomatis.
Bobot sumber berjumlah 99,9964%, sehingga selisih pembulatan perlu ditentukan
pengguna sebelum publikasi. Satuan Instalasi Air Hujan dan Kicenzing +Kran kosong.
Satuan lainnya dipertahankan seperti sumber, termasuk yang perlu ditinjau.
Rangka atap baja ringan, instalasi listrik, dan pengecatan ditandai tanpa retensi.

## Tahap berikutnya

Input periodik per item, akumulasi maksimal 100%, dan penyembunyian item selesai.
Kontribusi kategori = jumlah(progress akumulasi item × bobot item).
Progress kategori = kontribusi kategori ÷ bobot kategori.
Progress SPK = jumlah kontribusi kategori. Jangan mengalikan bobot kategori lagi.
Tagihan memakai mandor pada waktu progress dicatat; pembayaran parsial dan
retensi harus mempertahankan hak histori bila penugasan kemudian berubah.
Retensi Kavling dibayar setelah akad, Fasum setelah SPK ditutup, dengan
persetujuan direktur. Item tanpa retensi dibayar penuh.

## Verifikasi

`supabase/tests/work_detail_configuration.sql` menjalankan fixture rollback untuk
publikasi master, bobot persis, draft, kegagalan atomik, isolasi snapshot, penugasan
mandor, aktivasi Kavling/Fasum mode kategori, penguncian konfigurasi, hak RPC, dan RLS.
Pengujian form dengan React/jsdom memeriksa contoh 70 item, 14 item tanpa retensi,
header per kelompok, penambahan item, pemulihan draft terstruktur, mandor, perhitungan
upah, pergantian mode, dan penutupan form setelah penyimpanan berhasil.

## Perbaikan form perincian

Kategori dipilih melalui navigator; hanya item kategori aktif yang ditampilkan.
Nilai kategori lain tetap disertakan dalam penyimpanan dan pemulihan draft.
Nama pekerjaan, volume, satuan, dan bobot berada di baris utama; retensi, mandor,
dan hasil upah di baris berikutnya. Header utama hanya satu untuk seluruh item
kategori. Di layar kecil navigator mendatar dan field ditata bertingkat.
Bobot menggunakan input desimal dengan koma atau titik, diformat dua desimal
ketika selesai diedit. Validasi memperhitungkan seluruh kategori dan membuka
kategori yang memiliki item belum lengkap sebelum penyimpanan.

Form Tambah/Edit Kategori memiliki urutan Urutan, ID Kategori, Nama Kategori,
dan Bobot. Bobot mengacu pada tipe rumah yang dipilih di daftar; tautan Edit,
validasi gagal, dan penutupan form mempertahankan pilihan tipe tersebut.
RPC `save_master_category_weight_atomic` menyimpan kategori dan bobot bersamaan.
Pada tipe dengan perincian siap, bobot tetap harus cocok dengan item dan total
100%; kegagalan mengembalikan seluruh perubahan termasuk nama dan urutan.

Total bobot kategori divalidasi sebagai `ROUND(SUM(bobot) * 100; 2) = 100,00` pada form dan database, termasuk konfigurasi, aktivasi, serta pemeriksaan bobot saat input progress. Contoh: 99,9964% diterima sebagai 100,00%; 99,9949% ditolak sebagai 99,99%. Bobot sumber tetap disimpan dengan enam desimal pecahan dan jumlah item per kategori tetap harus sama persis dengan bobot kategori.
