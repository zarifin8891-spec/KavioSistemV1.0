import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { createProgressUpdate } from './actions';

type SearchParams = Promise<{ spk?: string; error?: string; success?: string }>;

type Spk = {
  id_spk: string;
  id_kavling: string;
  id_tipe: string;
  id_kantor: string;
  id_mandor: string;
  tgl_spk: string;
  tgl_target_selesai: string;
  status_spk: string;
  is_active: boolean;
};

type Config = {
  id_kategori: string;
  bobot_final: number | string;
};

type Kategori = {
  id_kategori: string;
  nama_kategori: string;
  urutan: number;
};

type Current = {
  id_spk: string;
  id_kategori: string;
  tanggal_update_terakhir: string;
  progress_akumulasi: number | string;
  bobot_final: number | string;
  progress_berbobot: number | string;
};

type History = {
  id_progress: string;
  tanggal_update: string;
  id_kategori: string;
  progress_periode: number | string;
  keterangan: string | null;
};

export default async function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedSpkId = params.spk ?? '';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: spkData, error: spkError }, { data: kategoriData, error: kategoriError }] = await Promise.all([
    supabase
      .from('spk')
      .select('id_spk, id_kavling, id_tipe, id_kantor, id_mandor, tgl_spk, tgl_target_selesai, status_spk, is_active')
      .eq('is_active', true)
      .order('tgl_target_selesai'),
    supabase
      .from('master_kategori_pekerjaan')
      .select('id_kategori, nama_kategori, urutan')
      .eq('status_aktif', true)
      .order('urutan'),
  ]);

  const spkRows = (spkData ?? []) as Spk[];
  const kategoriRows = (kategoriData ?? []) as Kategori[];
  const selected = spkRows.find((row) => row.id_spk === selectedSpkId) ?? spkRows[0] ?? null;

  let configRows: Config[] = [];
  let currentRows: Current[] = [];
  let historyRows: History[] = [];
  let selectedError = '';

  if (selected) {
    const [{ data: configData, error: configError }, { data: currentData, error: currentError }, { data: historyData, error: historyError }] = await Promise.all([
      supabase.from('spk_progress_config').select('id_kategori, bobot_final').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('v_progress_kategori_current').select('id_spk, id_kategori, tanggal_update_terakhir, progress_akumulasi, bobot_final, progress_berbobot').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('progress_update').select('id_progress, tanggal_update, id_kategori, progress_periode, keterangan').eq('id_spk', selected.id_spk).order('tanggal_update', { ascending: false }).order('id_kategori'),
    ]);
    configRows = (configData ?? []) as Config[];
    currentRows = (currentData ?? []) as Current[];
    historyRows = (historyData ?? []) as History[];
    selectedError = configError?.message ?? currentError?.message ?? historyError?.message ?? '';
  }

  const kategoriMap = new Map(kategoriRows.map((row) => [row.id_kategori, row]));
  const currentMap = new Map(currentRows.map((row) => [row.id_kategori, row]));
  const progressTotal = currentRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0);
  const pageError = params.error ?? spkError?.message ?? kategoriError?.message ?? selectedError;

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>Input Progress SPK</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 6 }}>
            <button type="submit" style={logout}>Keluar</button>
          </form>
        </div>
      </header>

      <section style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Progress Pembangunan</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Input progress per periode. Sistem menghitung akumulasi dan progress berbobot secara otomatis.</p>
        </div>

        {pageError && <div style={alertError}>{pageError}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}>
          <div style={sectionTitle}>Pilih SPK Aktif</div>
          <form method="get" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <label style={labelStyle}>
              <span>SPK</span>
              <select name="spk" style={inputStyle} defaultValue={selected?.id_spk ?? ''}>
                <option value="">Pilih SPK</option>
                {spkRows.map((row) => <option key={row.id_spk} value={row.id_spk}>{row.id_kavling} — SPK {row.id_spk.slice(0, 8)} — target {row.tgl_target_selesai}</option>)}
              </select>
            </label>
            <button type="submit" style={primaryButton}>Tampilkan</button>
          </form>
        </section>

        {selected && (
          <>
            <section style={{ ...card, marginTop: 20 }}>
              <div style={sectionTitle}>Ringkasan SPK</div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14 }}>
                <Metric label="Kavling" value={selected.id_kavling} />
                <Metric label="Tanggal SPK" value={selected.tgl_spk} />
                <Metric label="Target Selesai" value={selected.tgl_target_selesai} />
                <Metric label="Status" value={selected.status_spk} />
                <Metric label="Progress Total" value={`${(progressTotal * 100).toFixed(1)}%`} />
              </div>
            </section>

            <section style={{ ...card, marginTop: 20 }}>
              <div style={sectionTitle}>Input Progress Periode</div>
              <form action={createProgressUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: 14, padding: 18 }}>
                <input type="hidden" name="id_spk" value={selected.id_spk} />
                <label style={labelStyle}>
                  <span>Tanggal Update</span>
                  <input name="tanggal_update" type="date" required style={inputStyle} defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
                <label style={labelStyle}>
                  <span>Kategori Pekerjaan</span>
                  <select name="id_kategori" required style={inputStyle} defaultValue="">
                    <option value="" disabled>Pilih kategori</option>
                    {configRows.map((config) => {
                      const kategori = kategoriMap.get(config.id_kategori);
                      const current = currentMap.get(config.id_kategori);
                      const akumulasi = Number(current?.progress_akumulasi ?? 0) * 100;
                      const bobot = Number(config.bobot_final ?? 0) * 100;
                      return <option key={config.id_kategori} value={config.id_kategori}>{kategori?.urutan ?? ''}. {kategori?.nama_kategori ?? config.id_kategori} — akumulasi {akumulasi.toFixed(1)}% — bobot {bobot.toFixed(2)}%</option>;
                    })}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Progress Periode (%)</span>
                  <input name="progress_periode" type="number" min="0" max="100" step="0.01" required placeholder="Contoh: 8" style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Keterangan</span>
                  <input name="keterangan" placeholder="Opsional" style={inputStyle} />
                </label>
                <div style={{ gridColumn: '1 / -1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 11, color: '#1e40af', fontSize: 13 }}>
                  <strong>Catatan:</strong> angka yang diinput adalah progress <strong>periode ini</strong>, bukan progress kumulatif. Sistem akan menjumlahkan histori dan menolak jika akumulasi kategori melewati 100%.
                </div>
                <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                  <button type="submit" style={primaryButton} disabled={!configRows.length}>+ Simpan Progress Periode</button>
                </div>
              </form>
            </section>

            <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
              <div style={sectionTitle}>Progress per Kategori</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={table}>
                  <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={th}>Kategori</th><th style={th}>Bobot</th><th style={th}>Akumulasi</th><th style={th}>Progress Berbobot</th><th style={th}>Update Terakhir</th></tr></thead>
                  <tbody>
                    {configRows.map((config) => {
                      const kategori = kategoriMap.get(config.id_kategori);
                      const current = currentMap.get(config.id_kategori);
                      return <tr key={config.id_kategori}>
                        <td style={tdStrong}>{kategori?.nama_kategori ?? config.id_kategori}</td>
                        <td style={td}>{(Number(config.bobot_final) * 100).toFixed(2)}%</td>
                        <td style={td}>{(Number(current?.progress_akumulasi ?? 0) * 100).toFixed(2)}%</td>
                        <td style={td}>{(Number(current?.progress_berbobot ?? 0) * 100).toFixed(2)}%</td>
                        <td style={td}>{current?.tanggal_update_terakhir ?? 'Belum ada'}</td>
                      </tr>;
                    })}
                    {!configRows.length && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: 30 }}>Belum ada konfigurasi progress untuk SPK ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
              <div style={sectionTitle}>Histori Input Progress</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={table}>
                  <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={th}>Tanggal</th><th style={th}>Kategori</th><th style={th}>Progress Periode</th><th style={th}>Keterangan</th></tr></thead>
                  <tbody>
                    {historyRows.map((row) => <tr key={row.id_progress}><td style={td}>{row.tanggal_update}</td><td style={td}>{kategoriMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td style={td}>{(Number(row.progress_periode) * 100).toFixed(2)}%</td><td style={td}>{row.keterangan || '—'}</td></tr>)}
                    {!historyRows.length && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', padding: 30, color: '#64748b' }}>Belum ada histori progress.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!selected && !spkRows.length && <div style={{ ...card, marginTop: 20, padding: 30, textAlign: 'center', color: '#64748b' }}>Belum ada SPK aktif yang dapat menerima progress.</div>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 15 }}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><div style={{ marginTop: 7, fontSize: 20, fontWeight: 800 }}>{value}</div></div>;
}

const header = { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#64748b', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#2563eb' };
const title = { fontSize: 21, fontWeight: 800 };
const logout = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' };
const sectionTitle = { padding: '16px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 };
const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 12, fontWeight: 700, color: '#475569' };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#fff', color: '#0f172a' };
const primaryButton = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' };
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const table = { width: '100%', borderCollapse: 'collapse' as const };
const alertError = { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 };
const alertSuccess = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 12, borderRadius: 10, marginBottom: 14 };
