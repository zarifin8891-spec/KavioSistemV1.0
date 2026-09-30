export function formatKavioMoney(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)
    : '—';
}
