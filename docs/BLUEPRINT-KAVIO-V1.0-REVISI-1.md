# BLUEPRINT KAVIO V1.0 — REVISI 1

Status: BASELINE IMPLEMENTASI
Repository: `zarifin8891-spec/KavioSistemV1.0`
Backend: Supabase project `Kavio_V1.0`

## 0. TUJUAN

Dokumen ini menjadi baseline implementasi KAVIO V1.0 berdasarkan:

1. Dokumen Revisi 1 dari pengguna.
2. Struktur repository KAVIO yang berjalan di branch `main`.
3. Struktur database Supabase yang berjalan saat audit.

Prinsip utama: perubahan harus memperkuat arsitektur KAVIO yang sudah ada, bukan membuat lapisan baru yang saling menimpa.

---

## 1. ARSITEKTUR LAYAR FINAL

Semua halaman mengikuti struktur tunggal:

```text
KAVIO SHELL
├── Sidebar
│   ├── Identitas KAVIO
│   ├── Navigasi
│   ├── User login
│   ├── Role
│   └── Tanggal
│
├── Header Global
│   ├── Satu background global
│   ├── Judul dinamis sesuai modul
│   └── Subtitle dinamis sesuai modul
│
└── Content / Module
    └── Isi modul tanpa membuat shell sendiri
```

Aturan:

- Sidebar tetap dan konsisten antar modul.
- Hanya satu header global.
- Modul tidak menampilkan judul halaman kedua yang mengulang header.
- Modul tidak membuat shell/layout global sendiri.
- Semua modul menggunakan komponen visual KAVIO.
- Proporsi dan tinggi header konsisten.

### Refactor yang ditetapkan

`app/components/kavio-shell.tsx` saat ini masih memuat blok `style jsx global` yang besar. Ini akan dipindahkan ke sistem stylesheet/component standard agar shell tidak menjadi sumber override CSS tambahan.

`app/layout.tsx` saat ini mengimpor beberapa stylesheet override dashboard/sales/typography. Layer tersebut akan direduksi menjadi fondasi global + stylesheet modul yang benar-benar diperlukan.

---

## 2. DESIGN SYSTEM KAVIO FINAL

### Font

```text
Arial Narrow, Arial, Helvetica, sans-serif
```

Aturan:

- Header regular, bukan bold.
- Tombol regular, bukan bold.
- Label UI regular.
- Bold hanya untuk data yang memang membutuhkan penekanan visual.
- Data bisnis mengikuti case aslinya; tidak boleh dipaksa uppercase secara global.
- Heading UI menggunakan uppercase sesuai standar KAVIO.

### Palette

```text
Deep Navy    #04182F
Navy         #08213D
             #0D2948
             #173452
Slate        #314A68
Gold         #D8B45A
Champagne    #F0D48A
Gold Dark    #A98235
Ivory        #F7F3E8
Muted        #C9BC99
```

Aturan utama:

- Tidak boleh ada modul dengan tema warna yang berbeda.
- Background tabel, dropdown/select, form, panel, badge, dan alert harus berasal dari palette KAVIO.
- Gold dipakai sebagai aksen/penanda, bukan sebagai warna isi utama yang mendominasi.
- Ivory menjadi warna area konten/data yang memerlukan keterbacaan tinggi.

---

## 3. STANDARD COMPONENT KAVIO

Komponen standard yang menjadi satu-satunya referensi visual:

- `KAVIO HEADER`
- `KAVIO PANEL`
- `KAVIO KPI`
- `KAVIO FORM`
- `KAVIO INPUT`
- `KAVIO SELECT`
- `KAVIO BUTTON`
- `KAVIO TABLE`
- `KAVIO BADGE`
- `KAVIO ALERT`
- `KAVIO EMPTY STATE`

Konsekuensi:

- Tombol Tambah/Simpan/Detail/Aktifkan/Nonaktifkan memakai standard button yang sama.
- Semua table memakai standard table yang sama.
- Semua form memakai grid, label, input, select, dan action footer standard.
- Modul tidak boleh membuat variasi tombol/table hanya untuk kebutuhan satu halaman tanpa alasan fungsional yang jelas.

---

## 4. STRUKTUR MENU KAVIO V1.0

```text
UTAMA
└── Dashboard

MASTER DATA
├── Tipe Rumah
├── Kategori Pekerjaan
├── Kantor Pelaksana
├── Mandor
├── Template Progress
├── Bank
└── Notaris

KAVLING

OPERASIONAL
├── Sales
├── SPK / Pekerjaan
└── Progress

LAPORAN

PENGATURAN
```

Catatan:

- Sales dan SPK adalah modul Operasional, bukan Master Data.
- URL teknis existing boleh dipertahankan untuk kompatibilitas.
- UI/navigation harus mengikuti struktur bisnis di atas.

