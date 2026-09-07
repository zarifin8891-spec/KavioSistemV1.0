import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';

type Params = Promise<{ id: string }>;
type Spk = { id_spk: string; id_kavling: string; id_tipe: string; id_kantor: string; id_mandor: string; tgl_spk: string; tgl_target_selesai: string; status_spk: string; is_active: boolean };
type Current = { id_kategori: string; progress_akumulasi: number | string; bobot_final: number | string; progress_berbobot: number | string; tanggal_update_terakhir: string | null };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };
type History = { id_progress: string; tanggal_update: string; id_kategori: string; progress_periode: number | string; keterangan: string | null };
type Decision = { progress_aktual: number | string; progress_seharusnya: number | string; gap_progress: number | string; sisa_hari: number; tanggal_update_terakhir: string | null; progress_periode_terakhir: number | string; status_operasional: OperationalStatus; status_ritme: PaceStatus; prioritas_tindakan: ActionPriority; action_rekomendasi: string; hari_sejak_update: number; progress_diperlukan_per_hari: number | string; health_score: number; health_level: HealthLevel; health_description: string };
type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';
type ActionPriority = 'TINGGI' | 'SEDANG' | 'NORMAL';
type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';

export default async function SpkDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: spkData } = await supabase.from('spk').select('id_spk, id_kavling, id_tipe, id_kantor, id_mandor, tgl_spk, tgl_target_selesai, status_spk, is_active').eq('id_spk', id).maybeSingle();
  if (!spkData) notFound();
  const spk = spkData as Spk;

  const [{ data: currentData }, { data: categories }, { data: history }, { data: office }, { data: mandor }, { data: decisionData }] = await Promise.all([
    supabase.from('v_progress_kategori_current').select('id_kategori, progress_akumulasi, bobot_final, progress_berbobot, tanggal_update_terakhir').eq('id_spk', id).order('id_kategori'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('progress_update').select('id_progress, tanggal_update, id_kategori, progress_periode, keterangan').eq('id_spk', id).order('tanggal_update', { ascending: true }).order('id_kategori').limit(500),
    supabase.from('master_kantor_pelaksana').select('nama_kantor_pelaksana').eq('id_kantor', spk.id_kantor).maybeSingle(),
    supabase.from('master_mandor').select('nama_mandor').eq('id_mandor', spk.id_mandor).maybeSingle(),
    supabase.from('v_decision_engine').select('progress_aktual, progress_seharusnya, gap_progress, sisa_hari, tanggal_update_terakhir, progress_periode_terakhir, status_operasional, status_ritme, prioritas_tindakan, action_rekomendasi, hari_sejak_update, progress_diperlukan_per_hari, health_score, health_level, health_description').eq('id_spk', id).maybeSingle(),
  ]);

  const currentRows = (currentData ?? []) as Current[];
  const categoryRows = (categories ?? []) as Category[];
  const historyRows = (history ?? []) as History[];
  const decision = decisionData as Decision | null;
  const categoryMap = new Map(categoryRows.map((row) => [row.id_kategori, row]));
  const progressTotal = Number(decision?.progress_aktual ?? currentRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0));
  const latestPeriod = getLatestPeriod(historyRows);
  const today = new Date().toISOString().slice(0, 10);
  const daysRemaining = Number(decision?.sisa_hari ?? differenceInDays(today, spk.tgl_target_selesai));
  const expectedProgress = Number(decision?.progress_seharusnya ?? getExpectedProgress(spk, today));
  const gap = Number(decision?.gap_progress ?? progressTotal - expectedProgress);
  const status = decision?.status_operasional ?? 'BERJALAN';
  const paceStatus = decision?.status_ritme ?? getPaceStatus(gap);
  const actionPriority = decision?.prioritas_tindakan ?? 'NORMAL';
  const healthLevel = decision?.health_level ?? getFallbackHealth(status, gap, daysRemaining);
  const healthScore = Number(decision?.health_score ?? 0);
  const progressPerDay = Number(decision?.progress_diperlukan_per_hari ?? 0);
  const action = decision?.action_rekomendasi ?? 'LANJUTKAN MONITORING';
  const actualPct = clamp(progressTotal) * 100;
  const schedulePct = clamp(expectedProgress) * 100;
  const remainingPct = Math.max(0, 100 - actualPct);
  const curvePoints = buildCurvePoints(spk.tgl_spk, spk.tgl_target_selesai, historyRows, currentRows, today);

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}><div><Link href="/dashboard" style={back}>← Dashboard</Link><div style={brand}>KAVIO</div><div style={title}>Detail SPK</div></div><div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}><div>{user.email}</div><form action="/auth/signout" method="post" style={{ marginTop: 6 }}><button type="submit" style={logout}>Keluar</button></form></div></header>
      <section style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}><div><div style={eyebrow}>SPK CONTROL SHEET</div><h1 style={{ margin: '4px 0 6px', fontSize: 30 }}>{spk.id_kavling}</h1><p style={{ margin: 0, color: '#64748b' }}>SPK {spk.id_spk.slice(0, 8)} · Tipe {spk.id_tipe}</p></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link href={`/progress?spk=${spk.id_spk}`} style={primaryLink}>Input Progress</Link><Link href="/master/spk" style={secondaryLink}>Kembali ke SPK</Link></div></div>
        <section style={gridFour}><Metric label="Progress Akumulasi" value={`${actualPct.toFixed(1)}%`} /><Metric label="Progress Periode Terakhir" value={latestPeriodLabel(latestPeriod)} /><Metric label="Target Selesai" value={spk.tgl_target_selesai} /><Metric label="Sisa Hari" value={daysRemaining < 0 ? `Lewat ${Math.abs(daysRemaining)} hari` : `${daysRemaining} hari`} danger={daysRemaining < 0} warning={daysRemaining >= 0 && daysRemaining <= 7} /></section>
        <section style={{ ...card, marginTop: 16, padding: 18 }}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 1.1fr) repeat(4, minmax(130px, 1fr))', gap: 18, alignItems: 'center' }}><div><div style={mutedLabel}>HEALTH SCORE</div><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 7 }}><div style={healthCircle(healthLevel)}>{healthScore}</div><div><div style={{ fontWeight: 900, fontSize: 18 }}>{healthLevel}</div><div style={{ marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>{decision?.health_description ?? 'Kondisi dipantau oleh Decision Engine.'}</div></div></div></div><Info label="Status Operasional" value="" extra={<StatusBadge status={status} />} /><Info label="Posisi Ritme" value="" extra={<PaceBadge status={paceStatus} />} /><Info label="Gap terhadap Jadwal" value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}%`} tone={gap < -0.05 ? 'danger' : gap < 0 ? 'warning' : 'success'} /><Info label="Prioritas Tindakan" value="" extra={<PriorityBadge priority={actionPriority} />} /></div><div style={{ marginTop: 16, padding: '13px 15px', borderRadius: 12, background: '#102A56', border: '1px solid #B8943F', color: '#F7F3E8' }}><div style={{ fontSize: 11, letterSpacing: 1.1, color: '#DCCB9C', fontWeight: 800 }}>REKOMENDASI DECISION ENGINE</div><div style={{ marginTop: 5, fontWeight: 900 }}>{action}</div></div></section>
        <section style={{ ...card, marginTop: 16, padding: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}><div><div style={sectionTitleNoPad}>Curva-S Progress Pembangunan</div><div style={mutedText}>Rencana berbentuk kurva-S dari Tanggal SPK sampai Target Selesai. Aktual dihitung dari histori progress berbobot. Garis vertikal menandai posisi hari ini.</div></div><div style={{ fontSize: 12, color: '#64748b' }}>Per {today}</div></div><div style={{ overflowX: 'auto' }}><CurvaSChart points={curvePoints} today={today} /></div><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: '#DCCB9C' }}><LegendDot label="Rencana" kind="plan" /><LegendDot label="Aktual" kind="actual" /><LegendDot label="Hari Ini" kind="today" /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 14 }}><MiniStat label="Aktual" value={`${actualPct.toFixed(1)}%`} /><MiniStat label="Rencana Hari Ini" value={`${schedulePct.toFixed(1)}%`} /><MiniStat label="Sisa Progress" value={`${remainingPct.toFixed(1)}%`} /><MiniStat label="Kebutuhan / Hari" value={`${(progressPerDay * 100).toFixed(2)}%`} /></div></section>
        <section style={{ ...card, marginTop: 16, overflow: 'hidden' }}><div style={sectionTitle}>Informasi SPK</div><div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}><Info label="Tanggal SPK" value={spk.tgl_spk} /><Info label="Kantor/Pelaksana" value={office?.nama_kantor_pelaksana ?? spk.id_kantor} /><Info label="Mandor" value={mandor?.nama_mandor ?? spk.id_mandor} /><Info label="Update Terakhir" value={decision?.tanggal_update_terakhir ?? latestPeriod?.date ?? 'Belum ada'} /><Info label="Hari Sejak Update" value={decision?.tanggal_update_terakhir ? `${decision.hari_sejak_update} hari` : 'Belum ada'} /><Info label="Status SPK" value={spk.status_spk} /><Info label="Target Selesai" value={spk.tgl_target_selesai} /><Info label="Sisa Hari" value={daysRemaining < 0 ? `Lewat ${Math.abs(daysRemaining)} hari` : `${daysRemaining} hari`} /></div></section>
        <section style={{ ...card, marginTop: 16, overflow: 'hidden' }}><div style={sectionTitle}>Progress per Kategori</div><div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={th}>Kategori</th><th style={th}>Bobot</th><th style={th}>Akumulasi</th><th style={th}>Berbobot</th><th style={th}>Update Terakhir</th></tr></thead><tbody>{currentRows.map((row) => <tr key={row.id_kategori}><td style={tdStrong}>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td style={td}>{(Number(row.bobot_final) * 100).toFixed(2)}%</td><td style={td}>{(Number(row.progress_akumulasi) * 100).toFixed(2)}%</td><td style={td}>{(Number(row.progress_berbobot) * 100).toFixed(2)}%</td><td style={td}>{row.tanggal_update_terakhir ?? 'Belum ada'}</td></tr>)}{!currentRows.length && <tr><td colSpan={5} style={empty}>Belum ada progress kategori.</td></tr>}</tbody></table></div></section>
        <section style={{ ...card, marginTop: 16, overflow: 'hidden' }}><div style={sectionTitle}>Histori Progress Terbaru</div><div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={th}>Tanggal</th><th style={th}>Kategori</th><th style={th}>Periode</th><th style={th}>Keterangan</th></tr></thead><tbody>{historyRows.slice().reverse().slice(0, 30).map((row) => <tr key={row.id_progress}><td style={td}>{row.tanggal_update}</td><td style={td}>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td style={tdStrong}>{(Number(row.progress_periode) * 100).toFixed(2)}%</td><td style={td}>{row.keterangan || '—'}</td></tr>)}{!historyRows.length && <tr><td colSpan={4} style={empty}>Belum ada histori progress.</td></tr>}</tbody></table></div></section>
      </section>
    </main>
  );
}

