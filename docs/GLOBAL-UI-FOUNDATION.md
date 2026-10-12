# KAVIO Global UI Foundation

## Input forms

- Use `KavioFormModal` directly, or its wrappers `KavioCreatePanel`, `KavioModalAction`, and `KavioTransactionModal`.
- Put submit commands inside `KavioFormActions` at the end of the form. It pairs the existing primary command with **Tutup Form**, on one row on desktop and mobile.
- The modal supplies its close callback through `KavioFormContext`. Closing preserves the shared draft lifecycle, scroll cleanup, and route behavior. The close button is `type="button"` and never submits.
- Dialog headers contain title, note, and optional badge. Do not add separate close/save buttons to headers.
- Keep secondary editing commands, such as adding a work item, outside the paired command group.
- Business forms retain their existing server actions, validation, permissions, labels, and disabled conditions. Filter and login controls are separate from input dialogs.
- Shared styling belongs in `app/kavio-ui-foundation.css`; do not create page-specific footer overrides.

Example:

```tsx
<KavioFormModal open={open} onClose={close} persistenceKey="example">
  <form action={save}>
    {/* fields */}
    <KavioFormActions>
      <button type="submit" className="kavio-button">Simpan</button>
    </KavioFormActions>
  </form>
</KavioFormModal>
```

## Data tables

`KavioDataTable` provides compact spacing, explicit column widths, header scopes, and header alignment. Numeric body cells use `kavio-number`, matching columns with `align: 'right'`. Long names wrap, while numeric amounts remain readable. Preserve horizontal scrolling at narrow viewport widths.

## Operational tabs

`KavioModuleTabs` is for panels whose data arrives with the page. It switches locally using native history, preserves query parameters and panel state, and synchronizes direct URLs and Back/Forward through Next.js search parameters. Clicks do not issue a new server navigation. Keyboard Arrow/Home/End navigation is supported. Hidden panels stay mounted, but use `hidden` and `display:none`.

Transaction mutations still execute on the server and revalidate data. This component is not a cache for independently fetched pages.

## Dana Jaminan

The tab header always exposes **Pencairan Dana Jaminan** to authorized finance users. The selector lists submitted, outstanding guarantees and opens the common receipt form. Pending guarantees explain that **Ajukan ke Bank** is required first. Empty state directs users to record retained guarantees together with KPR disbursement. Existing atomic receipt validation remains unchanged.

## Verification (2026-10-10)

- Production build and TypeScript passed.
- DOM interaction checks passed for local tab switching without router requests, panel draft retention, keyboard/URL synchronization, paired footer close without submission, numeric header/body alignment, partial guarantee balance, and pending guarantee guidance.
- Visual verification in a real browser remains separate from DOM checks.

## Receipts and warehouse (2026-10-10)

- `KavioDataTable` also owns receipt, stock, purchase and usage numeric column alignment.
- `KavioTableControls` supplies the common filter toolbar and counted pagination. Operational history queries fetch 50 rows per page. A mutation revision refreshes history without resetting selected filters.
- Repeatable forms may opt a structured hidden payload into shared draft persistence with `data-kavio-persist-hidden="true"`; restore it through `onInput`. Other hidden fields remain excluded. Purchase item arrays use this contract.
- Company settings are a single project identity, with active-user read access and `MASTER_WRITE` writes. PNG/JPEG logos are bounded to 250 KB and validated by their signatures.
- Printed receipts contain company identity, kavling/type/actual land area, total selling price (including additions), Indonesian terbilang and a QR encoding the stored receipt identifier. Scanning identifies the receipt; it is not a public verification portal.
- Purchase corrections retain the original, write a reversing ledger transaction, and optionally post a replacement atomically. Corrections are rejected after subsequent material activity at the destination, or after the SPK is closed. Posted supplier-direct consumption remains subject to its existing usage workflow.
- Direct purchases create SPK stock. Reusable tools are charged to their first receiving SPK. Requested fulfillment can create stock or consume material immediately in the same transaction.
- Stock card balances are computed over the complete ledger before date filtering, separately per material/location. Transfers have matching source and destination entries. Canceled purchases remain visible with their reversal.
- V1 triggers for kavling relations and progress configuration now support Fasum and validate the shared V2 work-item weights.