---

## 5. DATA FLOW FINAL

```text
MASTER DATA
     ↓
   KAVLING
   ↙     ↘
 SALES   SPK
   ↓      ↓
   └──  PROGRESS
          ↓
   DECISION ENGINE
          ↓
       DASHBOARD
```

Prinsip:

- Sales dan SPK tidak berdiri sendiri.
- Kavling menjadi simpul utama lifecycle.
- Progress hanya terkait SPK.
- Decision Engine menjadi lapisan logika antara transaksi dan Dashboard.
- Dashboard tidak menghitung business logic sendiri; Dashboard membaca hasil view/logic yang sudah disiapkan.

---

## 6. KAVLING — POSISI DALAM ARSITEKTUR

`master_kavling` tetap menjadi master inventory sekaligus sumber lifecycle.

Status lifecycle yang dipertahankan:

- `AVAILABLE`
- `BOOKING`
- `BUILDING`
- `READY_STOCK`
- `SOLD`

Rule yang dikunci:

- SPK aktif mengontrol status pembangunan: `BUILDING`.
- Sales aktif mengontrol status penjualan.
- Satu kavling dapat memiliki histori SPK, tetapi hanya satu SPK aktif.
- Satu kavling dapat memiliki histori Sales, tetapi hanya satu Sales aktif.
- Penyelesaian SPK mengembalikan status kavling berdasarkan kondisi Sales.
- Jika Sales dibatalkan tetapi SPK masih aktif, status kavling tetap `BUILDING`.

---

## 7. SALES — BASELINE FINAL

### Data utama UI

- Tanggal Booking
- Kavling
- Nama Konsumen
- Alamat Konsumen
- HP Konsumen
- Status Sales
- Jenis Pembayaran
- Bank KPR
- Harga Jual
- Target Akad

### Status bisnis

```text
BOOKING
UANG MUKA
PROSES KPR
AKAD
BATAL
```

Catatan implementasi:

- Istilah UI yang ditampilkan ke pengguna adalah `UANG MUKA`.
- Bila backend masih memiliki enum/internal value `DP` karena dependency kode existing, internal value tidak diubah secara membabi buta; label UI dinormalisasi menjadi `UANG MUKA` sampai seluruh dependency aman untuk migrasi.

### Aturan pembayaran

- Jika pembayaran `KPR`, Bank KPR wajib dipilih.
- Untuk Cash/Cash Bertahap, field Bank KPR tidak wajib.

### AKAD

Data akad tidak dipaksakan ketika Sales baru dibuat.

Saat benar-benar AKAD:

- Tanggal Akad
- Notaris

### KPR Tracking

Tahap:

```text
KELENGKAPAN DATA
→ SURVEY BANK
→ INTERVIEW
→ SP3K
```

Setiap tahap memiliki histori.

### Metode input

Halaman Sales membuka **Daftar Sales** terlebih dahulu.
Form tambah/edit tidak langsung tampil.
Form dibuka melalui tombol perintah.

---

## 8. SPK / PEKERJAAN — BASELINE FINAL

### Data utama

- Tanggal SPK
- Kavling
- Tipe Rumah
- Kantor Pelaksana
- Mandor
- Target Selesai
- Status SPK
- Jenis Bobot

### Status

```text
DRAFT → AKTIF → SELESAI
```

### Rule operasional

- SPK aktif → Kavling `BUILDING`.
- SPK selesai → status Kavling mengikuti kondisi Sales.
- Mandor wajib berasal dari Kantor Pelaksana yang dipilih.
- Tipe Rumah SPK harus sama dengan Tipe Rumah pada Kavling.
- Satu Kavling hanya memiliki satu SPK aktif.
- Aktivasi/deaktivasi memakai transaksi atomic yang sudah tersedia di backend.
- Penyelesaian SPK harus mematuhi rule progress 100% yang sudah dikunci di backend.

### Bobot progress

Pada penerbitan/aktivasi SPK:

- gunakan template standar sesuai tipe rumah, atau
- gunakan bobot custom.

Final weight disnapshot ke `spk_progress_config`.
Total bobot final harus 100% sebelum SPK aktif.
Perubahan template di masa depan tidak mengubah histori SPK yang telah berjalan.

### Metode input

Halaman SPK membuka **Daftar SPK** terlebih dahulu.
Form input dibuka melalui tombol perintah.

---

## 9. PROGRESS — BASELINE FINAL

User tidak memasukkan angka cumulative.

### Input

- Tanggal Update
- Kategori Pekerjaan
- Progress Periode
- Keterangan

### Perhitungan

```text
Progress Periode
       ↓
Progress Akumulasi
       ↓
Weighted Progress
       ↓
Progress Total
```

### Histori

Semua update disimpan dalam `progress_update`.

`progress_periode` adalah progress untuk periode tersebut, bukan cumulative.

