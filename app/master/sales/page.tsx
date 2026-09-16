import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSales, deactivateSales } from './actions';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string; add?: string }>;
type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };
type Notaris = { id_notaris: string; nama_notaris: string };
type Sales = { id_sales:string; id_kavling:string; nama_konsumen:string; status_sales:string; jenis_pembayaran:string; id_bank:string|null; id_notaris:string|null; harga_jual:number|string|null; tgl_booking:string|null; target_akad:string|null; tgl_akad:string|null; status_aktif:boolean; created_at:string };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [kavlingRes, tipeRes, bankRes, notarisRes, salesRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_kavling,status_aktif').eq('status_aktif',true).order('id_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe'),
    supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).order('nama_bank'),
    supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
    supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif,created_at').order('created_at',{ascending:false}),
  ]);
  const kavlings=(kavlingRes.data??[]) as Kavling[]; const types=(tipeRes.data??[]) as Tipe[]; const banks=(bankRes.data??[]) as Bank[]; const notaries=(notarisRes.data??[]) as Notaris[]; const sales=(salesRes.data??[]) as Sales[];
  const typeMap=new Map(types.map(r=>[r.id_tipe,r.nama_tipe])); const bankMap=new Map(banks.map(r=>[r.id_bank,r.nama_bank])); const active=sales.filter(r=>r.status_aktif); const count=(s:string)=>active.filter(r=>r.status_sales===s).length;
  const saleable=kavlings.filter(r=>['AVAILABLE','BUILDING','READY_STOCK'].includes(r.status_kavling));
  const error=params.error??kavlingRes.error?.message??tipeRes.error?.message??bankRes.error?.message??notarisRes.error?.message??salesRes.error?.message;
  const addOpen=params.add==='1';
  return <main className="sales-page"><section className="sales-content"><div className="sales-title"><div><h1>SALES MANAGEMENT</h1><p>KELOLA DATA KONSUMEN, STATUS PENJUALAN, DAN STATUS PEMBAYARAN.</p></div></div>
    {error&&<div className="simple-alert error">{error}</div>}{params.success&&<div className="simple-alert success">{params.success}</div>}
    {addOpen&&<section className="sales-module-card sales-form-card"><div className="sales-form-head"><div><strong>INPUT SALES BARU</strong><small>DATA SALES, BANK KPR, DAN INFORMASI AKAD.</small></div><Link className="sales-secondary" href="/master/sales">TUTUP</Link></div><form action={createSales} className="sales-form-grid">
      <label className="sales-field">KAVLING<select name="id_kavling" required><option value="">PILIH KAVLING</option>{saleable.map(r=><option key={r.id_kavling} value={r.id_kavling}>{r.id_kavling} — {typeMap.get(r.id_tipe)??r.id_tipe} — {r.status_kavling}</option>)}</select></label>
      <label className="sales-field">NAMA KONSUMEN<input name="nama_konsumen" required placeholder="NAMA LENGKAP KONSUMEN" /></label>
      <label className="sales-field">STATUS SALES<select name="status_sales" defaultValue="BOOKING"><option value="BOOKING">BOOKING</option><option value="DP">DP</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></label>
      <label className="sales-field">JENIS PEMBAYARAN<select name="jenis_pembayaran" defaultValue="KPR"><option value="KPR">KPR</option><option value="CASH">CASH</option><option value="CASH_BERTAHAP">CASH BERTAHAP</option></select></label>
      <label className="sales-field">BANK KPR<select name="id_bank" defaultValue=""><option value="">PILIH BANK (WAJIB UNTUK KPR)</option>{banks.map(b=><option key={b.id_bank} value={b.id_bank}>{b.nama_bank}</option>)}</select></label>
      <label className="sales-field">HARGA JUAL<input name="harga_jual" type="number" min="0" step="1000" placeholder="0" /></label>
      <label className="sales-field">TANGGAL BOOKING<input name="tgl_booking" type="date" /></label>
      <label className="sales-field">TARGET AKAD<input name="target_akad" type="date" /></label>
      <label className="sales-field">TANGGAL AKAD<input name="tgl_akad" type="date" /></label>
      <label className="sales-field">NOTARIS AKAD<select name="id_notaris" defaultValue=""><option value="">PILIH NOTARIS (WAJIB UNTUK AKAD)</option>{notaries.map(n=><option key={n.id_notaris} value={n.id_notaris}>{n.nama_notaris}</option>)}</select></label>
      <div className="sales-kpr-note"><strong>PROSES KPR:</strong> UPDATE TAHAPAN DI HALAMAN DETAIL SALES: KELENGKAPAN DATA → SURVEY BANK → INTERVIEW → SP3K.</div>
      <div className="sales-full sales-actions"><button className="sales-primary" type="submit" disabled={!saleable.length}>SIMPAN SALES</button></div>
    </form></section>}
    <section className="sales-module-card"><div className="sales-filter-row"><select className="sales-filter" defaultValue=""><option value="">SEMUA STATUS</option><option>BOOKING</option><option>DP</option><option value="PROSES_KPR">PROSES KPR</option><option>AKAD</option><option>BATAL</option></select><select className="sales-filter" defaultValue=""><option value="">SEMUA TIPE</option>{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select><input className="sales-filter sales-search" placeholder="CARI NAMA KONSUMEN..."/><Link className="sales-add" href="/master/sales?add=1">+ TAMBAH SALES</Link></div>
      <div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>NO</th><th>TANGGAL</th><th>KAVLING</th><th>NAMA KONSUMEN</th><th>TIPE</th><th>HARGA</th><th>JENIS BAYAR</th><th>BANK</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{sales.map((r,i)=>{ const k=kavlings.find(x=>x.id_kavling===r.id_kavling); return <tr key={r.id_sales}><td>{i+1}</td><td>{r.tgl_booking??'—'}</td><td><Link href={`/master/sales/detail?id=${r.id_sales}`} className="sales-link">{r.id_kavling}</Link></td><td>{r.nama_konsumen}</td><td>{typeMap.get(k?.id_tipe??'')??'—'}</td><td>{formatCurrency(r.harga_jual)}</td><td>{r.jenis_pembayaran??'—'}</td><td>{bankMap.get(r.id_bank??'')??'—'}</td><td><span className="sales-badge">{statusLabel(r.status_sales)}</span></td><td>{r.status_aktif?<><Link href={`/master/sales/detail?id=${r.id_sales}`} className="sales-detail-btn">DETAIL</Link><form action={deactivateSales} style={{display:'inline',marginLeft:5}}><input type="hidden" name="id_sales" value={r.id_sales}/><button className="sales-detail-btn" type="submit">TUTUP</button></form></>:<span>—</span>}</td></tr>})}{!sales.length&&<tr><td colSpan={10} className="simple-empty">BELUM ADA DATA SALES.</td></tr>}</tbody></table></div><div className="sales-foot"><span>MENAMPILKAN {sales.length} DATA</span><span>SALES AKTIF: {active.length}</span></div></section>
  </section></main>;
}
function formatCurrency(v:number|string|null){const n=Number(v);return Number.isFinite(n)&&n>0?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n):'—'}
function statusLabel(v:string){return v==='PROSES_KPR'?'PROSES KPR':v}
