import CurvaSChart,{buildCurvePoints} from '../../../components/KavioSCurve';
import Link from 'next/link';
import KavioDecisionPanel from '../../../components/KavioDecisionPanel';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { formatKavioDate } from '../../../lib/date-format';

type Params = Promise<{ id: string }>; type SearchParams = Promise<{ from?: string | string[] }>; 
type Spk = { id_spk: string; no_spk:string; id_kavling: string | null; id_tipe: string | null; jenis_spk:'KAVLING'|'FASUM'; nama_objek:string|null; id_kantor: string; id_mandor: string; jenis_bobot: string; tgl_spk: string; tgl_target_selesai: string; status_spk: string; is_active: boolean };
type Current = { id_kategori: string; progress_akumulasi: number | string; bobot_final: number | string; progress_berbobot: number | string; tanggal_update_terakhir: string | null };
type Config = { id_kategori: string; bobot_final: number | string };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };
type History = { id_progress: string; tanggal_update: string; id_kategori: string; progress_periode: number | string; keterangan: string | null };
type CurveHistory = { tanggal_update: string; progress_aktual: number | string };
type Decision = { progress_aktual: number | string; progress_seharusnya: number | string; gap_progress: number | string; sisa_hari: number; tanggal_update_terakhir: string | null; progress_periode_terakhir: number | string; status_operasional: OperationalStatus; status_ritme: PaceStatus; prioritas_tindakan: ActionPriority; action_rekomendasi: string; hari_sejak_update: number; progress_diperlukan_per_hari: number | string; health_score: number; health_level: HealthLevel; health_description: string };
type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';
type ActionPriority = 'TINGGI' | 'SEDANG' | 'NORMAL';
type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';