Validation: production build/TypeScript, DOM interactions for purchase line/destination/draft state, warehouse filter, history pagination/refresh, receipt contents and actual QR decoding; `supabase/tests/warehouse_v2_rollback.sql` and the Piutang regression suite pass. Warehouse tests also run under `authenticated` with fixtures rolled back. No actual browser/print visual approval is claimed.

## Multi-material transactions and reporting revision (2026-10-10)

- Receipt format is temporarily closed for revision. KPR disbursement stays gated by Sales AKAD; the observed test Sales was still BOOKING. The entry form now shows the prerequisite and links to Sales. It also shows received cash plus withheld guarantees versus available receivables, preserving the rule that withheld amounts are not cash received.
- `KavioMaterialLines` supplies one repeatable material editor for purchase, opening stock, requests, requested fulfillment, warehouse/SPK consumption and reconciliation. It prevents duplicate selection, checks positive quantities, and retains all lines through the shared structured draft mechanism.
- Operational purchase, request and usage tables show the latest **20 documents**, retaining every item in each selected document. Date filters no longer hide older documents in these operational lists. Open requests remain available to the fulfillment form regardless of their age.
- Full history is in **Laporan Material**, with 50 detail lines per page and correlated period, source/destination location, recorded supplier and material category filters. Kartu Stok keeps its existing period/material/location lookup.
- New reporting views use security invoker and have no public/anonymous grants. Material operation mutations continue through the existing authorized atomic engine.
- Validation: production build/TypeScript; DOM checks for shared line/draft state, all five operational dialogs, paired footers, 20-document query limits, report filters/paging, and KPR prerequisite; SQL rollback tests for two-material batches, atomic failure, 21-document history/40 retained lines in a 20-document display, and post-AKAD disbursement with four guarantee items. No actual browser visual verification is claimed.


## Koreksi pencairan KPR dan dana jaminan — 10 Oktober 2026

- Input pencairan KPR adalah nilai bruto/plafond yang dicairkan sebelum potongan jaminan, paling tinggi sisa piutang konsumen. Total jaminan tidak boleh melebihi bruto; jaminan sama dengan bruto menghasilkan uang bersih nol.
- Piutang konsumen berkurang sebesar bruto. Kas/Bank bertambah sebesar bruto dan berkurang sebesar jaminan ditahan. Jaminan menjadi piutang bank pemberi KPR pada Sales, terpisah dari rekening penerima uang.
- `sales_receipt.nominal` tetap uang bersih agar riwayat lama dan format kuitansi yang dibekukan tetap konsisten. Form baru mengirim `nominal_bruto`; wrapper atomik menghitung nominal bersih. Edit mengembalikan input bruto dari nominal bersih + snapshot jaminan.
- Klaim jaminan bertahap menambah Kas/Bank dan mengurangi piutang bank tanpa mengurangi piutang konsumen kedua kali. Kuitansi batal dikeluarkan dari semua agregasi aktif. Koreksi/void mengikuti engine audit yang sama.
- View invoker bersama menjadi sumber nominal bruto, pelunasan konsumen, mutasi bruto/jaminan, saldo jaminan bank, dan akumulasi penerimaan per rekening. Akumulasi penerimaan bukan saldo buku besar Kas/Bank lengkap.
- Uji regresi mencakup bruto penuh, net nol, empat jaminan, klaim parsial/final, koreksi, void, dan rollback nilai tidak valid.


## Pengajuan/pencairan dana jaminan multi item — 10 Oktober 2026

- Satu form memilih bank KPR, beberapa item termasuk beberapa kavling pada bank yang sama, dan tanggal bersama. Ada pilih semua; pencairan boleh parsial dengan nominal per item serta satu Kas/Bank tujuan, metode, dan referensi bersama.
- Seluruh pilihan diproses atomik melalui engine pengajuan/penerimaan yang sama. Duplikasi, bank berbeda, item belum diajukan, atau pencairan melebihi sisa membatalkan seluruh batch. Lock Sales dilakukan berurutan sebelum item.
- Kuitansi per item dan format cetak tetap mengikuti foundation sebelumnya. Semua kuitansi tampil pada daftar penerimaan; tidak otomatis membuka satu cetakan yang dapat menutupi item lainnya.
- Kategori Master Material menggunakan dropdown dari kategori RAB standar dan kategori lama yang sudah ada. Upah tetap terpisah. Validasi server menolak kategori di luar daftar.
- Semua form multi material memakai satu heading bersama dan label aksesibel tersembunyi pada setiap baris, melalui komponen global yang sama.

