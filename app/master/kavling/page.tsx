import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createKavling, toggleKavling } from './actions';
import KavioShell from '../../components/kavio-shell';

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
    <KavioShell active="/master/kavling">
      <div className="kavio-page-title">
        <div className="kavio-gold" style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4 }}>MASTER DATA / INVENTORY</div>
        <h1>Data Kavling</h1>
        <p>Kelola identitas kavling, tipe rumah, dan lifecycle inventory proyek.</p>
      </div>

      {error && <div className="kavio-alert">{error}</div>}
      {params.success && <div className="kavio-alert">{params.success}</div>}

      <section className="kavio-card" style={{ marginBottom: 18 }}>
        <div className="kavio-card-head">
          <div><div className="kavio-card-title">Tambah Kavling</div><div className="kavio-card-note">Kavling baru selalu dimulai dari status AVAILABLE.</div></div>
        </div>
        <form action={createKavling} className="kavio-toolbar" style={{ alignItems: 'end' }}>
          <Field name="id_kavling" label="ID Kavling" placeholder="A-11" required />
          <Field name="blok" label="Blok" placeholder="A" required />
          <Field name="no_kavling" label="No. Kavling" placeholder="11" required />
          <label className="kavio-field"><span>Tipe Rumah</span><select name="id_tipe" required defaultValue=""><option value="" disabled>Pilih tipe</option>{(tipeRumah ?? []).map((t) => <option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select></label>
          <button type="submit" className="kavio-primary">+ Simpan Kavling</button>
        </form>
      </section>

      <section className="kavio-card">
        <div className="kavio-card-head">
          <div><div className="kavio-card-title">Daftar Kavling</div><div className="kavio-card-note">{rows.length} data kavling terdaftar.</div></div>
          <span className="kavio-status">INVENTORY</span>
        </div>
        <div className="kavio-table-wrap">
          <table className="kavio-table">
            <thead><tr><th>No.</th><th>ID Kavling</th><th>Blok</th><th>No.</th><th>Tipe Rumah</th><th>Status</th><th>Aktif</th><th>Aksi</th></tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id_kavling}>
                  <td>{i + 1}</td><td><strong>{row.id_kavling}</strong></td><td>{row.blok}</td><td>{row.no_kavling}</td><td>{tipeMap.get(row.id_tipe) ?? row.id_tipe}</td>
                  <td><span className="kavio-status">{row.status_kavling}</span></td>
                  <td><span className="kavio-status">{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td>
                  <td><form action={toggleKavling}><input type="hidden" name="id_kavling" value={row.id_kavling} /><input type="hidden" name="status_aktif" value={String(row.status_aktif)} /><button type="submit" className="kavio-secondary">{row.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></form></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--kavio-muted)' }}>Belum ada data kavling.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '11px 16px', borderTop: '1px solid rgba(216,180,90,.16)', color: 'var(--kavio-muted)', fontSize: 11 }}>Lifecycle: <strong>AVAILABLE</strong> → BOOKING / BUILDING → READY_STOCK / SOLD</div>
      </section>
    </KavioShell>
  );
}

function Field({ name, label, placeholder, required }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <label className="kavio-field"><span>{label}</span><input name={name} placeholder={placeholder} required={required} /></label>;
}