Setiap kategori memiliki akumulasi tersendiri dengan batas maksimum 100% per kategori.

### Curva-S

Curva-S tetap berada di:

**Detail SPK / Control Sheet**

Bukan di Dashboard utama.

Isi Curva-S:

- Planned Curve
- Actual Curve
- Marker Hari Ini
- Progress Aktual
- Progress Rencana Hari Ini
- Sisa Progress
- Kebutuhan Progress per Hari

---

## 10. DECISION ENGINE — BASELINE FINAL

Decision Engine menerima minimal:

- Progress Aktual
- Progress Seharusnya
- Gap Progress
- Sisa Hari
- Progress per Hari
- Tanggal Update Terakhir

Output:

- Status Operasional
- Status Ritme
- Prioritas Tindakan
- Action Recommendation
- Health Score
- Health Level
- indikator kesehatan yang relevan

Prinsip:

> Dashboard membaca hasil Decision Engine; Dashboard tidak menduplikasi perhitungan logic bisnis.

Behavior existing yang sudah diterapkan tetap dipertahankan, termasuk exclusion untuk SPK DRAFT dan penilaian health/attention yang sudah ada.

---

## 11. DASHBOARD — DESAIN FINAL TAHAP AKHIR

Dashboard dikerjakan setelah modul lain stabil.

### KPI wajib

```text
TOTAL KAVLING
TERJUAL
SEDANG DIBANGUN
READY STOCK
TERSEDIA
```

Model KPI mengikuti referensi pada Dokumen Revisi 1: kartu navy dengan aksen gold/champagne, icon, angka utama, dan indikator perubahan yang ringkas.

### Panel utama

Panel `SPK Perlu Perhatian` dan `Action Center` disederhanakan.

Tujuannya bukan menampilkan semua informasi, tetapi menonjolkan item yang membutuhkan tindakan.

### Grafik yang ditetapkan untuk desain awal

1. **Komposisi Status Kavling**
   - AVAILABLE
   - BOOKING
   - BUILDING
   - READY_STOCK
   - SOLD

2. **Planned vs Actual Progress**
   - ringkasan progress pembangunan menurut periode.

3. **Sales Pipeline**
   - BOOKING
   - UANG MUKA
   - PROSES KPR
   - AKAD

Grafik harus mengambil data dari sumber yang sudah ada. Tidak boleh dibuat hanya sebagai dekorasi.

---

## 12. MASTER DATA — DESAIN FINAL

Master Data menggunakan panel/card style yang konsisten:

- Navy background.
- Gold/champagne icon/accent.
- Border halus.
- Judul regular/standar KAVIO.
- Deskripsi singkat.
- Grid konsisten.

Master yang ditampilkan:

- Tipe Rumah
- Kategori Pekerjaan
- Kantor Pelaksana
- Mandor
- Template Progress
- Bank
- Notaris

Kavling tetap modul khusus inventory/lifecycle, bukan sekadar kartu master biasa.

---

## 13. METODE INPUT UNIVERSAL

Untuk semua modul transaksional atau modul yang memiliki form:

```text
BUKA MODUL
   ↓
DAFTAR DATA
   ↓
KLIK TOMBOL AKSI
   ↓
FORM INPUT / EDIT MUNCUL
```

Diterapkan minimal pada:

- Sales
- SPK
- Progress

Prinsip:

- List first.
- Action second.
- Form last.

---

## 14. TABLE / SELECT / BACKGROUND STANDARD

Semua tabel dan pilihan/select wajib mengikuti palette KAVIO.

Tidak boleh ada:

- table putih polos yang tidak konsisten dengan tema,
- dropdown browser-style yang terlihat terpisah dari sistem,
- background pilihan berbeda antar modul,
- badge dengan warna acak.

Table harus memprioritaskan keterbacaan data dan konsistensi kolom/action.

---

## 15. IMPLEMENTATION CLASSIFICATION

### KEEP

- Struktur database inti KAVIO.
- Lifecycle Kavling.
- SPK atomic activation/deactivation.
- Progress period-based dan histori.
- Snapshot bobot SPK.
- Decision Engine.
- Curva-S di Detail SPK.
- Sales KPR Tracking.
- Master Bank dan Notaris.

### CHANGE

- Arsitektur CSS menjadi satu design system yang tidak bertumpuk.
- Shell global agar bebas dari style override inline yang panjang.
- Standard component lintas modul.
- Struktur UI Sales mengikuti list-first.
- Struktur UI SPK dan Progress mengikuti list-first.
- Terminologi UI `UANG MUKA`.
- Dashboard KPI dan simplifikasi panel attention/action.
- Master Data menjadi panel/card standard KAVIO.

### ADD

