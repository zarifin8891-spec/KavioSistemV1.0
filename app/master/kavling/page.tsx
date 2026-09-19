import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createKavling, toggleKavling } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function MasterKavlingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: kavling, error: kavlingError }, { data: tipeRumah, error: tipeError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,blok,no_kavling,id_tipe,status_kavling,status_aktif,luas_tanah_standar,luas_tanah_real,kelebihan_tanah,harga_standar,harga_tanah_meter,harga_jual').order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe'),
  ]);
  const rows = kavling ?? [];
  const tipeRows = tipeRumah ?? [];
  const tipeMap = new Map(tipeRows.map((t) => [t.id_tipe,t.nama_tipe]));
  const pageError = params.error ?? kavlingError?.message ?? tipeError?.message;

  return <main className="master-simple-page kavling-page">
    {pageError && <div className="kavio-alert error">{pageError}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR KAVLING</h2><div className="kavio-panel-note">Inventory kavling dan lifecycle pembangunan proyek.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>NO</th><th>ID KAVLING</th><th>BLOK</th><th>NOMOR</th><th>TIPE RUMAH</th><th>L. TANAH</th><th>KELEBIHAN</th><th>HARGA STANDAR</th><th>HARGA TANAH/M²</th><th>HARGA JUAL</th><th>STATUS KAVLING</th><th>STATUS DATA</th><th>AKSI</th></tr></thead><tbody>
        {rows.map((row,i)=><tr key={row.id_kavling}><td>{i+1}</td><td className="master-highlight">{row.id_kavling}</td><td>{row.blok}</td><td>{row.no_kavling}</td><td>{tipeMap.get(row.id_tipe)??row.id_tipe}</td><td>{Number(row.luas_tanah_real).toFixed(2)} m²</td><td>{Number(row.kelebihan_tanah).toFixed(2)} m²</td><td>{formatRupiah(row.harga_standar)}</td><td>{formatRupiah(row.harga_tanah_meter)}</td><td>{formatRupiah(row.harga_jual)}</td><td><span className="master-status">{row.status_kavling}</span></td><td><span className={`master-status ${row.status_aktif?'active':'inactive'}`}>{row.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><form action={toggleKavling}><input type="hidden" name="id_kavling" value={row.id_kavling}/><input type="hidden" name="status_aktif" value={String(row.status_aktif)}/><button type="submit" className="kavio-button secondary">{row.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></td></tr>)}
        {!rows.length&&<tr><td colSpan={13} className="kavio-empty">BELUM ADA DATA KAVLING.</td></tr>}
      </tbody></table></div>
      <div className="master-table-foot">LIFECYCLE: AVAILABLE → BOOKING / BUILDING → READY_STOCK / SOLD</div>
    </section>
    <KavioCreatePanel buttonLabel="+ TAMBAH KAVLING" title="INPUT KAVLING BARU" note="Kavling baru dimulai dari status AVAILABLE." badge="INVENTORY">
      <form action={createKavling} className="kavio-form kavio-panel-body">
        <label className="kavio-field"><span>ID KAVLING</span><input name="id_kavling" placeholder="A-11" required/></label>
        <label className="kavio-field"><span>BLOK</span><input name="blok" placeholder="A" required/></label>
        <label className="kavio-field"><span>NOMOR KAVLING</span><input name="no_kavling" placeholder="11" required/></label>
        <label className="kavio-field"><span>TIPE RUMAH</span><select name="id_tipe" defaultValue="" required><option value="" disabled>PILIH TIPE</option>{tipeRows.map((t)=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select></label>
        <label className="kavio-field"><span>LUAS TANAH STANDAR (M²)</span><input name="luas_tanah_standar" type="number" min="0" step="0.01" placeholder="0.00" required/></label>
        <label className="kavio-field"><span>LUAS TANAH REAL (M²)</span><input name="luas_tanah_real" type="number" min="0" step="0.01" placeholder="0.00" required/></label>
        <label className="kavio-field"><span>HARGA STANDAR</span><input name="harga_standar" type="number" min="0" step="1000" placeholder="0" required/></label>
        <label className="kavio-field"><span>HARGA TANAH / M²</span><input name="harga_tanah_meter" type="number" min="0" step="1000" placeholder="0" required/></label>
        <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN KAVLING</button></div>
      </form>
    </KavioCreatePanel>
  </main>;
}

function formatRupiah(value: number | string | null) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n) : '—';
}
