import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';

type Params = Promise<{ id: string }>;
type Spk = { id_spk: string; id_kavling: string; id_tipe: string; id_kantor: string; id_mandor: string; tgl_spk: string; tgl_target_selesai: string; status_spk: string; is_active: boolean };
type Current = { id_kategori: string; progress_akumulasi: number | string; bobot_final: number | string; progress_berbobot: number | string; tanggal_update_terakhir: string | null };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };
type History = { id_progress: string; tanggal_update: string; id_kategori: string; progress_periode: number | string; keterangan: string | null };
type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';

export default async function SpkDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: spkData } = await supabase.from('spk').select('id_spk, id_kavling, id_tipe, id_kantor, id_mandor, tgl_spk, tgl_target_selesai, status_spk, is_active').eq('id_spk', id).maybeSingle();
  if (!spkData) notFound();
  const spk = spkData as Spk;

  const [{ data: currentData }, { data: categories }, { data: history }, { data: office }, { data: mandor }] = await Promise.all([
    supabase.from('v_progress_kategori_current').select('id_kategori, progress_akumulasi, bobot_final, progress_berbobot, tanggal_update_terakhir').eq('id_spk', id).order('id_kategori'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('progress_update').select('id_progress, tanggal_update, id_kategori, progress_periode, keterangan').eq('id_spk', id).order('tanggal_update', { ascending: false }).order('id_kategori').limit(30),
    supabase.from('master_kantor_pelaksana').select('nama_kantor_pelaksana').eq('id_kantor', spk.id_kantor).maybeSingle(),
    supabase.from('master_mandor').select('nama_mandor').eq('id_mandor', spk.id_mandor).maybeSingle(),
  ]);

  const currentRows = (currentData ?? []) as Current[];
  const categoryRows = (categories ?? []) as Category[];
  const historyRows = (history ?? []) as History[];
  const categoryMap = new Map(categoryRows.map((row) => [row.id_kategori, row]));
  const progressTotal = currentRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0);
  const latestDate = historyRows[0]?.tanggal_update ?? null;
  const latestPeriod = getLatestPeriod(historyRows);
  const today = new Date().toISOString().slice(0, 10);
  const daysRemaining = differenceInDays(today, spk.tgl_target_selesai);
  const expectedProgress = getExpectedProgress(spk, today);
  const gap = progressTotal - expectedProgress;
  const paceStatus = getPaceStatus(gap);
  const status = getOperationalStatus(spk, progressTotal, latestDate, daysRemaining, paceStatus);
  const remainingProgress = Math.max(0, 1 - progressTotal);
  const schedulePct = Math.min(100, expectedProgress * 100);
  const actualPct = Math.min(100, Math.max(0, progressTotal * 100));
  const maxAllowedPeriod = remainingProgress * 100;

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}><div><Link href="/dashboard" style={back}>← Dashboard</Link><div style={brand}>KAVIO</div><div style={title}>Detail SPK</div></div><div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}><div>{user.email}</div><form action="/auth/signout" method="post" style={{ marginTop: 6 }}><button type="submit" style={logout}>Keluar</button></form></div></header>
      <section style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div><div style={eyebrow}>SPK CONTROL SHEET</div><h1 style={{ margin: '4px 0 6px', fontSize: 30 }}>{spk.id_kavling}</h1><p style={{ margin: 0, color: '#64748b' }}>SPK {spk.id_spk.slice(0, 8)} · Tipe {spk.id_tipe}</p></div>
          <div style={{ display: 'flex', gap: 10 }}><Link href={`/progress?spk=${spk.id_spk}`} style={primaryLink}>Input Progress</Link><Link href="/master/spk" style={secondaryLink}>Kembali ke SPK</Link></div>
        </div>

        <section style={gridFour}>
          <Metric label="Progress Akumulasi" value={`${actualPct.toFixed(1)}%`} />
          <Metric label="Progress Periode Terakhir" value={latestPeriod} />
          <Metric label="Target Selesai" value={spk.tgl_target_selesai} />
          <Metric label="Sisa Hari" value={daysRemaining < 0 ? `Lewat ${Math.abs(daysRemaining)} hari` : `${daysRemaining} hari`} />
        </section>

        <section style={{ ...card, marginTop: 16, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><div style={mutedLabel}>STATUS OPERASIONAL</div><div style={{ marginTop: 8 }}><StatusBadge status={status} /></div></div>
            <Info label="Progress Seharusnya" value={`${schedulePct.toFixed(1)}%`} />
            <Info label="Gap terhadap Jadwal" value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}%`} tone={gap < -0.05 ? 'danger' : gap < 0 ? 'warning' : 'success'} />
            <Info label="Posisi Ritme" value="" extra={<PaceBadge status={paceStatus} />} />
            <Info label="Tanggal SPK" value={spk.tgl_spk} />
            <Info label="Kantor/Pelaksana" value={office?.nama_kantor_pelaksana ?? spk.id_kantor} />
            <Info label="Mandor" value={mandor?.nama_mandor ?? spk.id_mandor} />
            <Info label="Status SPK" value={spk.status_spk} />
          </div>
        </section>

        <section style={{ ...card, marginTop: 16, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: 12 }}>
            <div><div style={sectionTitleNoPad}>Aktual vs Jadwal</div><div style={mutedText}>Garis biru menunjukkan progress aktual. Garis abu-abu menunjukkan posisi waktu yang seharusnya.</div></div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{today}</div>
          </div>
          <div style={barTrack}><div style={{ ...expectedMarker, left: `${schedulePct}%` }} /><div style={{ ...actualBar, width: `${actualPct}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 12 }}><span><strong>Aktual {actualPct.toFixed(1)}%</strong></span><span style={{ color: '#64748b' }}>Seharusnya {schedulePct.toFixed(1)}%</span><span style={{ color: gap < 0 ? '#b45309' : '#15803d', fontWeight: 800 }}>{gap >= 0 ? 'Di depan jadwal' : 'Tertinggal dari jadwal'}</span></div>
        </section>

        <section style={{ ...card, marginTop: 16, overflow: 'hidden' }}><div style={sectionTitle}>Progress per Kategori</div><div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={th}>Kategori</th><th style={th}>Bobot</th><th style={th}>Akumulasi</th><th style={th}>Berbobot</th><th style={th}>Update Terakhir</th></tr></thead><tbody>{currentRows.map((row) => <tr key={row.id_kategori}><td style={tdStrong}>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td style={td}>{(Number(row.bobot_final) * 100).toFixed(2)}%</td><td style={td}>{(Number(row.progress_akumulasi) * 100).toFixed(2)}%</td><td style={td}>{(Number(row.progress_berbobot) * 100).toFixed(2)}%</td><td style={td}>{row.tanggal_update_terakhir ?? 'Belum ada'}</td></tr>)}{!currentRows.length && <tr><td colSpan={5} style={empty}>Belum ada progress kategori.</td></tr>}</tbody></table></div></section>
        <section style={{ ...card, marginTop: 16, overflow: 'hidden' }}><div style={sectionTitle}>Histori Progress Terbaru</div><div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={th}>Tanggal</th><th style={th}>Kategori</th><th style={th}>Periode</th><th style={th}>Keterangan</th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id_progress}><td style={td}>{row.tanggal_update}</td><td style={td}>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td style={tdStrong}>{(Number(row.progress_periode) * 100).toFixed(2)}%</td><td style={td}>{row.keterangan || '—'}</td></tr>)}{!historyRows.length && <tr><td colSpan={4} style={empty}>Belum ada histori progress.</td></tr>}</tbody></table></div></section>
      </section>
    </main>
  );
}

