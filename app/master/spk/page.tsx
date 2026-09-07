import Link from 'next/link';
import { redirect } from 'next/navigation';
import { activateSpk, createSpk, deactivateSpk } from './actions';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string }>;

type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_kategori: string; bobot_standar: number | string };
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

  const [kavlingRes, tipeRes, kantorRes, mandorRes, kategoriRes, spkRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe').eq('status_aktif', true).order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('master_kantor_pelaksana').select('id_kantor, nama_kantor_pelaksana').eq('status_aktif', true).order('nama_kantor_pelaksana'),
    supabase.from('master_mandor').select('id_mandor, nama_mandor, id_kantor').eq('status_aktif', true).order('nama_mandor'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('spk').select('id_spk, id_kavling, tgl_spk, id_tipe, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active').order('created_at', { ascending: false }),
  ]);

  const kavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kantorRows = (kantorRes.data ?? []) as Kantor[];
  const mandorRows = (mandorRes.data ?? []) as Mandor[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const spkRows = (spkRes.data ?? []) as Spk[];

  const pageError = params.error ?? kavlingRes.error?.message ?? tipeRes.error?.message ?? kantorRes.error?.message ?? mandorRes.error?.message ?? kategoriRes.error?.message ?? spkRes.error?.message;

  const tipeMap = new Map(tipeRows.map((item) => [item.id_tipe, item.nama_tipe]));
  const kantorMap = new Map(kantorRows.map((item) => [item.id_kantor, item.nama_kantor_pelaksana]));
  const mandorMap = new Map(mandorRows.map((item) => [item.id_mandor, item.nama_mandor]));
  const kavlingMap = new Map(kavlingRows.map((item) => [item.id_kavling, item]));
  const kategoriMap = new Map(kategoriRows.map((item) => [item.id_kategori, item.nama_kategori]));

  const { data: templates } = kavlingRows.length
    ? await supabase.from('template_progress_tipe').select('id_kategori, bobot_standar').eq('id_tipe', kavlingRows[0]?.id_tipe).order('id_kategori')
    : { data: [] as Template[] };

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>SPK Pembangunan</div>
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
          <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Kelola SPK</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Buat SPK pembangunan, pilih bobot standar/custom, lalu aktifkan setelah konfigurasi bobot 100%.</p>
        </div>

        {pageError && <div style={alertError}>{pageError}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}>
          <div style={sectionTitle}>Buat SPK Baru</div>
          <form action={createSpk} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, padding: 18 }}>
            <label style={labelStyle}>
              <span>Kavling</span>
              <select name="id_kavling" required style={inputStyle} defaultValue="">
                <option value="" disabled>Pilih kavling</option>
                {kavlingRows.map((item) => <option key={item.id_kavling} value={item.id_kavling}>{item.id_kavling} — {tipeMap.get(item.id_tipe) ?? item.id_tipe}</option>)}
              </select>
            </label>
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
                {mandorRows.map((item) => <option key={item.id_mandor} value={item.id_mandor}>{item.nama_mandor}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              <span>Jenis Bobot</span>
              <select name="jenis_bobot" required style={inputStyle} defaultValue="STANDAR">
                <option value="STANDAR">STANDAR — dari template tipe rumah</option>
                <option value="CUSTOM">CUSTOM — atur sendiri</option>
              </select>
            </label>

            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <div style={weightHeader}>
                <div>
                  <div style={{ fontWeight: 800 }}>Konfigurasi Bobot Progress</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>Untuk STANDAR, sistem memakai template tipe rumah. Untuk CUSTOM, isi setiap bobot dalam persen.</div>
                </div>
                <div style={noteBadge}>Total wajib 100%</div>
              </div>
              <div style={tableWrap}>
                <table style={table}>
                  <thead><tr><th style={th}>Urut</th><th style={th}>Kategori</th><th style={th}>Bobot Standar</th><th style={th}>Bobot Custom (%)</th></tr></thead>
                  <tbody>
                    {kategoriRows.map((item) => {
                      const standard = Number((templates ?? []).find((row: Template) => row.id_kategori === item.id_kategori)?.bobot_standar ?? 0) * 100;
                      return <tr key={item.id_kategori}>
                        <td style={td}>{item.urutan}</td>
                        <td style={tdStrong}>{item.nama_kategori}</td>
                        <td style={td}>{standard.toFixed(2)}%</td>
                        <td style={td}><input name={`bobot_${item.id_kategori}`} type="number" min="0" max="100" step="0.01" defaultValue="0" style={smallInput} /></td>
                      </tr>;
                    })}
                    {!kategoriRows.length && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', padding: 30 }}>Belum ada kategori pekerjaan aktif.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
              <button type="submit" style={primaryButton} disabled={!kavlingRows.length || !kantorRows.length || !mandorRows.length || !kategoriRows.length}>+ Simpan SPK sebagai DRAFT</button>
            </div>
          </form>
        </section>

        <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
          <div style={sectionTitle}>Daftar SPK ({spkRows.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}>
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
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                ))}
                {!spkRows.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: 34, color: '#64748b' }}>Belum ada data SPK.</td></tr>}
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

const header = { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#64748b', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#2563eb' };
const title = { fontSize: 21, fontWeight: 800 };
const logout = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' };
const sectionTitle = { padding: '16px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 };
const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 12, fontWeight: 700, color: '#475569' };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#fff', color: '#0f172a' };
const smallInput = { ...inputStyle, maxWidth: 150 };
const primaryButton = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 9, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' };
const primaryMini = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' };
const outlineButton = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' };
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const tableWrap = { border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 12 };
const table = { width: '100%', borderCollapse: 'collapse' as const };
const weightHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 10 };
const noteBadge = { background: '#eff6ff', color: '#1d4ed8', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' as const };
const activeBadge = { display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const draftBadge = { display: 'inline-block', background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const inactiveBadge = { display: 'inline-block', background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const alertError = { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 };
const alertSuccess = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 12, borderRadius: 10, marginBottom: 14 };
