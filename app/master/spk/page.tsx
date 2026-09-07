import Link from 'next/link';
import { redirect } from 'next/navigation';
import { activateSpk, createSpk, deactivateSpk } from './actions';
import WeightConfigurator from './WeightConfigurator';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string }>;

type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string; status_kavling: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };
type Spk = {
  id_spk: string;
  id_kavling: string;
  tgl_spk: string;
  id_tipe: string;
  jenis_bobot: string;
  id_kantor: string;
  id_mandor: string;
  status_spk: string;
  tgl_target_selesai: string;
  is_active: boolean;
};

export default async function MasterSpkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [kavlingRes, tipeRes, kantorRes, mandorRes, kategoriRes, templateRes, spkRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe, status_kavling').eq('status_aktif', true).order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('master_kantor_pelaksana').select('id_kantor, nama_kantor_pelaksana').eq('status_aktif', true).order('nama_kantor_pelaksana'),
    supabase.from('master_mandor').select('id_mandor, nama_mandor, id_kantor').eq('status_aktif', true).order('nama_mandor'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('template_progress_tipe').select('id_tipe, id_kategori, bobot_standar').order('id_tipe').order('id_kategori'),
    supabase.from('spk').select('id_spk, id_kavling, tgl_spk, id_tipe, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active').order('created_at', { ascending: false }),
  ]);

  const allKavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const kavlingRows = allKavlingRows.filter((row) => ['AVAILABLE', 'BOOKING', 'READY_STOCK'].includes(row.status_kavling));
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kantorRows = (kantorRes.data ?? []) as Kantor[];
  const mandorRows = (mandorRes.data ?? []) as Mandor[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const templateRows = (templateRes.data ?? []) as Template[];
  const spkRows = (spkRes.data ?? []) as Spk[];

  const pageError = params.error
    ?? kavlingRes.error?.message
    ?? tipeRes.error?.message
    ?? kantorRes.error?.message
    ?? mandorRes.error?.message
    ?? kategoriRes.error?.message
    ?? templateRes.error?.message
    ?? spkRes.error?.message;

  const tipeMap = new Map(tipeRows.map((item) => [item.id_tipe, item.nama_tipe]));
  const kantorMap = new Map(kantorRows.map((item) => [item.id_kantor, item.nama_kantor_pelaksana]));
  const mandorMap = new Map(mandorRows.map((item) => [item.id_mandor, item.nama_mandor]));

  return (
    <main style={{ minHeight: '100vh', background: '#0B1D3A', color: '#F7F3E8' }}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>SPK Pembangunan</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#DCCB9C' }}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 6 }}>
            <button type="submit" style={logout}>Keluar</button>
          </form>
        </div>
      </header>

      <section style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={eyebrow}>CONSTRUCTION CONTROL</div>
          <h1 style={{ margin: '5px 0 6px', fontSize: 28 }}>Kelola SPK</h1>
          <p style={{ margin: 0, color: '#C9BC99' }}>SPK dapat dibuat tanpa Sales untuk pembangunan rumah ready stock, atau pada kavling yang sudah BOOKING.</p>
        </div>

        {pageError && <div style={alertError}>{pageError}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}>
          <div style={sectionTitle}>Buat SPK Baru</div>
          <form action={createSpk} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, padding: 18 }}>
            <WeightConfigurator kavlingRows={kavlingRows} kategoriRows={kategoriRows} templateRows={templateRows} />
            <Field name="tgl_spk" label="Tanggal SPK" type="date" />
            <Field name="tgl_target_selesai" label="Target Selesai" type="date" />

            <label style={labelStyle}>
              <span>Kantor / Pelaksana</span>
              <select name="id_kantor" required style={inputStyle} defaultValue="">
                <option value="" disabled>Pilih kantor</option>
                {kantorRows.map((item) => <option key={item.id_kantor} value={item.id_kantor}>{item.nama_kantor_pelaksana}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              <span>Mandor</span>
              <select name="id_mandor" required style={inputStyle} defaultValue="">
                <option value="" disabled>Pilih mandor</option>
                {mandorRows.map((item) => <option key={item.id_mandor} value={item.id_mandor}>{item.nama_mandor} — {kantorMap.get(item.id_kantor) ?? item.id_kantor}</option>)}
              </select>
            </label>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: '#C9BC99', fontSize: 12 }}><strong>Aturan:</strong> Sales tidak wajib. Kavling AVAILABLE/BOOKING/READY STOCK dapat dibuatkan SPK selama belum ada SPK aktif; bobot final tetap wajib 100%.</div>
              <button type="submit" style={primaryButton} disabled={!kavlingRows.length || !kantorRows.length || !mandorRows.length || !kategoriRows.length}>+ Simpan SPK sebagai DRAFT</button>
            </div>
          </form>
        </section>

        <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
          <div style={sectionTitle}>Daftar SPK ({spkRows.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: '#102A56', textAlign: 'left' }}>
                <th style={th}>Kavling</th><th style={th}>Tanggal</th><th style={th}>Tipe</th><th style={th}>Kantor</th><th style={th}>Mandor</th><th style={th}>Bobot</th><th style={th}>Target</th><th style={th}>Status</th><th style={th}>Aksi</th>
              </tr></thead>
              <tbody>
                {spkRows.map((row) => (
                  <tr key={row.id_spk}>
                    <td style={tdStrong}>{row.id_kavling}</td>
                    <td style={td}>{row.tgl_spk}</td>
                    <td style={td}>{tipeMap.get(row.id_tipe) ?? row.id_tipe}</td>
                    <td style={td}>{kantorMap.get(row.id_kantor) ?? row.id_kantor}</td>
                    <td style={td}>{mandorMap.get(row.id_mandor) ?? row.id_mandor}</td>
                    <td style={td}>{row.jenis_bobot}</td>
                    <td style={td}>{row.tgl_target_selesai}</td>
                    <td style={td}><span style={row.is_active ? activeBadge : row.status_spk === 'DRAFT' ? draftBadge : inactiveBadge}>{row.status_spk}</span></td>
                    <td style={td}>
                      {row.status_spk === 'DRAFT' && !row.is_active ? (
                        <form action={activateSpk}>
                          <input type="hidden" name="id_spk" value={row.id_spk} />
                          <button type="submit" style={primaryMini}>Aktifkan</button>
                        </form>
                      ) : row.is_active ? (
                        <form action={deactivateSpk}>
                          <input type="hidden" name="id_spk" value={row.id_spk} />
                          <button type="submit" style={outlineButton}>Tandai Selesai</button>
                        </form>
                      ) : <span style={{ color: '#BFAF83' }}>—</span>}
                    </td>
                  </tr>
                ))}
                {!spkRows.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: 34, color: '#DCCB9C' }}>Belum ada data SPK.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({ name, label, type = 'text' }: { name: string; label: string; type?: string }) {
  return <label style={labelStyle}><span>{label}</span><input name={name} type={type} required style={inputStyle} /></label>;
}