export default async function SpkDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const fromProgress = query.from === 'progress' || (Array.isArray(query.from) && query.from.includes('progress'));
  const returnHref = fromProgress ? '/progress' : '/master/spk';
  const returnLabel = fromProgress ? 'Kembali ke Progress' : 'Kembali ke SPK';
  const supabase = await createClient();

  // Control Sheet critical path: every query that only needs the SPK id starts
  // immediately. Office and mandor names wait only for the SPK identity row.
  const [
    { data: spkData },
    { data: currentData },
    { data: categories },
    { data: history },
    { data: curveHistoryData },
    { data: configData },
    { data: decisionData },
  ] = await Promise.all([
    supabase.from('spk').select('id_spk,no_spk, id_kavling, id_tipe, jenis_spk, nama_objek, id_kantor, id_mandor, jenis_bobot, tgl_spk, tgl_target_selesai, status_spk, is_active').eq('id_spk', id).maybeSingle(),
    supabase.from('v_spk_work_item_progress_current').select('id_kategori:id_item, progress_akumulasi, bobot_final, progress_berbobot, tanggal_update_terakhir').eq('id_spk', id).order('urutan'),
    supabase.from('spk_work_item').select('id_kategori:id_item, nama_kategori:nama_pekerjaan, urutan').eq('id_spk',id).order('urutan'),
    supabase.from('progress_update').select('id_progress, tanggal_update, id_kategori:id_item, progress_periode, keterangan').eq('id_spk', id).order('tanggal_update', { ascending: false }).order('created_at',{ascending:false}).limit(30),
    supabase.rpc('kavio_spk_curve_history', { p_id_spk: id }),
    supabase.from('spk_work_item').select('id_kategori:id_item, bobot_final:bobot').eq('id_spk', id).order('urutan'),
    supabase.from('v_decision_engine').select('progress_aktual, progress_seharusnya, gap_progress, sisa_hari, tanggal_update_terakhir, progress_periode_terakhir, status_operasional, status_ritme, prioritas_tindakan, action_rekomendasi, hari_sejak_update, progress_diperlukan_per_hari, health_score, health_level, health_description').eq('id_spk', id).maybeSingle(),
  ]);

  if (!spkData) notFound();
  const spk = spkData as Spk;

  const [{ data: office }, { data: mandor }] = await Promise.all([
    supabase.from('master_kantor_pelaksana').select('nama_kantor_pelaksana').eq('id_kantor', spk.id_kantor).maybeSingle(),
    supabase.from('master_mandor').select('nama_mandor').eq('id_mandor', spk.id_mandor).maybeSingle(),
  ]);

  const currentRows = (currentData ?? []) as Current[];
  const configRows = (configData ?? []) as Config[];
  const categoryRows = (categories ?? []) as Category[];
  const historyRows = (history ?? []) as History[];
  const curveHistory = (curveHistoryData ?? []) as CurveHistory[];
  const decision = decisionData as Decision | null;
  const categoryMap = new Map(categoryRows.map((row) => [row.id_kategori, row]));
  const progressMap = new Map(currentRows.map((row) => [row.id_kategori, row]));
  const snapshotRows = configRows
    .map((row) => {
      const current = progressMap.get(row.id_kategori);
      return {
        id_kategori: row.id_kategori,
        bobot_final: Number(row.bobot_final),
        progress_akumulasi: Number(current?.progress_akumulasi ?? 0),
        progress_berbobot: Number(current?.progress_berbobot ?? (Number(current?.progress_akumulasi ?? 0) * Number(row.bobot_final))),
        tanggal_update_terakhir: current?.tanggal_update_terakhir ?? null,
      };
    })
    .sort((a, b) => (categoryMap.get(a.id_kategori)?.urutan ?? 9999) - (categoryMap.get(b.id_kategori)?.urutan ?? 9999));
  const progressTotal = Number(decision?.progress_aktual ?? snapshotRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0));
  const latestPeriod = decision?.tanggal_update_terakhir
    ? { date: decision.tanggal_update_terakhir, progress: Number(decision.progress_periode_terakhir ?? 0) }
    : getLatestPeriod(historyRows, configRows);
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
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
  const curvePoints = buildCurvePoints(spk.tgl_spk, spk.tgl_target_selesai, curveHistory, today);

  return (
    <main className="spk-detail-page">
      <section className="spk-detail-content">
        <div className="spk-detail-identity">
          <div><div className="spk-detail-eyebrow">SPK CONTROL SHEET</div><h2 className="spk-detail-kavling">{spk.jenis_spk==='FASUM'?`FASUM · ${spk.nama_objek ?? spk.id_spk}`:spk.id_kavling}</h2><p className="spk-detail-subtitle">{spk.no_spk}{spk.id_tipe ? ` · Tipe ${spk.id_tipe}` : ''}</p></div>
          <div className="spk-detail-actions"><Link href={`/progress?spk=${spk.id_spk}`} className="kavio-command-button">Input Progress</Link><Link href={returnHref} className="kavio-command-button secondary">{returnLabel}</Link></div>
        </div>
        <section className="spk-detail-kpi-grid"><Metric label="Progress Akumulasi" value={`${actualPct.toFixed(1)}%`} /><Metric label="Progress Periode Terakhir" value={latestPeriodLabel(latestPeriod)} /><Metric label="Target Selesai" value={formatKavioDate(spk.tgl_target_selesai)} /><Metric label="Sisa Hari" value={daysRemaining < 0 ? `Lewat ${Math.abs(daysRemaining)} hari` : `${daysRemaining} hari`} danger={daysRemaining < 0} warning={daysRemaining >= 0 && daysRemaining <= 7} /></section>
        <KavioDecisionPanel decision={decision} gap={gap}/>
        <section className="spk-detail-curve-panel"><div className="spk-detail-section-head"><div><div style={sectionTitleNoPad}>Curva-S Progress Pembangunan</div><div style={mutedText}>Rencana berbentuk kurva-S dari Tanggal SPK sampai Target Selesai. Aktual dihitung dari histori progress berbobot. Garis vertikal menandai posisi hari ini.</div></div><div style={{ fontSize: 12, color: '#64748b' }}>Per {today}</div></div><div style={{ overflowX: 'auto' }}><CurvaSChart points={curvePoints} today={today} /></div><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: '#DCCB9C' }}><LegendDot label="Rencana" kind="plan" /><LegendDot label="Aktual" kind="actual" /><LegendDot label="Hari Ini" kind="today" /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 14 }}><MiniStat label="Aktual" value={`${actualPct.toFixed(1)}%`} /><MiniStat label="Rencana Hari Ini" value={`${schedulePct.toFixed(1)}%`} /><MiniStat label="Sisa Progress" value={`${remainingPct.toFixed(1)}%`} /><MiniStat label="Kebutuhan / Hari" value={`${(progressPerDay * 100).toFixed(2)}%`} /></div></section>
        <section className="spk-detail-info-panel"><div className="spk-detail-section-title">Informasi SPK</div><div className="spk-detail-info-grid"><Info label="Tanggal SPK" value={formatKavioDate(spk.tgl_spk)} /><Info label="Jenis Bobot" value={spk.jenis_bobot} /><Info label="Kantor/Pelaksana" value={office?.nama_kantor_pelaksana ?? spk.id_kantor} /><Info label="Mandor" value={mandor?.nama_mandor ?? spk.id_mandor} /><Info label="Update Terakhir" value={decision?.tanggal_update_terakhir ? formatKavioDate(decision.tanggal_update_terakhir) : latestPeriod?.date ? formatKavioDate(latestPeriod.date) : 'Belum ada'} /><Info label="Hari Sejak Update" value={decision?.tanggal_update_terakhir ? `${decision.hari_sejak_update} hari` : 'Belum ada'} /><Info label="Status SPK" value={spk.status_spk} /><Info label="Target Selesai" value={formatKavioDate(spk.tgl_target_selesai)} /></div></section>
        <div className="spk-detail-progress-panels">
        <section className="spk-detail-snapshot-panel"><div className="spk-detail-section-head"><div><div style={sectionTitleNoPad}>Progress &amp; Bobot Final SPK</div></div></div><div className="kavio-table-wrap"><table className="kavio-table spk-detail-table"><thead><tr><th>#</th><th>Pekerjaan</th><th>Bobot Final</th><th>Progress Akumulasi</th><th>Kontribusi</th><th>Update Terakhir</th></tr></thead><tbody>{snapshotRows.map((row) => <tr key={row.id_kategori}><td>{categoryMap.get(row.id_kategori)?.urutan ?? '—'}</td><td>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td>{(Number(row.bobot_final) * 100).toFixed(2)}%</td><td>{(Number(row.progress_akumulasi) * 100).toFixed(2)}%</td><td>{(Number(row.progress_berbobot) * 100).toFixed(2)}%</td><td>{row.tanggal_update_terakhir ? formatKavioDate(row.tanggal_update_terakhir) : 'Belum ada'}</td></tr>)}{!snapshotRows.length && <tr><td colSpan={6}>Konfigurasi bobot SPK belum tersedia.</td></tr>}</tbody></table></div></section>

        <section className="spk-detail-data-panel"><div className="spk-detail-section-title">Histori Progress Terbaru</div><div className="kavio-table-wrap"><table className="kavio-table spk-detail-table"><thead><tr><th>Tanggal</th><th>Pekerjaan</th><th>Periode</th><th>Keterangan</th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id_progress}><td>{formatKavioDate(row.tanggal_update)}</td><td>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td>{(Number(row.progress_periode) * 100).toFixed(2)}%</td><td>{row.keterangan || '—'}</td></tr>)}{!historyRows.length && <tr><td colSpan={4}>Belum ada histori progress.</td></tr>}</tbody></table></div></section>

        </div>
      </section>
    </main>
  );
}

