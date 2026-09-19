const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatKavioDate(value?: string | Date | null): string {
  if (value == null || value === '') return '—';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    return buildDate(value.getDate(), value.getMonth() + 1, value.getFullYear());
  }

  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return buildDate(Number(dateOnly[3]), Number(dateOnly[2]), Number(dateOnly[1]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '—';
  return buildDate(parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear());
}

function buildDate(day: number, month: number, year: number) {
  const monthName = MONTHS[month - 1];
  if (!monthName) return '—';
  return String(day).padStart(2, '0') + '-' + monthName + '-' + String(year);
}
