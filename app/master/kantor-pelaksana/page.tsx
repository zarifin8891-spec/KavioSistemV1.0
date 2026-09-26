import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createKantorPelaksana, toggleKantorPelaksana } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams=Promise<{error?:string;success?:string}>;
type Kantor={id_kantor:string;nama_kantor_pelaksana:string;penanggung_jawab:string|null;no_hp:string|null;status_aktif:boolean;keterangan:string|null};

export default async function MasterKantorPelaksanaPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data,error}=await supabase.from('master_kantor_pelaksana').select('id_kantor,nama_kantor_pelaksana,penanggung_jawab,no_hp,status_aktif,keterangan').order('nama_kantor_pelaksana'); const rows=(data??[]) as Kantor[];
 return <main className="master-simple-page">
  {p.error??error?.message?<div className="kavio-alert error">{p.error??error?.message}</div>:null}{p.success?<div className="kavio-alert success">{p.success}</div>:null}
  <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR KANTOR PELAKSANA</h2><div className="kavio-panel-note">Kantor/pelaksana menjadi induk data Mandor dan pilihan pada SPK.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
   <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID</th><th>NAMA KANTOR</th><th>PENANGGUNG JAWAB</th><th>NO. HP</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_kantor}><td className="master-highlight">{r.id_kantor}</td><td>{r.nama_kantor_pelaksana}</td><td>{r.penanggung_jawab||'—'}</td><td>{r.no_hp||'—'}</td><td><span className={`master-status ${r.status_aktif?'active':'inactive'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><form action={toggleKantorPelaksana}><input type="hidden" name="id_kantor" value={r.id_kantor}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button type="submit" className="kavio-button secondary">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></KavioActionGate></td></tr>)}{!rows.length&&<tr><td colSpan={6} className="kavio-empty">BELUM ADA DATA KANTOR PELAKSANA.</td></tr>}</tbody></table></div>
  </section>
  <KavioCreatePanel buttonLabel="+ TAMBAH KANTOR" title="INPUT KANTOR PELAKSANA" note="Kantor akan menjadi induk pilihan Mandor pada SPK." badge="MASTER"><KavioActionGate action="MASTER_WRITE"><form action={createKantorPelaksana} className="kavio-form kavio-panel-body"><label className="kavio-field"><span>ID KANTOR</span><input name="id_kantor" placeholder="KTR03" required/></label><label className="kavio-field"><span>NAMA KANTOR / PELAKSANA</span><input name="nama_kantor_pelaksana" placeholder="CV Maju Bersama" required/></label><label className="kavio-field"><span>PENANGGUNG JAWAB</span><input name="penanggung_jawab" placeholder="Nama PIC"/></label><label className="kavio-field"><span>NO. HP</span><input name="no_hp" placeholder="08xxxxxxxxxx"/></label><label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="OPSIONAL"/></label><div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN KANTOR</button></div></form></KavioActionGate></KavioCreatePanel>
 </main>;
}
