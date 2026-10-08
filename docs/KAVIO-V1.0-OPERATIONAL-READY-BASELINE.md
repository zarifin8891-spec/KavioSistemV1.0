# KAVIO V1.0 — Operational Ready Baseline

**Status:** FROZEN / OPERATIONAL READY  
**Tanggal freeze:** 08 Oktober 2026  
**Repository:** `zarifin8891-spec/KavioSistemV1.0`  
**Frozen branch:** `release/v1.0-operational-ready`  
**Baseline application commit:** `ec692a8cfdf0819dfbb384255c112a433f54a555`

## 1. Tujuan Baseline

Dokumen ini menetapkan titik resmi KAVIO V1.0 yang telah selesai melalui audit, hardening, UAT, dan optimasi performa. Branch `release/v1.0-operational-ready` menjadi referensi stabil untuk pemulihan, maintenance V1.0, dan pembanding terhadap pengembangan versi berikutnya.

Pengembangan fitur baru setelah baseline ini tidak dilakukan pada frozen branch.

## 2. Scope KAVIO V1.0

KAVIO V1.0 mencakup:

- Dashboard Monitoring dan Project Health.
- Siteplan Interaktif serta mapping kavling Manual / Auto Detect.
- Master Data: Kavling, Tipe Rumah, Kategori Pekerjaan, Kantor Pelaksana, Mandor, Bank, Notaris, dan Template Progress.
- Sales Management.
- KPR Tracking.
- SPK / Pekerjaan.
- Progress Pembangunan berbasis bobot.
- Status lifecycle kavling, termasuk `SIAP_AKAD`.
- Decision Engine dan Action Center.
- Laporan Sales, Progress, dan Decision Engine.
- Manajemen User, Role, dan Hak Akses.
- Global UI/UX Foundation, Modal Form, Message Box, dan Form State Persistence.

## 3. Lifecycle Utama yang Dikunci

- Satu kavling hanya dapat memiliki satu Sales aktif.
- Sales baru hanya dapat dibuat setelah transaksi sebelumnya BATAL; kavling yang sudah AKAD/SOLD tidak dapat dijual kembali.
- Satu kavling hanya memiliki satu SPK.
- SPK aktif mengubah kavling menjadi BUILDING.
- Progress kategori tidak dapat melebihi 100%.
- KPR hanya dapat berjalan dengan referensi Bank yang valid.
- AKAD memerlukan data akad dan Notaris sesuai aturan sistem.
- `SIAP_AKAD` bersifat informatif dan **tidak mengunci proses AKAD**.
  - KPR: progress pembangunan 100% dan tahap KPR sudah SP3K.
  - Cash Bertahap: progress pembangunan 100%.
- Setelah AKAD selesai, status kavling menjadi SOLD.

## 4. Status UAT dan Audit

Final UAT telah mencakup role ADMIN/DIREKTUR, MARKETING, dan PELAKSANA serta alur operasional utama.

Hasil final:

- Business lifecycle: **PASS**
- Role / permission integrity: **PASS**
- Data integrity / invariant checks: **PASS**
- Positive dan negative transactional OAT: **PASS**
- Security hardening database / RLS: **PASS**
- Final Navigation Performance Optimization: **PASS**
- CI terakhir sebelum freeze: **KAVIO CI #728 — PASS**
- Browser UAT terakhir: navigasi dinyatakan lebih responsif dan diterima.

Final navigation optimization mencakup middleware auth fast-path, intent prefetch, pencegahan mass-prefetch, route loading boundary, persistent Siteplan shell, dan diagnostic `Server-Timing`.

## 5. Database Baseline

Database production V1.0 telah menerima migration sampai:

`20261008052754_add_siap_akad_kavling_lifecycle`

Hardening sebelumnya mencakup fail-closed access, provisioning user profile, RLS untuk user aktif, security-invoker views, pembatasan RPC/trigger grants, serta pembersihan legacy bootstrap data yang tidak valid.

## 6. Catatan Operasional

Dua catatan berikut bukan blocker freeze:

1. **Master Notaris** harus diisi dengan data Notaris sebenarnya sebelum transaksi AKAD riil pertama.
2. **Supabase Leaked Password Protection** masih direkomendasikan untuk diaktifkan dari Supabase Dashboard sebagai hardening tambahan.

Unused-index advisory tidak dijadikan alasan menghapus index pada V1.0 karena volume sistem masih kecil dan belum ada bukti bahwa penghapusan index memberi manfaat.

## 7. Aturan Setelah Freeze

- `release/v1.0-operational-ready` tidak digunakan untuk pengembangan fitur baru.
- Bug kritis V1.0, jika ada, dibuat melalui branch maintenance/hotfix terpisah dan diuji sebelum digabungkan.
- Pengembangan generasi berikutnya dilakukan dari branch V2.0 terpisah.
- Database production V1.0 tidak digunakan sebagai area eksperimen schema V2.0.
- Setiap perubahan database versi berikutnya wajib melalui migration yang dapat diaudit.

---

**KAVIO V1.0 dinyatakan OPERATIONAL READY dan menjadi baseline resmi produk per 08 Oktober 2026.**
