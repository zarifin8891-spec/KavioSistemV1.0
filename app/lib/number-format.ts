export function formatKavioMoney(value: number | string | null | undefined, maximumFractionDigits = 0) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat('id-ID', { maximumFractionDigits }).format(n)
    : '—';
}
