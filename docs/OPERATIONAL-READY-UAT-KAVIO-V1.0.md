# KAVIO V1.0 — PHASE 6C OPERATIONAL READY UAT

Tanggal audit: 30-Sep-2026  
Status dokumen: UAT aktif / pre-production gate

## 1. Tujuan

Phase 6C memastikan KAVIO V1.0 layak dipakai operasional dengan data nyata setelah Phase 6A (audit lifecycle) dan Phase 6B (integrity hardening).

Prinsip:
- business logic tidak boleh bergantung pada UI saja;
- mutasi kritis harus divalidasi di database;
- lifecycle Kavling harus tunggal dan konsisten;
- transaksi multi-step harus atomic;
- data historis Sales tidak boleh berubah karena perubahan Master;
- bobot SPK aktif adalah snapshot dan tidak boleh berubah;
- progress tidak boleh melampaui 100%.

## 2. Snapshot UAT

Snapshot database pada 30-Sep-2026 sekitar 13:37 WIB:

| Item | Jumlah |
| --- | ---: |
| Kavling | 107 |
| Sales | 25 |
| SPK | 17 |
| Progress Update | 33 |
| Mapping Siteplan | 107 |

Status Kavling:
- AVAILABLE: 83
- BOOKING: 8
- BUILDING: 14
- SOLD: 2
- READY_STOCK: 0

Sesudah Phase 6B mulai aktif:
- Sales baru terdeteksi: 16
- Sales baru invalid: 0
- SPK baru terdeteksi: 10
- SPK baru dengan bobot invalid: 0

## 3. Automated UAT — PASS

### Lifecycle & uniqueness
- [x] Tidak ada Sales aktif ganda pada satu Kavling.
- [x] Tidak ada SPK aktif ganda pada satu Kavling.
- [x] Tidak ada mismatch lifecycle Kavling terhadap Sales/SPK.
- [x] Relasi SPK: tipe Kavling, kantor, dan Mandor konsisten.

### Sales
- [x] Harga Sales disimpan sebagai snapshot transaksi.
- [x] Create Sales atomic.
- [x] Update Sales atomic.
- [x] Close/Batal Sales atomic.
- [x] Biaya tambahan Sales atomic.
- [x] Nilai biaya negatif ditolak.
- [x] KPR tracking dilindungi SALES_WRITE sampai database.
- [x] KPR tracking hanya untuk Sales KPR aktif.
- [x] Tanggal KPR tidak boleh sebelum booking atau di masa depan.
- [x] AKAD tidak dapat dibuka kembali ke status sebelumnya.
- [x] Satu Kavling yang pernah AKAD tidak dapat dibuatkan Sales baru.

### SPK
- [x] Satu Kavling hanya memiliki satu SPK.
- [x] Create/update SPK + snapshot bobot atomic.
- [x] Aktivasi SPK atomic.
- [x] Penyelesaian SPK atomic.
- [x] Semua snapshot bobot SPK yang diaudit total 100%.
- [x] Bobot tidak dapat diubah setelah SPK aktif.
- [x] Mandor harus berasal dari kantor pelaksana yang dipilih.
- [x] SPK tidak dapat selesai sebelum progress total 100%.

### Progress
- [x] Input Progress atomic.
- [x] Concurrency lock per SPK + kategori.
- [x] Akumulasi kategori tidak dapat melebihi 100%.
- [x] Progress hanya dapat masuk ke SPK AKTIF.
- [x] Kategori harus ada pada snapshot konfigurasi SPK.
- [x] Tanggal baru tidak boleh sebelum tanggal SPK.
- [x] Tanggal baru tidak boleh di masa depan.

### Security
- [x] Server Action tetap memakai requireKavioAction.
- [x] RPC kritis juga memvalidasi kavio_can_action di database.
- [x] RPC mutasi tidak tersedia untuk anon.
- [x] Internal kavio_sync_kavling_status tidak tersedia untuk authenticated/anon.
- [x] RLS mutasi Sales/SPK/Progress menggunakan action permission.

