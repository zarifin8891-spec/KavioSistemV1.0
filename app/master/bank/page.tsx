import KavioFormActions from '../../components/KavioFormActions';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { deleteBank, createBank, toggleBank, updateBank } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioFormModal from '../../components/KavioFormModal';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams = Promise<{ error?: string; success?: string; edit?: string }>;
type Bank = { id_bank: string; nama_bank: string; status_aktif: boolean; keterangan: string | null; is_kpr:boolean; jenis_akun:string };

export default async function MasterBankPage({ searchParams }: { searchParams: SearchParams }) {
  const params=await searchParams; const supabase=await createClient();
const {data,error}=await supabase.from('master_bank').select('id_bank,nama_bank,status_aktif,keterangan,is_kpr,jenis_akun').order('nama_bank'); const rows=(data??[]) as Bank[]; const editRow=params.edit?rows.find(r=>r.id_bank===params.edit):null;
  return <main className="master-simple-page">
    {params.error??error?.message ? <div className="kavio-alert error">{params.error??error?.message}</div> : null}{params.success?<div className="kavio-alert success">{params.success}</div>:null}
    <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR BANK / KAS</h2><div className="kavio-panel-note">Akun penerimaan Kas/Bank. Hanya bank bertanda KPR dipilih untuk pembiayaan Sales.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID BANK</th><th>NAMA BANK</th><th>JENIS</th><th>KPR</th><th>KETERANGAN</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_bank}><td className="master-highlight">{r.id_bank}</td><td>{r.nama_bank}</td><td>{r.jenis_akun}</td><td>{r.is_kpr?'YA':'TIDAK'}</td><td>{r.keterangan||'—'}</td><td><span className={`master-status ${r.status_aktif?'active':'inactive'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><div className="kavio-master-row-actions"><a href={'/master/bank?edit='+encodeURIComponent(r.id_bank)} className="kavio-button secondary">EDIT</a><form action={toggleBank}><input type="hidden" name="id_bank" value={r.id_bank}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button type="submit" className="kavio-button secondary">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form><KavioConfirmAction action={deleteBank} label="HAPUS" confirmMessage="Hapus data master ini? Data yang sudah digunakan tidak dapat dihapus." hidden={{id_bank:r.id_bank}}/></div></KavioActionGate></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="kavio-empty">BELUM ADA DATA BANK.</td></tr>}</tbody></table></div>
    </section>
    {editRow?<KavioActionGate action="MASTER_WRITE"><KavioFormModal open closeHref="/master/bank" size="standard" ariaLabel="Edit Bank" closeOnBackdrop={false} persistenceKey={`master-bank-edit:${editRow.id_bank}`}><section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">EDIT BANK — {editRow.id_bank}</h2><div className="kavio-panel-note">ID Bank tetap. Ubah nama atau keterangan lalu simpan.</div></div></div><form action={updateBank} className="kavio-form kavio-panel-body"><input type="hidden" name="id_bank" value={editRow.id_bank}/><label className="kavio-field"><span>ID BANK</span><input value={editRow.id_bank} readOnly/></label><label className="kavio-field"><span>NAMA BANK</span><input name="nama_bank" defaultValue={editRow.nama_bank} required/></label><AccountFields row={editRow}/><label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" defaultValue={editRow.keterangan??''}/></label><KavioFormActions><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></KavioFormActions></form></section></KavioFormModal></KavioActionGate>:null}
    <KavioCreatePanel formKey="master-bank-create" buttonLabel="+ TAMBAH BANK / KAS" title="INPUT BANK / KAS BARU" note="Bank dipakai untuk proses KPR pada Sales." badge="MASTER"><KavioActionGate action="MASTER_WRITE"><form action={createBank} className="kavio-form kavio-panel-body">
      <label className="kavio-field"><span>ID BANK</span><input name="id_bank" placeholder="BTN" required/></label><label className="kavio-field"><span>NAMA BANK</span><input name="nama_bank" placeholder="Bank Tabungan Negara" required/></label><AccountFields/><label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="OPSIONAL"/></label><KavioFormActions><button type="submit" className="kavio-button">SIMPAN BANK</button></KavioFormActions>
    </form></KavioActionGate></KavioCreatePanel>
  </main>;
}

function AccountFields({row}:{row?:Bank|null}){return <><label className="kavio-field"><span>JENIS AKUN</span><select name="jenis_akun" defaultValue={row?.jenis_akun??'BANK'}><option>BANK</option><option>KAS</option></select></label><label className="kavio-field"><span>BANK PEMBIAYAAN KPR</span><select name="is_kpr" defaultValue={String(row?.is_kpr??false)}><option value="false">TIDAK</option><option value="true">YA</option></select></label></>;}
