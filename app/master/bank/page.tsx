import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createBank, toggleBank } from './actions';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioActionGate from '../../components/KavioActionGate';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Bank = { id_bank: string; nama_bank: string; status_aktif: boolean; keterangan: string | null };

export default async function MasterBankPage({ searchParams }: { searchParams: SearchParams }) {
  const params=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
  const {data,error}=await supabase.from('master_bank').select('id_bank,nama_bank,status_aktif,keterangan').order('nama_bank'); const rows=(data??[]) as Bank[];
  return <main className="master-simple-page">
    {params.error??error?.message ? <div className="kavio-alert error">{params.error??error?.message}</div> : null}{params.success?<div className="kavio-alert success">{params.success}</div>:null}
    <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR BANK</h2><div className="kavio-panel-note">Bank aktif yang dapat dipilih untuk pembiayaan KPR Sales.</div></div><span className="kavio-badge">{rows.length} DATA</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID BANK</th><th>NAMA BANK</th><th>KETERANGAN</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_bank}><td className="master-highlight">{r.id_bank}</td><td>{r.nama_bank}</td><td>{r.keterangan||'—'}</td><td><span className={`master-status ${r.status_aktif?'active':'inactive'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><KavioActionGate action="MASTER_WRITE"><form action={toggleBank}><input type="hidden" name="id_bank" value={r.id_bank}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button type="submit" className="kavio-button secondary">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></KavioActionGate></td></tr>)}{!rows.length&&<tr><td colSpan={5} className="kavio-empty">BELUM ADA DATA BANK.</td></tr>}</tbody></table></div>
    </section>
    <KavioCreatePanel buttonLabel="+ TAMBAH BANK" title="INPUT BANK BARU" note="Bank dipakai untuk proses KPR pada Sales." badge="MASTER"><KavioActionGate action="MASTER_WRITE"><form action={createBank} className="kavio-form kavio-panel-body">
      <label className="kavio-field"><span>ID BANK</span><input name="id_bank" placeholder="BTN" required/></label><label className="kavio-field"><span>NAMA BANK</span><input name="nama_bank" placeholder="Bank Tabungan Negara" required/></label><label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="OPSIONAL"/></label><div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN BANK</button></div>
    </form></KavioActionGate></KavioCreatePanel>
  </main>;
}