function getLatestPeriod(rows: History[]) { if (!rows.length) return '—'; const date = rows[0].tanggal_update; const total = rows.filter((row) => row.tanggal_update === date).reduce((sum, row) => sum + Number(row.progress_periode ?? 0), 0); return `${(total * 100).toFixed(2)}%`; }
function differenceInDays(fromDate: string, toDate: string) { return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000); }
function getExpectedProgress(spk: Spk, today: string) { const totalDays = differenceInDays(spk.tgl_spk, spk.tgl_target_selesai); if (totalDays <= 0) return today >= spk.tgl_target_selesai ? 1 : 0; return clamp(differenceInDays(spk.tgl_spk, today) / totalDays); }
function getPaceStatus(gap: number): PaceStatus { if (gap <= -0.05) return 'TERTINGGAL'; if (gap >= 0.05) return 'DI DEPAN'; return 'SESUAI RITME'; }
function getOperationalStatus(spk: Spk, progress: number, latestDate: string | null, daysRemaining: number, paceStatus: PaceStatus): OperationalStatus { if (spk.status_spk === 'SELESAI' || progress >= 0.999999) return 'SELESAI'; if (daysRemaining < 0) return 'LEWAT TARGET'; if (!latestDate || differenceInDays(latestDate, new Date().toISOString().slice(0, 10)) > 14 || daysRemaining <= 7 || paceStatus === 'TERTINGGAL') return 'PERHATIAN'; return 'BERJALAN'; }
function clamp(value: number) { return Math.min(1, Math.max(0, value)); }
function Metric({ label, value }: { label: string; value: string }) { return <div style={{ ...card, padding: 18 }}><div style={mutedLabel}>{label}</div><div style={{ marginTop: 8, fontWeight: 800, fontSize: 24 }}>{value}</div></div>; }
function Info({ label, value, tone = 'default', extra }: { label: string; value: string; tone?: 'default' | 'danger' | 'warning' | 'success'; extra?: React.ReactNode }) { const color = tone === 'danger' ? '#b91c1c' : tone === 'warning' ? '#b45309' : tone === 'success' ? '#15803d' : '#0f172a'; return <div><div style={mutedLabel}>{label}</div><div style={{ marginTop: 6, fontWeight: 700, color }}>{extra ?? value}</div></div>; }
function StatusBadge({ status }: { status: OperationalStatus }) { const s = statusStyles[status]; return <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>; }
function PaceBadge({ status }: { status: PaceStatus }) { const s = paceStyles[status]; return <span style={{ display: 'inline-flex', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>; }
const statusStyles: Record<OperationalStatus, { background: string; color: string; border: string }> = { BERJALAN: { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, PERHATIAN: { background: '#fffbeb', color: '#b45309', border: '#fde68a' }, 'LEWAT TARGET': { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' }, SELESAI: { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' } };
const paceStyles: Record<PaceStatus, { background: string; color: string; border: string }> = { 'DI DEPAN': { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }, 'SESUAI RITME': { background: '#f8fafc', color: '#475569', border: '#cbd5e1' }, TERTINGGAL: { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' } };
const header = { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#64748b', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#2563eb' };
const title = { fontSize: 21, fontWeight: 800 };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#2563eb' };
const logout = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' };
const gridFour = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 };
const sectionTitle = { padding: 18, borderBottom: '1px solid #e2e8f0', fontWeight: 800 };
const sectionTitleNoPad = { fontWeight: 800, fontSize: 16 };
const mutedLabel = { color: '#64748b', fontSize: 12, fontWeight: 700 };
const mutedText = { color: '#64748b', fontSize: 12, marginTop: 4 };
const table = { width: '100%', borderCollapse: 'collapse' as const };
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' as const, whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const empty = { padding: 32, textAlign: 'center' as const, color: '#64748b' };
const primaryLink = { background: '#2563eb', color: '#fff', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
const secondaryLink = { background: '#fff', color: '#2563eb', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 };
const barTrack = { height: 18, borderRadius: 999, background: '#e2e8f0', position: 'relative' as const, overflow: 'hidden' };
const actualBar = { height: '100%', borderRadius: 999, background: '#2563eb', position: 'absolute' as const, left: 0, top: 0 };
const expectedMarker = { position: 'absolute' as const, top: 0, width: 3, height: '100%', background: '#0f172a', zIndex: 2, transform: 'translateX(-1px)' };