## Laporan Piutang dan Piutang Dana Jaminan — 10 Oktober 2026

- Menu Laporan menambah dua pilihan dengan komponen filter, pagination, dan tabel Global Foundation yang sama. Enam pilihan tersusun 3 kolom pada desktop, 2 pada tablet, dan 1 pada layar kecil.
- Laporan Piutang memfilter kategori pembayaran CASH/CASH BERTAHAP/KPR. Sales aktif selain BATAL ditampilkan, termasuk saldo nol. Pelunasan konsumen memakai bruto KPR; dana jaminan dipisahkan menjadi piutang bank.
- Laporan Piutang Dana Jaminan memfilter bank pemberi KPR dan jenis IMB/SERTIFIKAT/AIR & LISTRIK/BESTEK/GLOBAL. Menampilkan tagihan, sudah dicairkan, saldo bank, status, kavling, dan konsumen. Bank bukan rekening penerima. Termasuk item lunas untuk rekonsiliasi.
- Posisi laporan adalah saldo terkini, bukan saldo historis per tanggal. Filter dilakukan di database sebelum pagination 50 baris, tanpa batas riwayat 20 transaksi. Subtotal halaman diberi label jelas; bukan total seluruh hasil filter.
- View security invoker memakai engine piutang bank bersama. Hak akses Keuangan dan RLS dipertahankan.

### Compact category configuration

`KavioCategorySelector` is the shared category strip for master work details and SPK configuration. Desktop categories occupy one row with proportional card widths; small screens wrap without a separate scrollbar. SPK category weights are editable within each card, outside its selection button, including category-only progress mode. `kavio-form-total` presents a prominent total at the right of the settings row. The work editor keeps scrolling confined to its item table. SPK configuration routes open this editor immediately; closing returns to the SPK list, saving returns with confirmation, and errors keep the editor open with draft restoration. Activation remains the explicit command in the SPK list after configuration has been saved.

### Weight comparison precision

The shared percentage input defaults to two decimal places for progress entry. Work-weight editors opt into up to four percentage decimals (six fraction decimals), with a minimum of two. This exposes imported source precision rather than displaying a rounded value while saving a different hidden value. Category totals are computed from item integer weight units; comparisons show item total, target category weight, and exact difference. A deliberate “Samakan Bobot Kategori dengan Total Item” action adjusts only the selected category in the unsaved form, without modifying item weights. Exact category/item equality and rounded overall 100% validation remain enforced.

### Fasum wage entry and SPK activation

Fasum creation uses the shared bounded table-entry modal, compact input table, percentage/currency inputs, and aligned save/close footer. The shared `KavioDecimalInput` formats Fasum volumes with two decimals and accepts an Indonesian comma. Five header fields share one desktop row; only the items table scrolls. Each row records work name, volume, unit, wage unit price, progress weight, and notes. Planned wages are `ROUND(volume × unit price; -2)` per row; the sum becomes the SPK's wage basis. New Fasum progress weights are derived automatically from each rounded row wage divided by total wage. Integer six-decimal allocation with stable largest remainders keeps the stored total exactly 100%, and server actions recompute the weights independently of submitted values. Costs are stored in parent snapshots and displayed in configuration; detailed input is initially populated from Fasum rows, with mandor and retention reviewed before saving. Configuration may not override a stored Fasum wage basis. Kavling and Fasum require saved configuration before activation; changing draft parent or detail rows invalidates that saved configuration. Existing active history remains immutable.

### Shared progress monitoring

SPK monitoring KPIs count actual SPK records (Total, Active, Draft, Closed), covering both Kavling and Fasum. Progress monitoring presents the same KPI/Decision Engine and category/history/detail panels for both object types. The engine summary and latest-period contributions use shared SPK work-item weights. `kavio-panel-stack` groups recap and history vertically, independently from the taller detail/claim table, avoiding empty grid rows. Input progress retains its fixed footer and table-only scroll; the redundant explanatory footer note is removed.

