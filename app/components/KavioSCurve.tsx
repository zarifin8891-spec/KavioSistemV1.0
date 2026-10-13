import {formatKavioDate} from '../lib/date-format';
export type CurveHistory={tanggal_update:string;progress_aktual:number|string};
export function buildCurvePoints(start: string, target: string, history: CurveHistory[], today: string) {
  const startMs = dateMs(start);
  const targetMs = dateMs(target);
  const todayMs = dateMs(today);
  const totalMs = Math.max(1, targetMs - startMs);
  const sortedHistory = history
    .map((row) => ({ date: row.tanggal_update, actual: clamp(Number(row.progress_aktual ?? 0)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const actualByDate = new Map(sortedHistory.map((row) => [row.date, row.actual]));
  const lastActualDate = sortedHistory.at(-1)?.date ?? start;
  const lastActual = actualByDate.get(lastActualDate) ?? 0;
  const effectiveToday = todayMs < startMs ? start : today;
  const dates = Array.from(new Set([
    start,
    ...sortedHistory.map((row) => row.date).filter((date) => date <= effectiveToday),
    effectiveToday,
    target,
  ])).sort();

  let latestActual = 0;
  return dates.map((date) => {
    if (actualByDate.has(date)) latestActual = Number(actualByDate.get(date));
    if (date === effectiveToday && dateMs(date) >= dateMs(lastActualDate)) latestActual = lastActual;
    const elapsed = Math.min(1, Math.max(0, (dateMs(date) - startMs) / totalMs));
    const planned = elapsed <= 0 ? 0 : elapsed >= 1 ? 1 : elapsed * elapsed * (3 - 2 * elapsed);
    return { date, planned, actual: dateMs(date) <= todayMs ? latestActual : null };
  });
}
export default function KavioSCurve({ points, today, compact=false }: { compact?:boolean; points: { date: string; planned: number; actual: number | null }[]; today: string }) { const width = 1100; const height = compact ? 220 : 390; const left = 58; const right = 30; const top = 24; const bottom = 54; const plotW = width - left - right; const plotH = height - top - bottom; const xs = points.map((p) => dateMs(p.date)); const minX = Math.min(...xs, dateMs(points[0]?.date ?? today)); const maxX = Math.max(...xs, dateMs(points.at(-1)?.date ?? today)); const span = Math.max(1, maxX - minX); const x = (date: string) => left + ((dateMs(date) - minX) / span) * plotW; const y = (value: number) => top + (1 - clamp(value)) * plotH; const planPath = interpolatePath(points.map((p) => ({ x: x(p.date), y: y(p.planned) }))); const actualPoints = points.filter((p) => p.actual !== null).map((p) => ({ x: x(p.date), y: y(Number(p.actual)), date: p.date })); const actualPath = interpolatePath(actualPoints.map((p) => ({ x: p.x, y: p.y }))); const todayX = x(clampDate(today, points[0]?.date ?? today, points.at(-1)?.date ?? today)); const gridValues = [0, 0.25, 0.5, 0.75, 1]; const labels = makeDateLabels(points, 5); return <svg preserveAspectRatio={compact?'none':'xMidYMid meet'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva-S progress pembangunan" style={{ width: '100%', display: 'block', background: '#102A56', borderRadius: 12, border: '1px solid #B8943F' }}>{gridValues.map((v) => <g key={v}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="rgba(220,203,156,.20)" strokeWidth="1" /><text x={left - 10} y={y(v) + 4} textAnchor="end" fill="#DCCB9C" fontSize="12">{Math.round(v * 100)}%</text></g>)}<line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#D8B45A" strokeWidth="1" /><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#D8B45A" strokeWidth="1" />{labels.map((label) => <g key={label.date}><line x1={x(label.date)} x2={x(label.date)} y1={height - bottom} y2={height - bottom + 7} stroke="#D8B45A" /><text x={x(label.date)} y={height - 18} textAnchor="middle" fill="#DCCB9C" fontSize="11">{formatMonth(label.date)}</text></g>)}<line x1={todayX} x2={todayX} y1={top} y2={height - bottom} stroke="#E8CC7A" strokeDasharray="6 5" strokeWidth="2" /><path d={planPath} fill="none" stroke="#DCCB9C" strokeWidth="4" strokeLinecap="round" />{actualPath && <path d={actualPath} fill="none" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}{actualPoints.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r="4" fill="#F7F3E8" stroke="#22C55E" strokeWidth="2" />)}<text x={width - right} y={top + 12} textAnchor="end" fill="#E8CC7A" fontSize="12" fontWeight="700">Rencana</text>{actualPoints.length > 0 && <text x={actualPoints.at(-1)!.x} y={Math.max(top + 18, actualPoints.at(-1)!.y - 12)} textAnchor="middle" fill="#22C55E" fontSize="12" fontWeight="700">Aktual</text>}<text x={todayX + 7} y={top + 18} fill="#E8CC7A" fontSize="11" fontWeight="700">HARI INI</text></svg>; }
function interpolatePath(points: { x: number; y: number }[]) { if (!points.length) return ''; if (points.length === 1) return `M ${points[0].x} ${points[0].y}`; let d = `M ${points[0].x} ${points[0].y}`; for (let i = 1; i < points.length; i += 1) { const prev = points[i - 1]; const curr = points[i]; const dx = (curr.x - prev.x) / 3; d += ` C ${prev.x + dx} ${prev.y}, ${curr.x - dx} ${curr.y}, ${curr.x} ${curr.y}`; } return d; }
function makeDateLabels(points: { date: string }[], count: number) { if (!points.length) return []; const picked: { date: string }[] = []; for (let i = 0; i < count; i += 1) picked.push(points[Math.round((i * (points.length - 1)) / Math.max(1, count - 1))]); return Array.from(new Map(picked.map((p) => [p.date, p])).values()); }
function formatMonth(date: string) { return formatKavioDate(date); }
function clampDate(date: string, minDate: string, maxDate: string) { return date < minDate ? minDate : date > maxDate ? maxDate : date; }
function clamp(value:number){return Math.min(1,Math.max(0,value));}
function dateMs(date:string){return new Date(`${date}T00:00:00Z`).getTime();}
