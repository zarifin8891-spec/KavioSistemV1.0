import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createNotaris, toggleNotaris } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';

type SearchParams=Promise<{error?:string;success?:string}>;
type Notaris={id_notaris:string;nama_notaris:string;no_izin:string|null;no_hp:string|null;alamat:string|null;status_aktif:boolean};

export default async function MasterNotarisPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data,error}=await supabase.from('master_notaris').select('id_notaris,nama_notaris,no_izin,no_hp,alamat,status_aktif').order('nama_notaris'); const rows=(data??[]) as Notaris[];
 return <main className="master-simple-page">
  {p.error??error?.message?<div className="kavio-alert error">{p.error??error?.message}</div>:null}{p.success?<div className="kavio-alert success">{p.success}</div>:null}
  <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR NOTARIS</h2><div className="kavio-panel-note">Notaris aktif yang dapat dipilih untuk proses akad.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
   <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID</th><th>NAMA</th><th>NO. IZIN</th><th>NO. HP</th><th>ALAMAT</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_notaris}><td className="master-highlight">{r.id_notaris}</td><td>{r.nama_notaris}</td><td>{r.no_izin||'—'}</td><td>{r.no_hp||'—'}</td><td>{r.alamat||'—'}</td><td><span className={`master-status ${r.status_aktif?'active':'inactive'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><form action={toggleNotaris}><input type="hidden" name="id_notaris" value={r.id_notaris}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button type="submit" className="kavio-button secondary">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="kavio-empty">BELUM ADA DATA NOTARIS.</td></tr>}</tbody></table></div>
  </section>
  <KavioCreatePanel buttonLabel="+ TAMBAH NOTARIS" title="INPUT NOTARIS BARU" note="Notaris diisi sebagai referensi proses akad Sales." badge="MASTER"><form action={createNotaris} className="kavio-form kavio-panel-body"><label className="kavio-field"><span>ID NOTARIS</span><input name="id_notaris" placeholder="NTR01" required/></label><label className="kavio-field"><span>NAMA NOTARIS</span><input name="nama_notaris" placeholder="Nama lengkap notaris" required/></label><label className="kavio-field"><span>NO. IZIN</span><input name="no_izin" placeholder="Nomor izin"/></label><label className="kavio-field"><span>NO. HP</span><input name="no_hp" placeholder="08xxxxxxxxxx"/></label><label className="kavio-field sales-span-2"><span>ALAMAT</span><input name="alamat" placeholder="Alamat kantor notaris"/></label><div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN NOTARIS</button></div></form></KavioCreatePanel>
 </main>;
}