function buildCurvePoints(start: string, target: string, history: History[], currentRows: Current[], today: string) {
  const startMs = dateMs(start);
  const targetMs = dateMs(target);
  const todayMs = dateMs(today);
  const totalMs = Math.max(1, targetMs - startMs);
  const sortedHistory = [...history].sort((a, b) => a.tanggal_update.localeCompare(b.tanggal_update));
  const byDate = new Map<string, number>();
  const cumulativeByCategory = new Map<string, number>();
  const weightByCategory = new Map(currentRows.map((row) => [row.id_kategori, Number(row.bobot_final)]));

  for (const row of sortedHistory) {
    const previous = cumulativeByCategory.get(row.id_kategori) ?? 0;
    const next = Math.min(1, previous + Number(row.progress_periode ?? 0));
    cumulativeByCategory.set(row.id_kategori, next);
    const weighted = [...cumulativeByCategory.entries()].reduce((sum, [category, progress]) => sum + progress * (weightByCategory.get(category) ?? 0), 0);
    byDate.set(row.tanggal_update, weighted);
  }

  const lastActualDate = sortedHistory.at(-1)?.tanggal_update ?? start;
  const lastActual = byDate.get(lastActualDate) ?? 0;
  const effectiveToday = todayMs < startMs ? start : today;
  const dates = Array.from(new Set([start, ...sortedHistory.map((row) => row.tanggal_update).filter((date) => date <= effectiveToday), effectiveToday, target])).sort();
  let latestActual = 0;

  return dates.map((date) => {
    if (byDate.has(date)) latestActual = Number(byDate.get(date));
    if (date === effectiveToday && dateMs(date) >= dateMs(lastActualDate)) latestActual = lastActual;
    const elapsed = Math.min(1, Math.max(0, (dateMs(date) - startMs) / totalMs));
    const planned = elapsed <= 0 ? 0 : elapsed >= 1 ? 1 : elapsed * elapsed * (3 - 2 * elapsed);
    return { date, planned, actual: dateMs(date) <= todayMs ? latestActual : null };
  });
}
function CurvaSChart({ points, today }: { points: { date: string; planned: number; actual: number | null }[]; today: string }) { const width = 1100; const height = 390; const left = 58; const right = 30; const top = 24; const bottom = 54; const plotW = width - left - right; const plotH = height - top - bottom; const xs = points.map((p) => dateMs(p.date)); const minX = Math.min(...xs, dateMs(points[0]?.date ?? today)); const maxX = Math.max(...xs, dateMs(points.at(-1)?.date ?? today)); const span = Math.max(1, maxX - minX); const x = (date: string) => left + ((dateMs(date) - minX) / span) * plotW; const y = (value: number) => top + (1 - clamp(value)) * plotH; const planPath = interpolatePath(points.map((p) => ({ x: x(p.date), y: y(p.planned) }))); const actualPoints = points.filter((p) => p.actual !== null).map((p) => ({ x: x(p.date), y: y(Number(p.actual)), date: p.date })); const actualPath = interpolatePath(actualPoints.map((p) => ({ x: p.x, y: p.y }))); const todayX = x(clampDate(today, points[0]?.date ?? today, points.at(-1)?.date ?? today)); const gridValues = [0, 0.25, 0.5, 0.75, 1]; const labels = makeDateLabels(points, 5); return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva-S progress pembangunan" style={{ width: '100%', minWidth: 760, display: 'block', background: '#102A56', borderRadius: 12, border: '1px solid #B8943F' }}>{gridValues.map((v) => <g key={v}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="rgba(220,203,156,.20)" strokeWidth="1" /><text x={left - 10} y={y(v) + 4} textAnchor="end" fill="#DCCB9C" fontSize="12">{Math.round(v * 100)}%</text></g>)}<line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#D8B45A" strokeWidth="1" /><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#D8B45A" strokeWidth="1" />{labels.map((label) => <g key={label.date}><line x1={x(label.date)} x2={x(label.date)} y1={height - bottom} y2={height - bottom + 7} stroke="#D8B45A" /><text x={x(label.date)} y={height - 18} textAnchor="middle" fill="#DCCB9C" fontSize="11">{formatMonth(label.date)}</text></g>)}<line x1={todayX} x2={todayX} y1={top} y2={height - bottom} stroke="#E8CC7A" strokeDasharray="6 5" strokeWidth="2" /><path d={planPath} fill="none" stroke="#DCCB9C" strokeWidth="4" strokeLinecap="round" />{actualPath && <path d={actualPath} fill="none" stroke="#E8CC7A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}{actualPoints.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r="4" fill="#F7F3E8" stroke="#D8B45A" strokeWidth="2" />)}<text x={width - right} y={top + 12} textAnchor="end" fill="#E8CC7A" fontSize="12" fontWeight="700">Rencana</text>{actualPoints.length > 0 && <text x={actualPoints.at(-1)!.x} y={Math.max(top + 18, actualPoints.at(-1)!.y - 12)} textAnchor="middle" fill="#F7F3E8" fontSize="12" fontWeight="700">Aktual</text>}<text x={todayX + 7} y={top + 18} fill="#E8CC7A" fontSize="11" fontWeight="700">HARI INI</text></svg>; }
function interpolatePath(points: { x: number; y: number }[]) { if (!points.length) return ''; if (points.length === 1) return `M ${points[0].x} ${points[0].y}`; let d = `M ${points[0].x} ${points[0].y}`; for (let i = 1; i < points.length; i += 1) { const prev = points[i - 1]; const curr = points[i]; const dx = (curr.x - prev.x) / 3; d += ` C ${prev.x + dx} ${prev.y}, ${curr.x - dx} ${curr.y}, ${curr.x} ${curr.y}`; } return d; }
function makeDateLabels(points: { date: string }[], count: number) { if (!points.length) return []; const picked: { date: string }[] = []; for (let i = 0; i < count; i += 1) picked.push(points[Math.round((i * (points.length - 1)) / Math.max(1, count - 1))]); return Array.from(new Map(picked.map((p) => [p.date, p])).values()); }
function formatMonth(date: string) { return new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function clampDate(date: string, minDate: string, maxDate: string) { return date < minDate ? minDate : date > maxDate ? maxDate : date; }
function dateMs(date: string) { return new Date(`${date}T00:00:00Z`).getTime(); }
function latestPeriodLabel(latestPeriod: { date: string; progress: number } | null) { return latestPeriod ? `${(latestPeriod.progress * 100).toFixed(2)}%` : '—'; }
function getLatestPeriod(rows: History[]) { if (!rows.length) return null; const date = rows[rows.length - 1].tanggal_update; const progress = rows.filter((row) => row.tanggal_update === date).reduce((sum, row) => sum + Number(row.progress_periode ?? 0), 0); return { date, progress }; }
function differenceInDays(fromDate: string, toDate: string) { return Math.round((dateMs(toDate) - dateMs(fromDate)) / 86400000); }
function getExpectedProgress(spk: Spk, today: string) { const totalDays = differenceInDays(spk.tgl_spk, spk.tgl_target_selesai); if (totalDays <= 0) return today >= spk.tgl_target_selesai ? 1 : 0; return clamp(differenceInDays(spk.tgl_spk, today) / totalDays); }
function getPaceStatus(gap: number): PaceStatus { if (gap <= -0.05) return 'TERTINGGAL'; if (gap >= 0.05) return 'DI DEPAN'; return 'SESUAI RITME'; }
function getFallbackHealth(status: OperationalStatus, gap: number, daysRemaining: number): HealthLevel { if (status === 'LEWAT TARGET' || gap <= -0.1) return 'KRITIS'; if (status === 'PERHATIAN' || daysRemaining <= 7 || gap < 0) return 'WASPADA'; return 'SEHAT'; }
function Metric({ label, value, warning = false, danger = false }: { label: string; value: string; warning?: boolean; danger?: boolean }) { return <div style={{ ...card, padding: 18, borderColor: danger ? '#fecaca' : warning ? '#fde68a' : undefined }}><div style={mutedLabel}>{label}</div><div style={{ marginTop: 8, fontWeight: 800, fontSize: 24, color: danger ? '#fca5a5' : warning ? '#E8CC7A' : '#F7F3E8' }}>{value}</div></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div style={{ background: '#162F5B', border: '1px solid rgba(216,180,90,.25)', borderRadius: 10, padding: '10px 12px' }}><div style={{ color: '#DCCB9C', fontSize: 11 }}>{label}</div><div style={{ marginTop: 3, fontWeight: 800, color: '#F7F3E8' }}>{value}</div></div>; }
function LegendDot({ label, kind }: { label: string; kind: 'plan' | 'actual' | 'today' }) { const styles = kind === 'plan' ? { background: '#DCCB9C' } : kind === 'actual' ? { background: '#E8CC7A' } : { background: '#102A56', border: '2px dashed #D8B45A' }; return <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: kind === 'today' ? 2 : 999, ...styles }} />{label}</span>; }
function Info({ label, value, tone = 'default', extra }: { label: string; value: string; tone?: 'default' | 'danger' | 'warning' | 'success'; extra?: React.ReactNode }) { const color = tone === 'danger' ? '#fca5a5' : tone === 'warning' ? '#E8CC7A' : tone === 'success' ? '#86efac' : '#F7F3E8'; return <div><div style={mutedLabel}>{label}</div><div style={{ marginTop: 6, fontWeight: 700, color }}>{extra ?? value}</div></div>; }
function StatusBadge({ status }: { status: OperationalStatus }) { const s = statusStyles[status]; return <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>; }
function PaceBadge({ status }: { status: PaceStatus }) { const s = paceStyles[status]; return <span style={{ display: 'inline-flex', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>; }
function PriorityBadge({ priority }: { priority: ActionPriority }) { const s = priorityStyles[priority]; return <span style={{ display: 'inline-flex', padding: '5px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>{priority}</span>; }
function healthCircle(level: HealthLevel) { const map = { SEHAT: '#D8B45A', WASPADA: '#E8CC7A', KRITIS: '#fca5a5' }; return { width: 54, height: 54, borderRadius: '50%', border: `3px solid ${map[level]}`, display: 'grid', placeItems: 'center', fontWeight: 900, color: map[level], background: 'rgba(11,29,58,.65)', flex: '0 0 auto' }; }
const statusStyles: Record<OperationalStatus, { background: string; color: string; border: string }> = { BERJALAN: { background: 'rgba(216,180,90,.10)', color: '#E8CC7A', border: '#B8943F' }, PERHATIAN: { background: 'rgba(232,204,122,.12)', color: '#E8CC7A', border: '#D8B45A' }, 'LEWAT TARGET': { background: 'rgba(248,113,113,.10)', color: '#fecaca', border: '#b91c1c' }, SELESAI: { background: 'rgba(134,239,172,.10)', color: '#bbf7d0', border: '#15803d' } };
const paceStyles: Record<PaceStatus, { background: string; color: string; border: string }> = { 'DI DEPAN': { background: 'rgba(216,180,90,.10)', color: '#E8CC7A', border: '#B8943F' }, 'SESUAI RITME': { background: 'rgba(220,203,156,.08)', color: '#DCCB9C', border: '#B8943F' }, TERTINGGAL: { background: 'rgba(248,113,113,.10)', color: '#fecaca', border: '#b91c1c' } };
const priorityStyles: Record<ActionPriority, { background: string; color: string; border: string }> = { TINGGI: { background: 'rgba(248,113,113,.10)', color: '#fecaca', border: '#b91c1c' }, SEDANG: { background: 'rgba(232,204,122,.12)', color: '#E8CC7A', border: '#D8B45A' }, NORMAL: { background: 'rgba(220,203,156,.08)', color: '#DCCB9C', border: '#B8943F' } };
const header = { background: '#102A56', borderBottom: '1px solid #B8943F', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#DCCB9C', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#E8CC7A' };
const title = { fontSize: 21, fontWeight: 800, color: '#F7F3E8' };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#E8CC7A' };
const logout = { border: 0, background: 'transparent', color: '#E8CC7A', fontWeight: 700, cursor: 'pointer' };
const card = { background: '#162F5B', border: '1px solid #B8943F', borderRadius: 16, boxShadow: '0 10px 28px rgba(0,0,0,.18)' };
const gridFour = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 };
const sectionTitle = { padding: 18, borderBottom: '1px solid rgba(216,180,90,.25)', fontWeight: 800, color: '#F7F3E8' };
const sectionTitleNoPad = { fontWeight: 800, color: '#F7F3E8' };
const mutedLabel = { color: '#DCCB9C', fontSize: 12, fontWeight: 700 };
const mutedText = { color: '#DCCB9C', fontSize: 12, marginTop: 4, lineHeight: 1.5 };
const table = { width: '100%', borderCollapse: 'collapse' as const, color: '#F7F3E8' };
const th = { padding: '12px 14px', borderBottom: '1px solid rgba(216,180,90,.25)', textAlign: 'left' as const, whiteSpace: 'nowrap', color: '#E8CC7A' };
const td = { padding: '13px 14px', borderBottom: '1px solid rgba(216,180,90,.12)', color: '#F7F3E8' };
const tdStrong = { ...td, fontWeight: 800 };
const empty = { padding: 32, textAlign: 'center' as const, color: '#DCCB9C' };
const primaryLink = { background: 'linear-gradient(180deg,#E8CC7A,#D8B45A)', color: '#0B1D3A', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 14 };
const secondaryLink = { background: '#102A56', color: '#E8CC7A', border: '1px solid #B8943F', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