- Alamat Konsumen dan HP Konsumen pada Sales bila belum tersedia secara persistently di database.
- Grafik Dashboard yang bersumber dari data aktual.
- KAVIO component foundation yang dipakai seluruh modul.

### DEFER

- Dashboard polish terakhir setelah Sales/SPK/Progress stabil.
- Fitur KAVIO 1.5: pemakaian material dan realisasi upah.
- Fitur KAVIO 2.0: purchasing, supplier, hutang/piutang, pembayaran konsumen/supplier, cash/bank, finance, dan costing penuh.
- Perubahan database yang hanya bersifat terminologi/internal bila tidak diperlukan untuk fungsi pengguna.

---

## 16. BASIS DATA YANG SUDAH TERSEDIA

Audit saat blueprint dibuat menunjukkan tabel public utama:

- `master_bank`
- `master_kantor_pelaksana`
- `master_kategori_pekerjaan`
- `master_kavling`
- `master_mandor`
- `master_notaris`
- `master_tipe_rumah`
- `progress_update`
- `sales`
- `sales_kpr_progress`
- `spk`
- `spk_progress_config`
- `template_progress_tipe`

Struktur ini sudah mencakup fondasi backend yang dibutuhkan untuk Revisi 1.

---

## 17. KAMUS STATUS DAN RULE KUNCI

### Sales

```text
BOOKING → UANG MUKA → PROSES KPR → AKAD
                     ↘
                       BATAL
```

### SPK

```text
DRAFT → AKTIF → SELESAI
```

### Kavling

```text
AVAILABLE
BOOKING
BUILDING
READY_STOCK
SOLD
```

### Rule prioritas lifecycle

```text
SPK aktif  → BUILDING
SPK selesai + Sales AKAD → SOLD
SPK selesai + Sales aktif non-AKAD → BOOKING
SPK selesai + tidak ada Sales aktif → READY_STOCK
Sales batal + tidak ada SPK aktif → AVAILABLE
Sales batal + SPK aktif → BUILDING
```

---

## 18. URUTAN EKSEKUSI

### Fase 1 — UI Foundation

1. Refactor shell.
2. Satukan typography dan palette.
3. Bangun standard component.
4. Hilangkan override CSS yang redundant.

### Fase 2 — Master Data

1. Standardize panel/card.
2. Standardize list/form/table.
3. Pastikan semua master memakai komponen yang sama.

### Fase 3 — Sales

1. List-first.
2. Form action-triggered.
3. Standard table/badge/button.
4. Lengkapi field konsumen.
5. KPR/AKAD sesuai business rule.

### Fase 4 — SPK

1. List-first.
2. Form standard.
3. Control Sheet standard.
4. Integrasi Curva-S.
5. Pastikan lifecycle tetap atomic.

### Fase 5 — Progress

1. List/history first.
2. Form action-triggered.
3. Progress period input.
4. Akumulasi/weighted progress.
5. Control Sheet integration.

### Fase 6 — Decision Engine / Quality Gate

1. Verifikasi semua output tetap benar.
2. Tidak ada business logic duplikat di frontend.
3. Regression test lifecycle.

### Fase 7 — Dashboard

1. KPI.
2. Simplify Attention/Action.
3. Grafik.
4. Final visual tuning.

### Fase 8 — Security / Performance

1. Review SECURITY DEFINER function permissions.
2. Review leaked-password protection.
3. Review index yang benar-benar tidak terpakai setelah penggunaan nyata.

---

## 19. ACCEPTANCE CRITERIA

Blueprint dianggap berhasil diterapkan bila:

- Semua halaman memiliki shell yang sama.
- Tidak ada judul modul yang menggandakan header global.
- Typography konsisten Arial Narrow.
- Header dan tombol regular.
- Palette KAVIO konsisten.
- Semua button/table/form/select mengikuti component standard.
- Sales, SPK, dan Progress menggunakan pola list-first.
- Status Sales tampil dengan istilah bisnis yang konsisten.
- SPK lifecycle tetap aman dan atomic.
- Progress tetap period-based dan historis.
- Curva-S hanya pada Detail SPK/Control Sheet.
- Decision Engine tetap menjadi sumber logic Dashboard.
- Dashboard memiliki 5 KPI utama.
- Grafik Dashboard berasal dari data aktual.
- Tidak ada CSS override baru yang sekadar menimpa override lama.
- Build/CI tetap berhasil setelah setiap fase.

---

## 20. PRINSIP IMPLEMENTASI

**Satu Shell. Satu Design System. Satu Sumber Logic.**

Setiap perubahan harus menjawab tiga pertanyaan:

1. Apakah mengikuti standar visual KAVIO?
2. Apakah menjaga business rule yang sudah benar?
3. Apakah mengurangi kompleksitas, bukan menambah tambalan baru?

Blueprint ini menjadi acuan implementasi sampai ada Revisi 2 yang disetujui.
