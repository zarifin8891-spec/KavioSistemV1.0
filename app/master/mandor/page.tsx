import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createMandor, toggleMandor } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams=Promise<{error?:string;success?:string}>;
type Kantor={id_kantor:string;nama_kantor_pelaksana:string};
type Mandor={id_mandor:string;nama_mandor:string;id_kantor:string;no_hp:string|null;status_aktif:boolean;keterangan:string|null};

export default async function MasterMandorPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const [{data:mandor, error:mandorError},{data:kantor,error:kantorError}]=await Promise.all([supabase.from('master_mandor').select('id_mandor,nama_mandor,id_kantor,no_hp,status_aktif,keterangan').order('nama_mandor'),supabase.from('master_kantor_pelaksana').select('id_kantor,nama_kantor_pelaksana').eq('status_aktif',true).order('nama_kantor_pelaksana')]);
 const rows=(mandor??[]) as Mandor[]; const kantorRows=(kantor??[]) as Kantor[]; const kantorMap=new Map(kantorRows.map(x=>[x.id_kantor,x.nama_kantor_pelaksana])); const error=p.error??mandorError?.message??kantorError?.message;
 return <main className="master-simple-page">
  {error?<div className="kavio-alert error">{error}</div>:null}{p.success?<div className="kavio-alert success">{p.success}</div>:null}{!kantorRows.length&&!kantorError?<div className="kavio-alert"><strong>PERHATIAN:</strong> Tambahkan kantor pelaksana aktif sebelum membuat mandor.</div>:null}
  <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR MANDOR</h2><div className="kavio-panel-note">Mandor terhubung ke Kantor Pelaksana dan dipilih saat membuat SPK.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
   <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID</th><th>NAMA MANDOR</th><th>KANTOR / PELAKSANA</th><th>NO. HP</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_mandor}><td className="master-highlight">{r.id_mandor}</td><td>{r.nama_mandor}</td><td>{kantorMap.get(r.id_kantor)??r.id_kantor}</td><td>{r.no_hp||'—'}</td><td><span className={`master-status ${r.status_aktif?'active':'inactive'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><form action={toggleMandor}><input type="hidden" name="id_mandor" value={r.id_mandor}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button type="submit" className="kavio-button secondary">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></KavioActionGate></td></tr>)}{!rows.length&&<tr><td colSpan={6} className="kavio-empty">BELUM ADA DATA MANDOR.</td></tr>}</tbody></table></div>
  </section>
  <KavioCreatePanel buttonLabel="+ TAMBAH MANDOR" title="INPUT MANDOR BARU" note="Mandor harus terhubung ke kantor pelaksana aktif." badge="MASTER"><KavioActionGate action="MASTER_WRITE"><form action={createMandor} className="kavio-form kavio-panel-body"><label className="kavio-field"><span>ID MANDOR</span><input name="id_mandor" placeholder="MDR05" required/></label><label className="kavio-field"><span>NAMA MANDOR</span><input name="nama_mandor" placeholder="Nama lengkap mandor" required/></label><label className="kavio-field"><span>KANTOR / PELAKSANA</span><select name="id_kantor" defaultValue="" required><option value="" disabled>PILIH KANTOR</option>{kantorRows.map(x=><option key={x.id_kantor} value={x.id_kantor}>{x.nama_kantor_pelaksana}</option>)}</select></label><label className="kavio-field"><span>NO. HP</span><input name="no_hp" placeholder="08xxxxxxxxxx"/></label><label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="OPSIONAL"/></label><div className="kavio-actions"><button type="submit" className="kavio-button" disabled={!kantorRows.length}>SIMPAN MANDOR</button></div></form></KavioActionGate></KavioCreatePanel>
 </main>;
}