const header = { background: '#102A56', borderBottom: '1px solid #B8943F', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#DCCB9C', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 900, letterSpacing: 1.5, color: '#E8CC7A' };
const title = { fontSize: 21, fontWeight: 800, color: '#F7F3E8' };
const logout = { border: 0, background: 'transparent', color: '#E8CC7A', fontWeight: 800, cursor: 'pointer' };
const card = { background: '#162F5B', border: '1px solid rgba(216,180,90,.35)', borderRadius: 16, boxShadow: '0 10px 28px rgba(0,0,0,.16)', overflow: 'hidden' };
const sectionTitle = { padding: '16px 18px', borderBottom: '1px solid rgba(216,180,90,.18)', fontWeight: 900, color: '#F7F3E8' };
const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 12, fontWeight: 800, color: '#DCCB9C' };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #B8943F', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#102A56', color: '#F7F3E8' };
const primaryButton = { background: 'linear-gradient(180deg,#E8CC7A,#D8B45A)', color: '#0B1D3A', border: 0, borderRadius: 9, padding: '11px 16px', fontWeight: 900, cursor: 'pointer' };
const primaryMini = { background: '#E8CC7A', color: '#0B1D3A', border: 0, borderRadius: 8, padding: '7px 10px', fontWeight: 900, cursor: 'pointer' };
const outlineButton = { background: '#102A56', color: '#E8CC7A', border: '1px solid #B8943F', borderRadius: 8, padding: '7px 10px', fontWeight: 800, cursor: 'pointer' };
const th = { padding: '12px 14px', borderBottom: '1px solid rgba(216,180,90,.22)', color: '#E8CC7A', whiteSpace: 'nowrap' as const };
const td = { padding: '13px 14px', borderBottom: '1px solid rgba(216,180,90,.10)', color: '#F7F3E8' };
const tdStrong = { ...td, fontWeight: 900 };
const activeBadge = { display: 'inline-block', background: 'rgba(134,239,172,.10)', color: '#BBF7D0', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, border: '1px solid #15803D' };
const draftBadge = { display: 'inline-block', background: 'rgba(216,180,90,.10)', color: '#E8CC7A', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, border: '1px solid #B8943F' };
const inactiveBadge = { display: 'inline-block', background: 'rgba(220,203,156,.08)', color: '#DCCB9C', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, border: '1px solid #B8943F' };
const eyebrow = { fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: '#E8CC7A' };
const alertError = { background: 'rgba(248,113,113,.10)', border: '1px solid #B91C1C', color: '#FCA5A5', padding: 13, borderRadius: 12, marginBottom: 16 };
const alertSuccess = { background: 'rgba(134,239,172,.10)', border: '1px solid #15803D', color: '#BBF7D0', padding: 13, borderRadius: 12, marginBottom: 16 };
