import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { updateSalesInfo } from '../actions';
import { upsertKprProgress } from '../kpr-actions';

type SearchParams = Promise<{id?:string;error?:string;success?:string}>;
type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;alamat_konsumen:string|null;hp_konsumen:string|null;status_sales:string;jenis_pembayaran:string;id_bank:string|null;id_notaris:string|null;harga_jual:number|string|null;tgl_booking:string|null;target_akad:string|null;tgl_akad:string|null;status_aktif:boolean};
type Bank={id_bank:string;nama_bank:string}; type Notaris={id_notaris:string;nama_notaris:string}; type Kpr={id_progress:string;tahap:string;tanggal_update:string;keterangan:string|null};
const STAGES=[['KELENGKAPAN_DATA','KELENGKAPAN DATA'],['SURVEY_BANK','SURVEY BANK'],['INTERVIEW','INTERVIEW'],['SP3K','SP3K']] as const;

export default async function SalesDetailPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const id=p.id; if(!id) redirect('/master/sales');
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const [{data:sale,error:saleError},{data:banks},{data:notaries},{data:kpr}] = await Promise.all([
   supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif').eq('id_sales',id).maybeSingle(),
   supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).order('nama_bank'),
   supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
   supabase.from('sales_kpr_progress').select('id_progress,tahap,tanggal_update,keterangan').eq('id_sales',id).order('tanggal_update'),
 ]);
 if(!sale) return <main className="master-simple-page"><div className="kavio-alert error">{p.error??saleError?.message??'DATA SALES TIDAK DITEMUKAN'}</div><Link className="kavio-button secondary" href="/master/sales">KEMBALI KE SALES</Link></main>;
 const s=sale as Sale; const br=(banks??[]) as Bank[]; const nr=(notaries??[]) as Notaris[]; const kr=(kpr??[]) as Kpr[]; const kprMap=new Map(kr.map(x=>[x.tahap,x]));
 return <main className="master-simple-page sales-detail-page">
   {p.error&&<div className="kavio-alert error">{p.error}</div>}{p.success&&<div className="kavio-alert success">{p.success}</div>}
   <section className="kavio-panel">
     <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DATA SALES — {s.id_kavling}</h2><div className="kavio-panel-note">Informasi konsumen, status penjualan, pembayaran, dan data akad.</div></div><Link className="kavio-button secondary" href="/master/sales">KEMBALI</Link></div>
     <form action={updateSalesInfo} className="kavio-form">
       <input type="hidden" name="id_sales" value={s.id_sales}/>
       <label className="kavio-field"><span>NAMA KONSUMEN</span><input name="nama_konsumen" defaultValue={s.nama_konsumen}/></label>
       <label className="kavio-field"><span>HP KONSUMEN</span><input name="hp_konsumen" type="tel" inputMode="tel" defaultValue={s.hp_konsumen??''}/></label>
       <label className="kavio-field sales-span-2"><span>ALAMAT KONSUMEN</span><input name="alamat_konsumen" defaultValue={s.alamat_konsumen??''}/></label>
       <label className="kavio-field"><span>STATUS SALES</span><select name="status_sales" defaultValue={s.status_sales}><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></label>
       <label className="kavio-field"><span>JENIS PEMBAYARAN</span><select name="jenis_pembayaran" defaultValue={s.jenis_pembayaran??''}><option>KPR</option><option>CASH</option><option>CASH_BERTAHAP</option></select></label>
       <label className="kavio-field"><span>BANK KPR</span><select name="id_bank" defaultValue={s.id_bank??''}><option value="">PILIH BANK</option>{br.map(x=><option key={x.id_bank} value={x.id_bank}>{x.nama_bank}</option>)}</select></label>
       <label className="kavio-field"><span>HARGA JUAL</span><input value={s.harga_jual??''} readOnly /></label>
       <label className="kavio-field"><span>TANGGAL BOOKING</span><input value={s.tgl_booking??''} readOnly /></label>
       <label className="kavio-field"><span>TARGET AKAD</span><input type="date" name="target_akad" defaultValue={s.target_akad??''}/></label>
       <label className="kavio-field"><span>TANGGAL AKAD</span><input type="date" name="tgl_akad" defaultValue={s.tgl_akad??''}/></label>
       <label className="kavio-field"><span>NOTARIS AKAD</span><select name="id_notaris" defaultValue={s.id_notaris??''}><option value="">PILIH NOTARIS</option>{nr.map(x=><option key={x.id_notaris} value={x.id_notaris}>{x.nama_notaris}</option>)}</select></label>
       <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></div>
     </form>
   </section>

   {(s.jenis_pembayaran==='KPR'||s.status_sales==='PROSES_KPR')&&<section className="kavio-panel">
     <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PROGRESS PROSES KPR</h2><div className="kavio-panel-note">Setiap tahap disimpan sebagai histori proses KPR.</div></div><span className="kavio-badge">{kr.length} UPDATE</span></div>
     <div className="sales-kpr-grid kavio-panel-body">{STAGES.map(([key,label])=>{const row=kprMap.get(key);return <div key={key} className={`sales-kpr-stage ${row?'is-done':''}`}><div className="sales-kpr-stage-title">{label}</div><div className="sales-kpr-stage-date">{row?row.tanggal_update:'BELUM UPDATE'}</div><div className="sales-kpr-stage-note">{row?.keterangan??'—'}</div></div>})}</div>
     <form action={upsertKprProgress} className="kavio-form kavio-panel-body">
       <input type="hidden" name="id_sales" value={s.id_sales}/>
       <label className="kavio-field"><span>TAHAP</span><select name="tahap" defaultValue="KELENGKAPAN_DATA">{STAGES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
       <label className="kavio-field"><span>TANGGAL UPDATE</span><input type="date" name="tanggal_update" required/></label>
       <label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="CATATAN PROSES KPR"/></label>
       <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN UPDATE KPR</button></div>
     </form>
   </section>}
 </main>;
}