SPK KPI notes show Kavling/Fasum counts for Total, Aktif, Draft and Selesai from the full RLS-visible dataset, independent of pagination. Both types open the same Control Sheet from the SPK list and Progress Monitoring. The shared Control Sheet reads item snapshots, names, weights and history from the V2 work-item engine; its curve accumulates the same weighted contributions.

Split KPI cards use `KavioSplitKpi`: total and title on the left, component counts in stacked rows on the right. Monitoring SPK applies the same component to Total, Aktif, Draft and Selesai, keeping the existing full-dataset counts.

Shared operational presentation uses `KavioDecisionPanel` in Progress Monitoring and SPK Control Sheet: health gauge, recommendation and four compact status metrics.

Progress Monitoring shows progress and mandor assignments only. Wage accrual amounts appear exclusively in Laporan Upah Borongan. The report reads stored period ledger amounts through the RLS-preserving `kavio_wage_report` function, includes all matching details and a mandor recap, and uses the shared `KavioPrintButton` and `.kavio-print-report` print shell. Date ranges are inclusive; accumulated progress ends at the selected final date. Report amounts are accruals, not payment or retention-release records.

Report navigation uses compact URL-based `KavioNavTabs` with Foundation module-tab styles, without description cards. Pipelines added to SPK/Progress/Control Sheet were removed. Wage detail is grouped by mandor with subtotals; each mandor starts a new printed page. The all-mandor recap starts on a separate page using `.kavio-print-new-page`. Shared `KavioReportHeading` supplies company identity and period on each group and recap; table headers repeat but subtotals print once.

All report filters use `KavioFilterBar` and `KavioFilterField` with explicit date/search/select kinds. Foundation tokens define 140px dates, 210px search, 160px selects, 38px controls and 10px spacing. Widths apply to field wrappers with no grow or shrink, and filters wrap before collision. Sales/Progress/Decision/Wage/Material/Piutang/Dana Jaminan all use this contract; no positional report-grid or input-type inference controls width. Labels and buttons share the same baseline. Search expands only on small screens.

Filter laporan: jarak 10 px; `KavioFilterActions` menjaga Tampilkan/Reset sebagai satu grup. `KavioDataTable fit` menghilangkan batas lebar minimum dan membungkus header/isi dalam lebar panel; jangan menyembunyikan overflow untuk menutupi kolom.

Gudang & Material reuses the canonical filters, compact module tabs and fitted data tables for Saldo, Pembelian, Permintaan/Pemakaian and Kartu Stok. `kavio-page-stack`, `kavio-kpi-grid-three`, `kavio-action-toolbar`, `kavio-transaction-form`, `kavio-field-wide` and `kavio-cell-subtext` provide shared spacing/layout instead of a material-specific stylesheet. Multi-item forms keep one heading and align row controls from the top so availability notes do not move adjacent controls. Business actions, permissions, limits and card pagination remain unchanged.

Purchase header uses `kavio-transaction-header`: Tanggal, No. Nota, Pemasok, and a single grouped Gudang/SPK destination. On desktop it is one row; narrow screens wrap deliberately. Shared `KavioMaterialLines` with price adds quantity × price per-line totals and a live sum (`TOTAL NOTA` for purchases, `TOTAL NILAI` for opening stock). Totals are derived display values, never trusted input. Business purchase dates can precede input day and cannot be future/invalid dates; created_at preserves posting/valuation order. Card rows sort by posting order to match their running balances. Existing clients without a date default to today; purchase amendments preserve the selected date. Other stock transaction dates remain automatic.

Seven Data Master input/edit forms use `kavio-master-form`: paired fields in two equal columns, explicit `kavio-master-field-wide` for long/final fields, compact modal sizing and the existing shared action footer. Material, Pemasok, Tipe Rumah, Kantor Pelaksana, Mandor, Kas/Bank and Notaris use the same contract. On narrow screens fields stack in their original input order.

Supplier forms display the automatically allocated business ID (`PMS-000001`) next to the name. Contact/phone form the second paired row; address and notes span both columns. The visible code is read-only; the existing UUID remains the relational key, so historical purchase references are preserved.

