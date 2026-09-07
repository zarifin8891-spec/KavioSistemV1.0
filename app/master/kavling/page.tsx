import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createKavling, toggleKavling } from './actions';

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function MasterKavlingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: kavling, error: kavlingError }, { data: tipeRumah, error: tipeError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe, status_kavling, status_aktif').order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
  ]);

  const tipeMap = new Map((tipeRumah ?? []).map((t) => [t.id_tipe, t.nama_tipe]));
  const rows = kavling ?? [];
  const error = params.error ?? kavlingError?.message ?? tipeError?.message;

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>Master Kavling</div>
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
          <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Data Kavling</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Master identitas kavling yang menjadi kunci relasi modul KAVIO.</p>
        </div>

        {error && <div style={alertError}>{error}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}>
          <div style={sectionTitle}>Tambah Kavling</div>
          <form action={createKavling} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, padding: 18 }}>
            <Field name="id_kavling" label="ID Kavling" placeholder="A-11" required />
            <Field name="blok" label="Blok" placeholder="A" required />
            <Field name="no_kavling" label="No. Kavling" placeholder="11" required />
            <label style={labelStyle}>
              <span>Tipe Rumah</span>
              <select name="id_tipe" required style={inputStyle} defaultValue="">
                <option value="" disabled>Pilih tipe</option>
                {(tipeRumah ?? []).map((t) => <option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              <span>Status Kavling</span>
              <select name="status_kavling" style={inputStyle} defaultValue="AVAILABLE">
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BOOKING">BOOKING</option>
                <option value="SOLD">SOLD</option>
                <option value="BUILDING">BUILDING</option>
                <option value="READY_STOCK">READY STOCK</option>
                <option value="COMPLETED">COMPLETED (legacy)</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
              <button type="submit" style={primaryButton}>+ Simpan Kavling</button>
            </div>
          </form>
        </section>

        <section style={{ ...card, marginTop: 20, overflow: 'hidden' }}>
          <div style={sectionTitle}>Daftar Kavling ({rows.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={th}>ID</th><th style={th}>Blok</th><th style={th}>No.</th><th style={th}>Tipe</th><th style={th}>Status</th><th style={th}>Aktif</th><th style={th}>Aksi</th>
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id_kavling}>
                    <td style={tdStrong}>{row.id_kavling}</td>
                    <td style={td}>{row.blok}</td>
                    <td style={td}>{row.no_kavling}</td>
                    <td style={td}>{tipeMap.get(row.id_tipe) ?? row.id_tipe}</td>
                    <td style={td}>{row.status_kavling}</td>
                    <td style={td}><span style={row.status_aktif ? activeBadge : inactiveBadge}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td>
                    <td style={td}>
                      <form action={toggleKavling}>
                        <input type="hidden" name="id_kavling" value={row.id_kavling} />
                        <input type="hidden" name="status_aktif" value={String(row.status_aktif)} />
                        <button type="submit" style={row.status_aktif ? outlineButton : primaryMini}>{row.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 34, color: '#64748b' }}>Belum ada data kavling.</td></tr>}
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
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const activeBadge = { display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const inactiveBadge = { display: 'inline-block', background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
const alertError = { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 };
const alertSuccess = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 12, borderRadius: 10, marginBottom: 14 };
