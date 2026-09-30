import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createTipeRumah, toggleTipeRumah, updateTipeRumah } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams = Promise<{ error?: string; success?: string; edit?: string }>;
type TipeRumah = { id_tipe: string; nama_tipe: string; luas_tanah_m2: number | string | null; luas_bangunan_m2: number | string | null; status_aktif: boolean };

export default async function MasterTipeRumahPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
const { data, error } = await supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif').order('nama_tipe');
  const rows = (data ?? []) as TipeRumah[];
  const editRow = params.edit ? rows.find((row) => row.id_tipe === params.edit) : null;
  const pageError = params.error ?? error?.message;

  return <main className="master-simple-page">
    {pageError && <div className="kavio-alert error">{pageError}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR TIPE RUMAH</h2><div className="kavio-panel-note">Referensi tipe rumah untuk Kavling dan SPK.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID</th><th>NAMA TIPE</th><th>LUAS TANAH</th><th>LUAS BANGUNAN</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id_tipe}><td className="master-highlight">{row.id_tipe}</td><td>{row.nama_tipe}</td><td>{formatNumber(row.luas_tanah_m2)} m²</td><td>{formatNumber(row.luas_bangunan_m2)} m²</td><td><span className={`master-status ${row.status_aktif ? 'active' : 'inactive'}`}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><div className="kavio-master-row-actions"><a href={'/master/tipe-rumah?edit='+encodeURIComponent(row.id_tipe)} className="kavio-button secondary">EDIT</a><form action={toggleTipeRumah}><input type="hidden" name="id_tipe" value={row.id_tipe}/><input type="hidden" name="status_aktif" value={String(row.status_aktif)}/><button type="submit" className="kavio-button secondary">{row.status_aktif ? 'NONAKTIFKAN' : 'AKTIFKAN'}</button></form></div></KavioActionGate></td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="kavio-empty">BELUM ADA DATA TIPE RUMAH.</td></tr>}
      </tbody></table></div>
    </section>
    {editRow ? <KavioActionGate action="MASTER_WRITE"><section className="kavio-panel kavio-master-edit-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">EDIT TIPE RUMAH — {editRow.id_tipe}</h2><div className="kavio-panel-note">ID tipe tetap. Nama dan luasan dapat diperbarui.</div></div><a href="/master/tipe-rumah" className="kavio-button secondary">BATAL</a></div><form action={updateTipeRumah} className="kavio-form kavio-panel-body"><input type="hidden" name="id_tipe" value={editRow.id_tipe}/><label className="kavio-field"><span>ID TIPE</span><input value={editRow.id_tipe} readOnly/></label><label className="kavio-field"><span>NAMA TIPE</span><input name="nama_tipe" defaultValue={editRow.nama_tipe} required/></label><label className="kavio-field"><span>LUAS TANAH (M²)</span><input type="number" name="luas_tanah" min="0.01" step="0.01" defaultValue={editRow.luas_tanah_m2??''} required/></label><label className="kavio-field"><span>LUAS BANGUNAN (M²)</span><input type="number" name="luas_bangunan" min="0.01" step="0.01" defaultValue={editRow.luas_bangunan_m2??''} required/></label><div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></div></form></section></KavioActionGate> : null}
    <KavioCreatePanel buttonLabel="+ TAMBAH TIPE RUMAH" title="INPUT TIPE RUMAH BARU" note="Tipe rumah menjadi referensi utama untuk Kavling dan SPK." badge="MASTER">
      <KavioActionGate action="MASTER_WRITE"><form action={createTipeRumah} className="kavio-form kavio-panel-body">
        <label className="kavio-field"><span>ID TIPE</span><input name="id_tipe" placeholder="T36" required/></label>
        <label className="kavio-field"><span>NAMA TIPE</span><input name="nama_tipe" placeholder="Type 36/72" required/></label>
        <label className="kavio-field"><span>LUAS TANAH (M²)</span><input type="number" name="luas_tanah" placeholder="72" min="0.01" step="0.01" required/></label>
        <label className="kavio-field"><span>LUAS BANGUNAN (M²)</span><input type="number" name="luas_bangunan" placeholder="36" min="0.01" step="0.01" required/></label>
        <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN TIPE RUMAH</button></div>
      </form></KavioActionGate>
    </KavioCreatePanel>
  </main>;
}

function formatNumber(value: number | string | null) { const parsed = Number(value); return Number.isFinite(parsed) ? new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(parsed) : '—'; }