function clamp(value: number) { return Math.min(1, Math.max(0, value)); }
function dateMs(date: string) { return new Date(`${date}T00:00:00Z`).getTime(); }
function latestPeriodLabel(latestPeriod: { date: string; progress: number } | null) { return latestPeriod ? `${(latestPeriod.progress * 100).toFixed(2)}%` : '—'; }
function getLatestPeriod(rows: History[], configRows: Config[]) { if (!rows.length) return null; const date = rows.reduce((latest, row) => row.tanggal_update > latest ? row.tanggal_update : latest, rows[0].tanggal_update); const weightByCategory = new Map(configRows.map((row) => [row.id_kategori, Number(row.bobot_final)])); const progress = rows.filter((row) => row.tanggal_update === date).reduce((sum, row) => sum + Math.max(0, Math.min(1, Number(row.progress_periode ?? 0))) * (weightByCategory.get(row.id_kategori) ?? 0), 0); return { date, progress: Math.min(1, progress) }; }
function differenceInDays(fromDate: string, toDate: string) { return Math.round((dateMs(toDate) - dateMs(fromDate)) / 86400000); }
function getExpectedProgress(spk: Spk, today: string) { const totalDays = differenceInDays(spk.tgl_spk, spk.tgl_target_selesai); if (totalDays <= 0) return today >= spk.tgl_target_selesai ? 1 : 0; return clamp(differenceInDays(spk.tgl_spk, today) / totalDays); }
function getPaceStatus(gap: number): PaceStatus { if (gap <= -0.05) return 'TERTINGGAL'; if (gap >= 0.05) return 'DI DEPAN'; return 'SESUAI RITME'; }
function getFallbackHealth(status: OperationalStatus, gap: number, daysRemaining: number): HealthLevel { if (status === 'LEWAT TARGET' || gap <= -0.1) return 'KRITIS'; if (status === 'PERHATIAN' || daysRemaining <= 7 || gap < 0) return 'WASPADA'; return 'SEHAT'; }
function Metric({ label, value, warning = false, danger = false }: { label: string; value: string; warning?: boolean; danger?: boolean }) { return <div style={{ ...card, padding: 18, borderColor: danger ? '#fecaca' : warning ? '#fde68a' : undefined }}><div style={mutedLabel}>{label}</div><div style={{ marginTop: 8, fontWeight: 800, fontSize: 24, color: danger ? '#fca5a5' : warning ? '#E8CC7A' : '#F7F3E8' }}>{value}</div></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div style={{ background: '#162F5B', border: '1px solid rgba(216,180,90,.25)', borderRadius: 10, padding: '10px 12px' }}><div style={{ color: '#DCCB9C', fontSize: 11 }}>{label}</div><div style={{ marginTop: 3, fontWeight: 800, color: '#F7F3E8' }}>{value}</div></div>; }
function LegendDot({ label, kind }: { label: string; kind: 'plan' | 'actual' | 'today' }) { const styles = kind === 'plan' ? { background: '#DCCB9C' } : kind === 'actual' ? { background: '#22C55E' } : { background: '#102A56', border: '2px dashed #D8B45A' }; return <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: kind === 'today' ? 2 : 999, ...styles }} />{label}</span>; }
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
const empty = { padding: 24, textAlign: 'center' as const, color: '#DCCB9C' };
const primaryLink = { background: 'linear-gradient(180deg,#E8CC7A,#D8B45A)', color: '#0B1D3A', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 14 };
const secondaryLink = { background: '#102A56', color: '#E8CC7A', border: '1px solid #B8943F', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