### Read model
- [x] v_progress_summary mengikuti seluruh SPK.
- [x] v_decision_engine hanya memuat SPK operasional yang relevan.
- [x] Siteplan aktif memiliki mapping untuk seluruh 107 Kavling saat snapshot UAT.
- [x] Dashboard/Siteplan membaca status dari lifecycle Kavling yang sama.

## 4. Legacy exceptions — perlu keputusan sebelum production cutover

Audit menemukan data yang dibuat sebelum validator baru berlaku:

1. 7 Progress lama memiliki tanggal update lebih awal daripada tanggal SPK.
2. 2 Sales AKAD lama adalah KPR tetapi belum memiliki Bank, Notaris, dan Tanggal Akad lengkap.

Data tersebut tidak diubah otomatis agar histori/test data tidak rusak. Validator sekarang mencegah data baru dengan kondisi yang sama.

Sebelum deklarasi final Operational Ready, tentukan apakah data tersebut:
- data test/demo -> bersihkan/reset; atau
- data nyata -> lengkapi/koreksi berdasarkan dokumen sumber.

## 5. Manual UAT — operator

Lakukan dengan user yang memiliki role sebenarnya, bukan hanya ADMIN.

### Marketing / Sales
- [ ] Buat Sales KPR baru pada Kavling AVAILABLE.
- [ ] Pastikan status Kavling berubah BOOKING.
- [ ] Tambahkan biaya Sales lalu cek Total Harga.
- [ ] Update BOOKING -> DP/UANG MUKA -> PROSES KPR.
- [ ] Isi tracking KPR.
- [ ] Ubah menjadi AKAD dengan Bank/Notaris/Tanggal lengkap.
- [ ] Pastikan Kavling menjadi SOLD.
- [ ] Coba input data invalid dan pastikan sistem menolak.
- [ ] Buat Sales lalu BATAL; pastikan lifecycle kembali sesuai kondisi SPK.

### Pelaksana / SPK
- [ ] Buat SPK DRAFT dari Kavling yang valid.
- [ ] Periksa snapshot bobot = 100%.
- [ ] Aktifkan SPK dan pastikan Kavling menjadi BUILDING.
- [ ] Input Progress beberapa kategori.
- [ ] Coba progress sehingga kumulatif >100%; harus ditolak.
- [ ] Coba tanggal sebelum SPK / masa depan; harus ditolak.
- [ ] Selesaikan semua kategori sampai 100%.
- [ ] Selesaikan SPK dan periksa READY_STOCK / BOOKING / SOLD sesuai Sales.

### Direktur / monitoring
- [ ] Cocokkan KPI Dashboard dengan Daftar Kavling.
- [ ] Cocokkan Monitoring SPK dengan SPK Control Sheet.
- [ ] Cocokkan Project Health dan Decision Engine.
- [ ] Periksa Siteplan: warna/status dan detail Kavling.
- [ ] Periksa Laporan Sales, Progress, dan Decision Engine dengan data yang sama.

### Role & permission
- [ ] MARKETING tidak dapat membuat/mengubah SPK atau Progress.
- [ ] PELAKSANA tidak dapat mengubah Sales.
- [ ] USER tidak mendapat aksi mutasi.
- [ ] DIREKTUR/ADMIN sesuai matriks permission yang disepakati.

## 6. Operational Ready Gate

KAVIO V1.0 dapat dinyatakan OPERATIONAL READY setelah:
1. seluruh automated UAT tetap PASS;
2. CI production PASS;
3. manual UAT workflow utama PASS;
4. dua kelompok legacy exception sudah diputuskan;
5. tidak ada blocker Critical/High baru selama input data nyata.

## 7. Freeze rule setelah Operational Ready

Setelah V1.0 dinyatakan Operational Ready:
- perubahan business logic masuk change request;
- foundation UI tetap menjadi source of truth global;
- schema change wajib migration;
- transaksi kritis baru harus atomic;
- fitur baru yang tidak diperlukan operasional dipindahkan ke KAVIO Lite / V2.0 sesuai roadmap.
