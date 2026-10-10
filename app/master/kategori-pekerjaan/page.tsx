import KavioFormActions from '../../components/KavioFormActions';
import {deleteMaster} from '../delete-actions';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createKategoriPekerjaan, toggleKategoriPekerjaan, updateKategoriPekerjaan } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioFormModal from '../../components/KavioFormModal';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams = Promise<{ error?: string; success?: string; edit?: string; tipe?: string }>;

export default async function MasterKategoriPekerjaanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
const { data, error } = await supabase.from('master_kategori_pekerjaan').select('id_kategori,nama_kategori,urutan,status_aktif').order('urutan',{ascending:true});
  const rows = data ?? [];
  const {data:types}=await supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe');
  const selectedType=types?.find(t=>t.id_tipe===params.tipe)??types?.[0];
  const {data:weights,error:weightError}=selectedType?await supabase.from('template_progress_tipe').select('id_kategori,bobot_standar').eq('id_tipe',selectedType.id_tipe):{data:[],error:null};
  const editRow = params.edit ? rows.find((row) => row.id_kategori === params.edit) : null;
  const pageError = params.error ?? error?.message ?? weightError?.message;

  return <main className="master-simple-page">
    {pageError && <div className="kavio-alert error">{pageError}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR KATEGORI PEKERJAAN</h2><div className="kavio-panel-note">Referensi kategori dan urutan yang menjadi dasar bobot progress SPK.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
<div className="kavio-panel-body"><form method="get" className="kavio-form"><label className="kavio-field"><span>BOBOT BERDASARKAN TIPE RUMAH</span><select name="tipe" defaultValue={selectedType?.id_tipe}>{types?.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select></label><div className="kavio-actions"><button className="kavio-button secondary">TAMPILKAN</button><a className="kavio-button secondary" href={`/master/perincian-pekerjaan?tipe=${encodeURIComponent(selectedType?.id_tipe??'')}`}>ATUR BOBOT & PERINCIAN</a></div></form></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>URUTAN</th><th>ID</th><th>NAMA KATEGORI</th><th>BOBOT (%)</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id_kategori}><td>{row.urutan}</td><td className="master-highlight">{row.id_kategori}</td><td>{row.nama_kategori}</td><td>{(Number(weights?.find(w=>w.id_kategori===row.id_kategori)?.bobot_standar??0)*100).toLocaleString('id-ID',{maximumFractionDigits:4})}</td><td><span className={`master-status ${row.status_aktif?'active':'inactive'}`}>{row.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><div className="kavio-master-row-actions"><a href={'/master/kategori-pekerjaan?edit='+encodeURIComponent(row.id_kategori)} className="kavio-button secondary">EDIT</a><form action={toggleKategoriPekerjaan}><input type="hidden" name="id_kategori" value={row.id_kategori}/><input type="hidden" name="status_aktif" value={String(row.status_aktif)}/><button type="submit" className="kavio-button secondary">{row.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form><KavioConfirmAction action={deleteMaster} label="HAPUS" confirmMessage="Hapus data master ini? Data yang digunakan tidak dapat dihapus." hidden={{master:'kategori-pekerjaan',id_kategori:row.id_kategori}}/></div></KavioActionGate></td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="kavio-empty">BELUM ADA DATA KATEGORI PEKERJAAN.</td></tr>}
      </tbody></table></div>
    </section>
    {editRow ? <KavioActionGate action="MASTER_WRITE"><KavioFormModal open closeHref="/master/kategori-pekerjaan" size="standard" ariaLabel="Edit Kategori Pekerjaan" closeOnBackdrop={false} persistenceKey={`master-kategori-edit:${editRow.id_kategori}`}><section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">EDIT KATEGORI — {editRow.id_kategori}</h2><div className="kavio-panel-note">ID kategori tetap. Nama dan urutan dapat diperbarui.</div></div></div><form action={updateKategoriPekerjaan} className="kavio-form kavio-panel-body"><input type="hidden" name="id_kategori" value={editRow.id_kategori}/><label className="kavio-field"><span>ID KATEGORI</span><input value={editRow.id_kategori} readOnly/></label><label className="kavio-field"><span>NAMA KATEGORI</span><input name="nama_kategori" defaultValue={editRow.nama_kategori} required/></label><label className="kavio-field"><span>URUTAN</span><input type="number" name="urutan" min="1" step="1" defaultValue={editRow.urutan} required/></label><KavioFormActions><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></KavioFormActions></form></section></KavioFormModal></KavioActionGate> : null}
    <KavioCreatePanel formKey="master-kategori-create" buttonLabel="+ TAMBAH KATEGORI" title="INPUT KATEGORI PEKERJAAN" note="Kategori ini menjadi dasar konfigurasi bobot progress SPK." badge="MASTER">
      <KavioActionGate action="MASTER_WRITE"><form action={createKategoriPekerjaan} className="kavio-form kavio-panel-body">
        <label className="kavio-field"><span>ID KATEGORI</span><input name="id_kategori" placeholder="KAT01" required/></label>
        <label className="kavio-field"><span>NAMA KATEGORI</span><input name="nama_kategori" placeholder="Pekerjaan Pondasi" required/></label>
        <label className="kavio-field"><span>URUTAN</span><input type="number" name="urutan" min="1" step="1" placeholder="1" required/></label>
        <KavioFormActions><button type="submit" className="kavio-button">SIMPAN KATEGORI</button></KavioFormActions>
      </form></KavioActionGate>
    </KavioCreatePanel>
  </main>;
}
