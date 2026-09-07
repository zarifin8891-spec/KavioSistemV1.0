import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

type SummaryRow = {
  id_spk: string;
  id_kavling: string;
  progress_total: number | string;
  tgl_spk: string;
  tgl_target_selesai: string;
  status_spk: string;
};

type ProgressUpdate = {
  id_spk: string;
  tanggal_update: string;
  progress_periode: number | string;
};

type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: summary, error }, { data: updates, error: updatesError }] = await Promise.all([
    supabase
      .from('v_progress_summary')
      .select('id_spk, id_kavling, progress_total, tgl_spk, tgl_target_selesai, status_spk')
      .neq('status_spk', 'DRAFT')
      .order('tgl_target_selesai', { ascending: true })
      .limit(50),
    supabase
      .from('progress_update')
      .select('id_spk, tanggal_update, progress_periode')
      .order('tanggal_update', { ascending: false })
      .limit(500),
  ]);

  const rows = (summary ?? []) as SummaryRow[];
  const latestBySpk = getLatestPeriodBySpk((updates ?? []) as ProgressUpdate[]);
  const today = new Date().toISOString().slice(0, 10);
  const avgProgress = rows.length ? rows.reduce((total, row) => total + Number(row.progress_total ?? 0), 0) / rows.length : 0;
  const statusCounts = rows.reduce((acc, row) => { const status = getOperationalStatus(row, latestBySpk.get(row.id_spk), today); acc[status] += 1; return acc; }, { BERJALAN: 0, PERHATIAN: 0, 'LEWAT TARGET': 0, SELESAI: 0 } as Record<OperationalStatus, number>);
  const attentionRows = rows.filter((row) => ['PERHATIAN', 'LEWAT TARGET'].includes(getOperationalStatus(row, latestBySpk.get(row.id_spk), today)));
  const paceRows = rows.filter((row) => getPaceStatus(row, today) === 'TERTINGGAL');

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}>
        <div><div style={brand}>KAVIO</div><div style={title}>Monitor V1.0</div></div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 6 }}><button type="submit" style={logout}>Keluar</button></form>
        </div>
      </header>

      <section style={{ padding: 28, maxWidth: 1480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div><div style={eyebrow}>CONTROL ROOM</div><h1 style={{ margin: '4px 0 6px', fontSize: 30 }}>Dashboard Monitoring</h1><p style={{ margin: 0, color: '#64748b' }}>Pantau progress aktual, ritme update, target selesai, dan kondisi setiap SPK dari satu layar.</p></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link href="/master/spk" style={primaryLink}>Kelola SPK</Link><Link href="/progress" style={progressLink}>Input Progress</Link><Link href="/master/kavling" style={secondaryLink}>Master Kavling</Link></div>
        </div>

        {(error || updatesError) && <div style={alertError}>Gagal membaca sebagian data dashboard: {(error ?? updatesError)?.message}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <Kpi label="Kavling Terpantau" value={String(rows.length)} helper="SPK aktif/terpantau" />
          <Kpi label="Rata-rata Progress" value={`${(avgProgress * 100).toFixed(1)}%`} helper="Progress berbobot" />
          <Kpi label="SPK Berjalan" value={String(statusCounts.BERJALAN)} helper="Kondisi normal" />
          <Kpi label="Perlu Perhatian" value={String(statusCounts.PERHATIAN + statusCounts['LEWAT TARGET'])} helper={`${statusCounts.PERHATIAN} perhatian · ${statusCounts['LEWAT TARGET']} lewat target`} warning />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatusCount label="BERJALAN" value={statusCounts.BERJALAN} />
          <StatusCount label="PERHATIAN" value={statusCounts.PERHATIAN} />
          <StatusCount label="LEWAT TARGET" value={statusCounts['LEWAT TARGET']} />
          <StatusCount label="SELESAI" value={statusCounts.SELESAI} />
        </div>

        {(attentionRows.length > 0 || paceRows.length > 0) && (
          <section style={{ ...card, marginBottom: 16, padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Perlu Tindakan</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4, marginBottom: 12 }}>SPK yang membutuhkan perhatian berdasarkan target, kedisiplinan update, dan ritme progress terhadap waktu.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {attentionRows.slice(0, 8).map((row) => <Link key={row.id_spk} href={`/master/spk/detail/${row.id_spk}`} style={actionChip}><strong>{row.id_kavling}</strong><StatusBadge status={getOperationalStatus(row, latestBySpk.get(row.id_spk), today)} /></Link>)}
              {paceRows.filter((row) => !attentionRows.some((item) => item.id_spk === row.id_spk)).slice(0, 8).map((row) => <Link key={`pace-${row.id_spk}`} href={`/master/spk/detail/${row.id_spk}`} style={actionChip}><strong>{row.id_kavling}</strong><PaceBadge status="TERTINGGAL" /></Link>)}
            </div>
          </section>
        )}

        <section style={card}>
          <div style={{ padding: 18, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div><div style={sectionTitle}>Monitoring SPK</div><div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Progress aktual dibandingkan dengan progress seharusnya berdasarkan waktu yang telah berjalan.</div></div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Per tanggal {today}</div>
          </div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 1250 }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={th}>Kavling</th><th style={th}>Progress Aktual</th><th style={th}>Seharusnya</th><th style={th}>Gap</th><th style={th}>Periode Terakhir</th><th style={th}>Update Terakhir</th><th style={th}>Target</th><th style={th}>Sisa Hari</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const latest = latestBySpk.get(row.id_spk);
                const operationalStatus = getOperationalStatus(row, latest, today);
                const daysRemaining = differenceInDays(today, row.tgl_target_selesai);
                const progress = clamp(Number(row.progress_total ?? 0));
                const expectedProgress = getExpectedProgress(row, today);
                const gap = progress - expectedProgress;
                const paceStatus = getPaceStatus(row, today);
                return <tr key={row.id_spk}>
                  <td style={td}><Link href={`/master/spk/detail/${row.id_spk}`} style={kavlingLink}>{row.id_kavling}</Link><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>SPK {row.id_spk.slice(0, 8)}</div></td>
                  <td style={tdWide}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 800, marginBottom: 6 }}><span>{(progress * 100).toFixed(1)}%</span><span style={{ color: '#64748b', fontWeight: 600 }}>Sisa {(Math.max(0, 1 - progress) * 100).toFixed(1)}%</span></div><div style={progressTrack}><div style={{ ...progressFill, width: `${progress * 100}%` }} /></div></td>
                  <td style={td}><strong>{(expectedProgress * 100).toFixed(1)}%</strong><div style={{ marginTop: 4 }}><PaceBadge status={paceStatus} /></div></td>
                  <td style={{ ...td, fontWeight: 800, color: gap < -0.05 ? '#b91c1c' : gap < 0 ? '#b45309' : '#15803d' }}>{gap >= 0 ? '+' : ''}{(gap * 100).toFixed(1)}%</td>
                  <td style={td}><strong>{latest ? `${(latest.progress * 100).toFixed(2)}%` : '—'}</strong><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{latest ? 'progress periode' : 'belum ada update'}</div></td>
                  <td style={td}>{latest?.date ?? 'Belum ada'}</td>
                  <td style={td}>{row.tgl_target_selesai}</td>
                  <td style={{ ...td, fontWeight: 800, color: daysRemaining < 0 ? '#b91c1c' : daysRemaining <= 7 ? '#b45309' : '#0f172a' }}>{daysRemaining < 0 ? `Lewat ${Math.abs(daysRemaining)} hari` : `${daysRemaining} hari`}</td>
                  <td style={td}><StatusBadge status={operationalStatus} /></td>
                </tr>;
              })}
              {!rows.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: 40, color: '#64748b' }}>Belum ada data SPK yang dapat dimonitor.</td></tr>}
            </tbody>
          </table></div>
        </section>
      </section>
    </main>
  );
}

