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
