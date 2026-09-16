import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createNotaris, toggleNotaris } from './actions';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Notaris = { id_notaris: string; nama_notaris: string; no_izin: string | null; no_hp: string | null; alamat: string | null; status_aktif: boolean };

export default async function MasterNotarisPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.from('master_notaris').select('id_notaris,nama_notaris,no_izin,no_hp,alamat,status_aktif').order('nama_notaris');
  const rows = (data ?? []) as Notaris[];
  return <main className="master-simple-page"><div className="simple-head"><div><div className="simple-eyebrow">MASTER DATA</div><h1>MASTER NOTARIS</h1><p>Daftar notaris yang dapat dipilih untuk proses akad.</p></div></div>
    {params.error ?? error?.message ? <div className="simple-alert error">{params.error ?? error?.message}</div> : null}{params.success ? <div className="simple-alert success">{params.success}</div> : null}
    <section className="simple-card"><h2>TAMBAH NOTARIS</h2><form action={createNotaris} className="simple-grid"><label>ID NOTARIS<input name="id_notaris" required placeholder="NTR01" /></label><label>NAMA NOTARIS<input name="nama_notaris" required placeholder="Nama lengkap notaris" /></label><label>NO. IZIN<input name="no_izin" placeholder="Nomor izin" /></label><label>NO. HP<input name="no_hp" placeholder="08xxxxxxxxxx" /></label><label className="full">ALAMAT<textarea name="alamat" rows={2} placeholder="Alamat kantor notaris" /></label><div className="full action-end"><button type="submit">SIMPAN NOTARIS</button></div></form></section>
    <section className="simple-card"><h2>DAFTAR NOTARIS</h2><div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>ID</th><th>NAMA</th><th>NO. IZIN</th><th>NO. HP</th><th>ALAMAT</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_notaris}><td>{r.id_notaris}</td><td>{r.nama_notaris}</td><td>{r.no_izin||'—'}</td><td>{r.no_hp||'—'}</td><td>{r.alamat||'—'}</td><td><span className={`simple-badge ${r.status_aktif?'on':'off'}`}>{r.status_aktif?'AKTIF':'NONAKTIF'}</span></td><td><form action={toggleNotaris}><input type="hidden" name="id_notaris" value={r.id_notaris}/><input type="hidden" name="status_aktif" value={String(r.status_aktif)}/><button className="simple-outline" type="submit">{r.status_aktif?'NONAKTIFKAN':'AKTIFKAN'}</button></form></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="simple-empty">BELUM ADA DATA NOTARIS.</td></tr>}</tbody></table></div></section>
  </main>;
}
