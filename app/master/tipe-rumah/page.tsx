import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createTipeRumah, toggleTipeRumah } from './actions';

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function MasterTipeRumahPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('master_tipe_rumah')
    .select('id_tipe, nama_tipe, luas_tanah, luas_bangunan, status_aktif')
    .order('nama_tipe');

  const rows = data ?? [];
  const pageError = params.error ?? error?.message;

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>Master Tipe Rumah</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 6 }}>
            <button type="submit" style={logout}>Keluar</button>
          </form>
        </div>
      </header>

      <section style={{ padding: 28, maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Data Tipe Rumah</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Master tipe rumah yang menjadi referensi kavling dan SPK.</p>
        </div>

        {pageError && <div style={alertError}>{pageError}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}>
          <div style={sectionTitle}>Tambah Tipe Rumah</div>
          <form action={createTipeRumah} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, padding: 18 }}>
            <Field name="id_tipe" label="ID Tipe" placeholder="T36" required />
            <Field name="nama_tipe" label="Nama Tipe" placeholder="Type 36/72" required />
            <NumberField name="luas_tanah" label="Luas Tanah (m²)" placeholder="72" step="0.01" required />
            <NumberField name="luas_bangunan" label="Luas Bangunan (m²)" placeholder="36" step="0.01" required />
            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
              <button type="submit" style={primaryButton}>+ Simpan Tipe Rumah</button>
            </div>
          </form>
        </section>

        <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
          <div style={sectionTitle}>Daftar Tipe Rumah ({rows.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={th}>ID</th><th style={th}>Nama Tipe</th><th style={th}>Luas Tanah</th><th style={th}>Luas Bangunan</th><th style={th}>Aktif</th><th style={th}>Aksi</th>
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id_tipe}>
                    <td style={tdStrong}>{row.id_tipe}</td>
                    <td style={td}>{row.nama_tipe}</td>
                    <td style={td}>{formatNumber(row.luas_tanah)} m²</td>
                    <td style={td}>{formatNumber(row.luas_bangunan)} m²</td>
                    <td style={td}><span style={row.status_aktif ? activeBadge : inactiveBadge}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td>
                    <td style={td}>
                      <form action={toggleTipeRumah}>
                        <input type="hidden" name="id_tipe" value={row.id_tipe} />
                        <input type="hidden" name="status_aktif" value={String(row.status_aktif)} />
                        <button type="submit" style={row.status_aktif ? outlineButton : primaryMini}>{row.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 34, color: '#64748b' }}>Belum ada data tipe rumah.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({ name, label, placeholder, required }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <label style={labelStyle}><span>{label}</span><input name={name} placeholder={placeholder} required={required} style={inputStyle} /></label>;
}

function NumberField({ name, label, placeholder, step, required }: { name: string; label: string; placeholder: string; step?: string; required?: boolean }) {
  return <label style={labelStyle}><span>{label}</span><input type="number" name={name} placeholder={placeholder} step={step} min="0.01" required={required} style={inputStyle} /></label>;
}

function formatNumber(value: number | string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(parsed);
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
const primaryMini = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' };
const outlineButton = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' };
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const activeBadge = { display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const inactiveBadge = { display: 'inline-block', background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const alertError = { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 };
const alertSuccess = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 12, borderRadius: 10, marginBottom: 14 };
