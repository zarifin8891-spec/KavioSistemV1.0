# KAVIO Monitor V1.0

Sistem monitoring pembangunan perumahan berbasis web.

## Roadmap Produk

- **KAVIO 1.0 — Monitor**: Master, Sales, SPK, Progress per kategori, Dashboard, Alert.
- **KAVIO 1.5 — Monitor Plus**: tambah pemakaian material dan realisasi upah untuk analisis Cost vs Progress.
- **KAVIO 2.0 — Management**: procurement, hutang, piutang, pembayaran, dan finance terintegrasi.

## Prinsip KAVIO V1.0

1. Progress lapangan diinput sebagai **progress periode**, bukan progress kumulatif.
2. Sistem menghitung **progress akumulasi** secara otomatis.
3. Bobot pekerjaan berasal dari template tipe rumah, lalu disnapshot pada saat **SPK** diterbitkan.
4. SPK menentukan kavling, tipe rumah, kantor/pelaksana, mandor, target selesai, dan bobot standard/custom.
5. Satu kavling hanya boleh memiliki satu SPK aktif pada satu waktu.
6. Histori progress dan histori SPK tetap dipertahankan.

## Backend

PostgreSQL melalui Supabase.

Database project: `Kavio_V1.0`

Schema aplikasi: `kavio`

## Status

Database foundation dan end-to-end data test sudah tersedia. Tahap berikutnya adalah membangun web application secara bertahap dimulai dari authentication, dashboard, master data, SPK, dan input progress.