Master catalog filters use `KavioMasterFilters` as a thin wrapper over `KavioFilterBar`, explicit `KavioFilterField` kinds and grouped `KavioFilterActions`. Kategori Pekerjaan, Material and Perincian Pekerjaan reuse the canonical widths, control height, baseline and responsive wrapping; filter commands do not use the transaction-form grid.

Purchase destination entry separates Masuk Ke (Gudang/SPK) from the required destination selector. Switching route clears the previous destination; the inactive location/SPK field is submitted empty. The shared transaction-header-with-route variant keeps five fields aligned on desktop and wraps on narrow screens. The posting engine still receives one destination.

Master Gudang edits existing material_location records (GUDANG only) through existing RLS permissions; used locations cannot be deleted. Material request, fulfillment, direct usage, SPK usage and reconciliation share KavioTransactionHeader with a required business date and aligned responsive fields. The dated atomic dispatcher calls the existing permission-checked stock engine, sets dates on every resulting document/transaction, and preserves posting timestamps and moving-average order. Opening balances keep their existing date policy.

Reports order dated records oldest first. Material report removes the category filter and its lookup query. Stock card UI and its database running sum share tanggal, incoming-first mutation rank, posting timestamp, document number and row ID. Running sums cover full history before period filtering; posting valuation remains unchanged. Wage details retain mandor groups and order grouped items by earliest progress date in the selected period.

Kartu Stok is removed from the Gudang & Material navigation and rendered panels. The module has three tabs: Saldo Gudang, Pembelian, and Pemakaian & Rekonsiliasi. Transaction history remains in Laporan Material; stored transactions and stock balances are preserved.

StockTable accepts an actions slot in its shared panel header. Opening stock entry sits next to the item count; the redundant Input Transaksi panel on Saldo Gudang is removed. The existing transaction modal, permission gate and posting action are reused.

Wage settlement lives in Laporan Upah Borongan, separate from the printable accrual report. It reuses Foundation filters, pagination, fitted tables, transaction modals/headers, money input and save/close footer. Payments allocate amounts to immutable progress accruals, one mandor per document, up to 100 entries, with partial payments supported. Upah pays netto; zero-retention items pay their full earned wages. Retention reservations require Kavling akad or Fasum SPK closure, then explicit Director approval and Finance disbursement to an active Kas/Bank. Payout dates cannot precede approval. Ordered accrual locks, request UUIDs, server validation and status transitions prevent overpayment and duplicate payouts. Cancellation records a reason and audit actor/time, restores unpaid amounts, and excludes cash outflows; records are not deleted. Proof/detail printing uses company identity and the shared print shell. Financial totals for sales receipts remain receipt-only; wage outflows are recorded independently in v_wage_bank_movement.

Report subtotals and totals use the shared 16px bold total token (12px in print). KavioReportActions provides full-filter printing with company identity and CSV export compatible with Excel; CSV escapes quotes/newlines and neutralizes formula-like text. KavioReportTotals labels full-dataset totals separately from page subtotals. Material/receivable/wage settlement/history read all filtered rows in 500-row chunks, then paginate the screen locally; print/export/totals share that same dataset. Sales, Progress and Decision reports also read past the API default cap. Wage printing retains mandor grouping and a separate recap page. Wage payment totals include POSTED outflows only, with pending retention totals separate; unit prices are not summed. Material totals sum the displayed detail values and are labeled as such, including cancellation rows when the filter includes them.

Report monetary totals are table footer rows aligned with their original money columns via KavioTableTotals and KavioDataTable.footer. Detached total panels and the redundant receivable page subtotal are removed. Generic full-report printing uses right-aligned numeric headers, values and footer cells with shared compact spacing; multiple totals for one money column get separate labeled footer rows.

Wage reporting, settlement and history are sibling panels separated by kavio-page-stack spacing. Settlement uses explicit Upah Netto/Retensi mode buttons with Foundation compact module-tab styles. Print/export and entry commands share the panel-header action group. Retention mode explains the existing request/Director approval/Finance payout states; history filters distinguish pending approval, ready to pay, posted and canceled documents.
