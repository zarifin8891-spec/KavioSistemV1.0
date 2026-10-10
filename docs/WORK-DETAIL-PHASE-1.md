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
  sebagai persen dengan empat angka desimal.
- Total upah item = bobot item terhadap seluruh SPK × total upah SPK.
- Harga satuan = total upah item ÷ volume.
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
