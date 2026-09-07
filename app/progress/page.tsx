import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { createProgressUpdate } from './actions';

type SearchParams = Promise<{ spk?: string; error?: string; success?: string }>;
type Spk = { id_spk: string; id_kavling: string; id_tipe: string; tgl_spk: string; tgl_target_selesai: string; status_spk: string; is_active: boolean };
type Config = { id_kategori: string; bobot_final: number | string };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };
type Current = { id_kategori: string; progress_akumulasi: number | string; bobot_final: number | string; progress_berbobot: number | string; tanggal_update_terakhir: string | null };
type History = { id_progress: string; tanggal_update: string; id_kategori: string; progress_periode: number | string; keterangan: string | null };
type Decision = { progress_aktual: number | string; progress_seharusnya: number | string; gap_progress: number | string; sisa_hari: number; tanggal_update_terakhir: string | null; progress_periode_terakhir: number | string; status_operasional: string; status_ritme: string; prioritas_tindakan: string; action_rekomendasi: string; hari_sejak_update: number; progress_diperlukan_per_hari: number | string; health_score: number; health_level: string; health_description: string };

export default async function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: spks }, { data: categories }] = await Promise.all([
    supabase.from('spk').select('id_spk,id_kavling,id_tipe,tgl_spk,tgl_target_selesai,status_spk,is_active').eq('is_active', true).order('tgl_target_selesai'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori,nama_kategori,urutan').eq('status_aktif', true).order('urutan'),
  ]);

  const spkRows = (spks ?? []) as Spk[];
  const categoryRows = (categories ?? []) as Category[];
  const selected = spkRows.find((row) => row.id_spk === params.spk) ?? spkRows[0] ?? null;

  let configRows: Config[] = [];
  let currentRows: Current[] = [];
  let historyRows: History[] = [];
  let decision: Decision | null = null;
  let readError = '';

  if (selected) {
    const results = await Promise.all([
      supabase.from('spk_progress_config').select('id_kategori,bobot_final').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('v_progress_kategori_current').select('id_kategori,progress_akumulasi,bobot_final,progress_berbobot,tanggal_update_terakhir').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('progress_update').select('id_progress,tanggal_update,id_kategori,progress_periode,keterangan').eq('id_spk', selected.id_spk).order('tanggal_update', { ascending: false }).order('id_kategori'),
      supabase.from('v_decision_engine').select('progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,health_description').eq('id_spk', selected.id_spk).maybeSingle(),
    ]);
    configRows = (results[0].data ?? []) as Config[];
    currentRows = (results[1].data ?? []) as Current[];
    historyRows = (results[2].data ?? []) as History[];
    decision = results[3].data as Decision | null;
    readError = results.map((r) => r.error?.message).find(Boolean) ?? '';
  }

  const categoryMap = new Map(categoryRows.map((row) => [row.id_kategori, row]));
  const latestPeriod = getLatestPeriod(historyRows);
  const actual = Number(decision?.progress_aktual ?? currentRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0));
  const expected = Number(decision?.progress_seharusnya ?? 0);
  const gap = Number(decision?.gap_progress ?? actual - expected);
  const pageError = params.error ?? readError;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div><Link href="/dashboard" style={styles.back}>← Dashboard</Link><div style={styles.brand}>KAVIO</div><div style={styles.title}>Input Progress SPK</div></div>
        <div style={styles.user}><div>{user.email}</div><form action="/auth/signout" method="post"><button style={styles.logout}>Keluar</button></form></div>
      </header>
      <section style={styles.wrap}>
        <div style={{ marginBottom: 18 }}><div style={styles.eyebrow}>FIELD MONITORING</div><h1 style={styles.h1}>Progress Pembangunan</h1><p style={styles.muted}>Input adalah progress periode. Dashboard, Detail SPK, dan Decision Engine menggunakan sumber keputusan yang sama.</p></div>
        {pageError && <div style={styles.error}>{pageError}</div>}
        {params.success && <div style={styles.success}>{params.success}</div>}

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Pilih SPK Aktif</div>
          <form method="get" style={styles.selector}>
            <select name="spk" defaultValue={selected?.id_spk ?? ''} style={styles.input}><option value="">Pilih SPK</option>{spkRows.map((row) => <option key={row.id_spk} value={row.id_spk}>{row.id_kavling} — target {row.tgl_target_selesai}</option>)}</select>
            <button type="submit" style={styles.primary}>Tampilkan</button>
          </form>
        </section>

        {selected && <>
          <section style={{ ...styles.card, marginTop: 16 }}>
            <div style={styles.sectionTitle}>Ringkasan Kendali</div>
            <div style={styles.kpis}>
              <Kpi label="Progress Aktual" value={`${(actual * 100).toFixed(1)}%`} />
              <Kpi label="Progress Seharusnya" value={`${(expected * 100).toFixed(1)}%`} />
              <Kpi label="Gap" value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}%`} tone={gap < -0.05 ? 'danger' : gap < 0 ? 'warning' : 'ok'} />
              <Kpi label="Sisa Hari" value={decision ? (decision.sisa_hari < 0 ? `Lewat ${Math.abs(decision.sisa_hari)}` : String(decision.sisa_hari)) : '—'} tone={decision && decision.sisa_hari < 0 ? 'danger' : undefined} />
              <Kpi label="Health Score" value={decision ? String(decision.health_score) : '—'} />
            </div>
            <div style={styles.decisionBox}><div style={styles.smallLabel}>DECISION ENGINE</div><div style={styles.decisionMain}>{decision?.action_rekomendasi ?? 'Belum tersedia'}</div><div style={styles.decisionMeta}>{decision?.status_operasional ?? '—'} · {decision?.status_ritme ?? '—'} · prioritas {decision?.prioritas_tindakan ?? '—'} · {decision?.health_level ?? '—'}</div></div>
          </section>

          <section style={{ ...styles.card, marginTop: 16 }}>
            <div style={styles.sectionTitle}>Input Progress Periode</div>
            <form action={createProgressUpdate} style={styles.form}>
              <input type="hidden" name="id_spk" value={selected.id_spk} />
              <label style={styles.label}>Tanggal Update<input type="date" name="tanggal_update" required defaultValue={today} style={styles.input} min={selected.tgl_spk} /></label>
              <label style={styles.label}>Kategori Pekerjaan<select name="id_kategori" required defaultValue="" style={styles.input}><option value="" disabled>Pilih kategori</option>{configRows.map((c) => <option key={c.id_kategori} value={c.id_kategori}>{categoryMap.get(c.id_kategori)?.urutan ?? ''}. {categoryMap.get(c.id_kategori)?.nama_kategori ?? c.id_kategori} — bobot {(Number(c.bobot_final) * 100).toFixed(2)}%</option>)}</select></label>
              <label style={styles.label}>Progress Periode (%)<input type="number" name="progress_periode" required min="0" max="100" step="0.01" placeholder="Contoh: 8" style={styles.input} /></label>
              <label style={styles.label}>Keterangan<input name="keterangan" placeholder="Opsional" style={styles.input} /></label>
              <div style={styles.note}><strong>Penting:</strong> isi angka periode ini, bukan kumulatif. Akumulasi kategori dihitung otomatis dan dibatasi 100%.</div>
              <button type="submit" disabled={!configRows.length} style={styles.primary}>+ Simpan Progress Periode</button>
            </form>
          </section>

          <section style={{ ...styles.card, marginTop: 16, overflow: 'hidden' }}>
            <div style={styles.sectionTitle}>Progress per Kategori</div>
            <div style={{ overflowX: 'auto' }}><table style={styles.table}><thead><tr><Th>Kategori</Th><Th>Bobot</Th><Th>Akumulasi</Th><Th>Berbobot</Th><Th>Update Terakhir</Th></tr></thead><tbody>{configRows.map((c) => { const cur = currentRows.find((r) => r.id_kategori === c.id_kategori); return <tr key={c.id_kategori}><Td strong>{categoryMap.get(c.id_kategori)?.nama_kategori ?? c.id_kategori}</Td><Td>{(Number(c.bobot_final) * 100).toFixed(2)}%</Td><Td>{(Number(cur?.progress_akumulasi ?? 0) * 100).toFixed(2)}%</Td><Td>{(Number(cur?.progress_berbobot ?? 0) * 100).toFixed(2)}%</Td><Td>{cur?.tanggal_update_terakhir ?? 'Belum ada'}</Td></tr>; })}</tbody></table></div>
          </section>

          <section style={{ ...styles.card, marginTop: 16, overflow: 'hidden' }}>
            <div style={styles.sectionTitle}>Histori Progress</div>
            <div style={{ overflowX: 'auto' }}><table style={styles.table}><thead><tr><Th>Tanggal</Th><Th>Kategori</Th><Th>Periode</Th><Th>Keterangan</Th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id_progress}><Td>{row.tanggal_update}</Td><Td>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</Td><Td strong>{(Number(row.progress_periode) * 100).toFixed(2)}%</Td><Td>{row.keterangan || '—'}</Td></tr>)}{!historyRows.length && <tr><Td>Belum ada histori progress.</Td><Td></Td><Td></Td><Td></Td></tr>}</tbody></table></div>
            <div style={styles.historyMeta}>Update terakhir: {decision?.tanggal_update_terakhir ?? latestPeriod?.date ?? 'Belum ada'} · Periode terakhir: {decision ? `${(Number(decision.progress_periode_terakhir) * 100).toFixed(2)}%` : '—'} · Kebutuhan per hari: {decision ? `${(Number(decision.progress_diperlukan_per_hari) * 100).toFixed(2)}%` : '—'}</div>
          </section>
        </>}

        {!selected && !spkRows.length && <div style={{ ...styles.card, marginTop: 16, padding: 28, textAlign: 'center' }}>Belum ada SPK aktif.</div>}
      </section>
    </main>
  );
}

function getLatestPeriod(rows: History[]) { if (!rows.length) return null; const date = rows[0].tanggal_update; const progress = rows.filter((row) => row.tanggal_update === date).reduce((sum, row) => sum + Number(row.progress_periode ?? 0), 0); return { date, progress }; }
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warning' | 'ok' }) { const color = tone === 'danger' ? '#fecaca' : tone === 'warning' ? '#E8CC7A' : tone === 'ok' ? '#86efac' : '#F7F3E8'; return <div style={styles.kpi}><div style={styles.smallLabel}>{label}</div><div style={{ marginTop: 6, fontSize: 23, fontWeight: 900, color }}>{value}</div></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th style={styles.th}>{children}</th>; }
function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <td style={{ ...styles.td, ...(strong ? { fontWeight: 800 } : {}) }}>{children}</td>; }

const styles = {
  main: { minHeight: '100vh', background: '#0B1D3A', color: '#F7F3E8' },
  header: { background: '#102A56', borderBottom: '1px solid #B8943F', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 },
  back: { color: '#DCCB9C', textDecoration: 'none', fontSize: 13 },
  brand: { marginTop: 8, color: '#E8CC7A', fontWeight: 900, letterSpacing: 1.5, fontSize: 12 },
  title: { color: '#F7F3E8', fontSize: 21, fontWeight: 800 },
  user: { textAlign: 'right' as const, color: '#DCCB9C', fontSize: 12 },
  logout: { border: 0, background: 'transparent', color: '#E8CC7A', fontWeight: 800, cursor: 'pointer', marginTop: 6 },
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 28 },
  eyebrow: { color: '#E8CC7A', fontSize: 11, fontWeight: 900, letterSpacing: 1.2 },
  h1: { margin: '4px 0 6px', fontSize: 30, color: '#F7F3E8' },
  muted: { margin: 0, color: '#DCCB9C', fontSize: 13 },
  card: { background: '#162F5B', border: '1px solid #B8943F', borderRadius: 16, boxShadow: '0 10px 28px rgba(0,0,0,.18)' },
  sectionTitle: { padding: 16, borderBottom: '1px solid rgba(216,180,90,.25)', fontWeight: 900, color: '#F7F3E8' },
  selector: { padding: 16, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 },
  input: { width: '100%', boxSizing: 'border-box' as const, padding: '11px 12px', borderRadius: 10, border: '1px solid #B8943F', background: '#0B1D3A', color: '#F7F3E8', outline: 'none' },
  primary: { background: 'linear-gradient(180deg,#E8CC7A,#D8B45A)', color: '#0B1D3A', border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 900, cursor: 'pointer' },
  kpis: { padding: 16, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 },
  kpi: { background: '#102A56', border: '1px solid rgba(216,180,90,.25)', borderRadius: 12, padding: 14 },
  smallLabel: { color: '#DCCB9C', fontSize: 11, fontWeight: 800, letterSpacing: .5 },
  decisionBox: { margin: '0 16px 16px', padding: 14, background: '#0B1D3A', border: '1px solid #B8943F', borderRadius: 12 },
  decisionMain: { marginTop: 5, fontWeight: 900, color: '#E8CC7A' },
  decisionMeta: { marginTop: 6, color: '#DCCB9C', fontSize: 12 },
  form: { padding: 16, display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: 12, alignItems: 'end' },
  label: { display: 'grid', gap: 6, color: '#DCCB9C', fontSize: 12, fontWeight: 800 },
  note: { gridColumn: '1 / -1', padding: 11, background: '#102A56', border: '1px solid rgba(216,180,90,.25)', borderRadius: 10, color: '#DCCB9C', fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '12px 14px', textAlign: 'left' as const, color: '#E8CC7A', borderBottom: '1px solid rgba(216,180,90,.25)', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', color: '#F7F3E8', borderBottom: '1px solid rgba(216,180,90,.12)' },
  historyMeta: { padding: 14, color: '#DCCB9C', fontSize: 12 },
  error: { marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(248,113,113,.10)', border: '1px solid #b91c1c', color: '#fecaca' },
  success: { marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(134,239,172,.08)', border: '1px solid #15803d', color: '#bbf7d0' },
};
