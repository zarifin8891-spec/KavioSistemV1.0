import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createBank, toggleBank } from './actions';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Bank = { id_bank: string; nama_bank: string; status_aktif: boolean; keterangan: string | null };

export default async function MasterBankPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.from('master_bank').select('id_bank,nama_bank,status_aktif,keterangan').order('nama_bank');
  const rows = (data ?? []) as Bank[];
  return <main className="master-simple-page"><div className="simple-head"><div><div className="simple-eyebrow">MASTER DATA</div><h1>MASTER BANK</h1><p>Daftar bank yang dapat dipilih untuk pembiayaan KPR.</p></div></div>
    {params.error ?? error?.message ? <div className="simple-alert error">{params.error ?? error?.message}</div> : null}{params.success ? <div className="simple-alert success">{params.success}</div> : null}
    <section className="simple-card"><h2>TAMBAH BANK</h2><form action={createBank} className="simple-grid"><label>ID BANK<input name="id_bank" required placeholder="BTN" /></label><label>NAMA BANK<input name="nama_bank" required placeholder="Bank Tabungan Negara" /></label><label className="full">KETERANGAN<textarea name="keterangan" rows={2} placeholder="Opsional" /></label><div className="full action-end"><button type="submit">SIMPAN BANK</button></div></form></section>
    <section className="simple-card"><h2>DAFTAR BANK</h2><div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>ID BANK</th><th>NAMA BANK</th><th>KETERANGAN</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_bank}><td>{r.id_bank}</td><td>{r.nama_bank}</td><td>{r.keterangan || '—'}</td><td><span className={`simple-badge ${r.status_aktif?'on':'off'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><form action={toggleBank}><input type="hidden" name="id_bank" value={r.id_bank}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button className="simple-outline" type="submit">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></td></tr>)}{!rows.length&&<tr><td colSpan={5} className="simple-empty">BELUM ADA DATA BANK.</td></tr>}</tbody></table></div></section>
  </main>;
}