function clamp(value: number) { return Math.min(1, Math.max(0, value)); }
function getLatestPeriodBySpk(rows: ProgressUpdate[]) { const grouped = new Map<string, { date: string; progress: number }>(); for (const row of rows) { const current = grouped.get(row.id_spk); if (!current || row.tanggal_update > current.date) grouped.set(row.id_spk, { date: row.tanggal_update, progress: Number(row.progress_periode ?? 0) }); else if (row.tanggal_update === current.date) current.progress += Number(row.progress_periode ?? 0); } return grouped; }
function differenceInDays(fromDate: string, toDate: string) { return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000); }
function getExpectedProgress(row: SummaryRow, today: string) { const totalDays = differenceInDays(row.tgl_spk, row.tgl_target_selesai); if (totalDays <= 0) return today >= row.tgl_target_selesai ? 1 : 0; return clamp(differenceInDays(row.tgl_spk, today) / totalDays); }
function getPaceStatus(row: SummaryRow, today: string): PaceStatus { const actual = clamp(Number(row.progress_total ?? 0)); const expected = getExpectedProgress(row, today); if (actual - expected <= -0.05) return 'TERTINGGAL'; if (actual - expected >= 0.05) return 'DI DEPAN'; return 'SESUAI RITME'; }
function getOperationalStatus(row: SummaryRow, latest: { date: string; progress: number } | undefined, today: string): OperationalStatus { const progress = Number(row.progress_total ?? 0); if (row.status_spk === 'SELESAI' || progress >= 0.999999) return 'SELESAI'; const daysRemaining = differenceInDays(today, row.tgl_target_selesai); if (daysRemaining < 0) return 'LEWAT TARGET'; const daysSinceUpdate = latest ? differenceInDays(latest.date, today) : null; if (daysRemaining <= 7 || daysSinceUpdate === null || daysSinceUpdate > 14 || getPaceStatus(row, today) === 'TERTINGGAL') return 'PERHATIAN'; return 'BERJALAN'; }
function Kpi({ label, value, helper, warning = false }: { label: string; value: string; helper: string; warning?: boolean }) { return <div style={{ background: '#fff', border: `1px solid ${warning ? '#fed7aa' : '#e2e8f0'}`, borderRadius: 16, padding: 20, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' }}><div style={{ color: '#64748b', fontSize: 13 }}>{label}</div><div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{value}</div><div style={{ marginTop: 5, color: warning ? '#b45309' : '#94a3b8', fontSize: 12 }}>{helper}</div></div>; }
function StatusCount({ label, value }: { label: OperationalStatus; value: number }) { return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '8px 12px', display: 'inline-flex', gap: 8, alignItems: 'center' }}><StatusBadge status={label} /><strong>{value}</strong></div>; }
function StatusBadge({ status }: { status: OperationalStatus }) { const style = statusStyles[status]; return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, background: style.background, color: style.color, border: `1px solid ${style.border}` }}>{status}</span>; }
function PaceBadge({ status }: { status: PaceStatus }) { const style = paceStyles[status]; return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: style.background, color: style.color, border: `1px solid ${style.border}` }}>{status}</span>; }
const statusStyles: Record<OperationalStatus, { background: string; color: string; border: string }> = { BERJALAN: { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, PERHATIAN: { background: '#fffbeb', color: '#b45309', border: '#fde68a' }, 'LEWAT TARGET': { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' }, SELESAI: { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' } };
const paceStyles: Record<PaceStatus, { background: string; color: string; border: string }> = { 'DI DEPAN': { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }, 'SESUAI RITME': { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, TERTINGGAL: { background: '#fff7ed', color: '#c2410c', border: '#fed7aa' } };
const header = { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const brand = { fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: '#2563eb' };
const title = { fontSize: 22, fontWeight: 800 };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#2563eb' };
const logout = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 18px rgba(15,23,42,0.04)' };
const sectionTitle = { fontWeight: 800, fontSize: 15 };
const primaryLink = { background: '#2563eb', color: '#fff', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
const progressLink = { background: '#0f172a', color: '#fff', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
const secondaryLink = { background: '#fff', color: '#2563eb', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
const actionChip = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '9px 11px', textDecoration: 'none', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 9 };
const th = { padding: '13px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, whiteSpace: 'nowrap' };
const td = { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' as const };
const tdWide = { ...td, minWidth: 240 };
const kavlingLink = { color: '#0f172a', fontWeight: 800, textDecoration: 'none' };
const progressTrack = { height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' };
const progressFill = { height: '100%', borderRadius: 999, background: '#2563eb', transition: 'width 0.2s ease' };
const alertError = { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14, borderRadius: 12, marginBottom: 20 };
