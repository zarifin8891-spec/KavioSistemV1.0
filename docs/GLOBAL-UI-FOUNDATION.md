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
