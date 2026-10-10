import KavioFormActions from '../../../components/KavioFormActions';
import Link from 'next/link';
import SalesPaymentFields from '../SalesPaymentFields';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { updateSalesInfo } from '../actions';
import { upsertKprProgress } from '../kpr-actions';
import { formatKavioDate } from '../../../lib/date-format';
import SalesCostPanel from '../SalesCostPanel';
import { formatKavioMoney } from '../../../lib/number-format';
import KavioActionGate from '../../../components/KavioActionGate';
import KavioModalAction from '../../../components/KavioModalAction';

type SearchParams = Promise<{id?:string;error?:string;success?:string}>;
type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;alamat_konsumen:string|null;hp_konsumen:string|null;status_sales:string;jenis_pembayaran:string;id_bank:string|null;id_notaris:string|null;harga_jual:number|string|null;tgl_booking:string|null;target_akad:string|null;tgl_akad:string|null;status_aktif:boolean};
type Bank={id_bank:string;nama_bank:string}; type Notaris={id_notaris:string;nama_notaris:string}; type Kpr={id_progress:string;tahap:string;tanggal_update:string;keterangan:string|null}; type SalesCost={jenis_biaya:string;nominal:number|string};
const STAGES=[['KELENGKAPAN_DATA','KELENGKAPAN DATA'],['SURVEY_BANK','SURVEY BANK'],['INTERVIEW','INTERVIEW'],['SP3K','SP3K']] as const;

export default async function SalesDetailPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const id=p.id; if(!id) redirect('/master/sales');
 const supabase=await createClient();
const [{data:sale,error:saleError},{data:banks},{data:notaries},{data:kpr},{data:costs},{data:terms}] = await Promise.all([
   supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif').eq('id_sales',id).maybeSingle(),
   supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).eq('is_kpr',true).order('nama_bank'),
   supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
   supabase.from('sales_kpr_progress').select('id_progress,tahap,tanggal_update,keterangan').eq('id_sales',id).order('tanggal_update'),
   supabase.from('sales_biaya_tambahan').select('jenis_biaya,nominal').eq('id_sales',id).eq('status_aktif',true).order('jenis_biaya'),
   supabase.from('sales_cash_installment_terms').select('tenor_bulan,pola_pelunasan').eq('id_sales',id).maybeSingle(),
 ]);
 if(!sale) return <main className="master-simple-page"><div className="kavio-alert error">{p.error??saleError?.message??'DATA SALES TIDAK DITEMUKAN'}</div><Link className="kavio-button secondary" href="/master/sales">KEMBALI KE SALES</Link></main>;
 const s=sale as Sale; const br=(banks??[]) as Bank[]; const nr=(notaries??[]) as Notaris[]; const kr=(kpr??[]) as Kpr[]; const cr=(costs??[]) as SalesCost[]; const kprMap=new Map(kr.map(x=>[x.tahap,x]));
 return <main className="master-simple-page sales-detail-page">
   {p.error&&<div className="kavio-alert error">{p.error}</div>}{p.success&&<div className="kavio-alert success">{p.success}</div>}
   <section className="kavio-panel">
     <div className="kavio-panel-head">
       <div><h2 className="kavio-panel-title">DATA SALES — {s.id_kavling}</h2><div className="kavio-panel-note">Informasi konsumen, status penjualan, pembayaran, dan data akad.</div></div>
       <KavioActionGate action="SALES_WRITE">
         <KavioModalAction formKey="sales-edit" buttonLabel="EDIT DATA SALES" title={`EDIT DATA SALES — ${s.id_kavling}`} note="Perbarui data transaksi dan lifecycle Sales lalu simpan." size="wide">
           <form id="sales-info-form" action={updateSalesInfo} className="kavio-form kavio-panel-body">
             <input type="hidden" name="id_sales" value={s.id_sales}/>
             <label className="kavio-field"><span>NAMA KONSUMEN</span><input name="nama_konsumen" defaultValue={s.nama_konsumen}/></label>
             <label className="kavio-field"><span>HP KONSUMEN</span><input name="hp_konsumen" type="tel" inputMode="tel" defaultValue={s.hp_konsumen??''}/></label>
             <label className="kavio-field sales-span-2"><span>ALAMAT KONSUMEN</span><input name="alamat_konsumen" defaultValue={s.alamat_konsumen??''}/></label>
             <label className="kavio-field"><span>STATUS SALES</span><select name="status_sales" defaultValue={s.status_sales}><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></label>
             <SalesPaymentFields payment={s.jenis_pembayaran} bank={s.id_bank} banks={br} tenor={terms?.tenor_bulan??6} pattern={terms?.pola_pelunasan??'CICILAN_FLEKSIBEL'} />
             <label className="kavio-field"><span>HARGA JUAL</span><input className="kavio-money" value={formatKavioMoney(s.harga_jual)} readOnly /></label>
             <label className="kavio-field"><span>TANGGAL BOOKING</span><input value={s.tgl_booking ? formatKavioDate(s.tgl_booking) : ''} readOnly /></label>
             <label className="kavio-field"><span>TARGET AKAD</span><input type="date" name="target_akad" defaultValue={s.target_akad??''}/></label>
             <label className="kavio-field"><span>TANGGAL AKAD</span><input type="date" name="tgl_akad" defaultValue={s.tgl_akad??''}/></label>
             <label className="kavio-field"><span>NOTARIS AKAD</span><select name="id_notaris" defaultValue={s.id_notaris??''}><option value="">PILIH NOTARIS</option>{nr.map(x=><option key={x.id_notaris} value={x.id_notaris}>{x.nama_notaris}</option>)}</select></label>
             <KavioFormActions><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></KavioFormActions>
           </form>
         </KavioModalAction>
       </KavioActionGate>
     </div>
     <div className="kavio-read-grid kavio-panel-body">
       <div><span>KONSUMEN</span><strong>{s.nama_konsumen}</strong></div>
       <div><span>HP</span><strong>{s.hp_konsumen??'—'}</strong></div>
       <div><span>STATUS</span><strong>{s.status_sales}</strong></div>
       <div><span>PEMBAYARAN</span><strong>{s.jenis_pembayaran}</strong></div>
       {s.jenis_pembayaran==='CASH_BERTAHAP'&&<div><span>TENOR</span><strong>{terms?.tenor_bulan??'—'} BULAN · {terms?.pola_pelunasan?.replaceAll('_',' ')}</strong></div>}
       <div><span>BANK</span><strong>{br.find(x=>x.id_bank===s.id_bank)?.nama_bank??'—'}</strong></div>
       <div><span>HARGA JUAL</span><strong className="kavio-money">{formatKavioMoney(s.harga_jual)}</strong></div>
       <div><span>BOOKING</span><strong>{s.tgl_booking?formatKavioDate(s.tgl_booking):'—'}</strong></div>
       <div><span>TARGET AKAD</span><strong>{s.target_akad?formatKavioDate(s.target_akad):'—'}</strong></div>
       <div><span>TANGGAL AKAD</span><strong>{s.tgl_akad?formatKavioDate(s.tgl_akad):'—'}</strong></div>
       <div><span>NOTARIS</span><strong>{nr.find(x=>x.id_notaris===s.id_notaris)?.nama_notaris??'—'}</strong></div>
       <div className="kavio-read-span-2"><span>ALAMAT</span><strong>{s.alamat_konsumen??'—'}</strong></div>
     </div>
   </section>

   <KavioActionGate action="SALES_WRITE">
       <SalesCostPanel idSales={s.id_sales} hargaDasar={s.harga_jual} costs={cr} />
   </KavioActionGate>

   {(s.jenis_pembayaran==='KPR'||s.status_sales==='PROSES_KPR')&&<section className="kavio-panel">
     <div className="kavio-panel-head">
       <div><h2 className="kavio-panel-title">PROGRESS PROSES KPR</h2><div className="kavio-panel-note">Setiap tahap disimpan sebagai histori proses KPR.</div></div>
       <div className="sales-kpr-head-actions">
         <span className="kavio-badge">{kr.length} UPDATE</span>
         <KavioActionGate action="SALES_WRITE">
           <KavioModalAction formKey="sales-kpr" buttonLabel="INPUT UPDATE KPR" title="UPDATE PROSES KPR" note="Simpan satu tahap proses KPR pada transaksi ini." size="compact">
             <form id="sales-kpr-form" action={upsertKprProgress} className="kavio-form kavio-panel-body">
               <input type="hidden" name="id_sales" value={s.id_sales}/>
               <label className="kavio-field"><span>TAHAP</span><select name="tahap" defaultValue="KELENGKAPAN_DATA">{STAGES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
               <label className="kavio-field"><span>TANGGAL UPDATE</span><input type="date" name="tanggal_update" required/></label>
               <label className="kavio-field sales-span-2"><span>KETERANGAN</span><input name="keterangan" placeholder="CATATAN PROSES KPR"/></label>
               <KavioFormActions><button type="submit" className="kavio-button">SIMPAN UPDATE KPR</button></KavioFormActions>
             </form>
           </KavioModalAction>
         </KavioActionGate>
       </div>
     </div>
     <div className="sales-kpr-grid kavio-panel-body">{STAGES.map(([key,label])=>{const row=kprMap.get(key);return <div key={key} className={`sales-kpr-stage ${row?'is-done':''}`}><div className="sales-kpr-stage-title">{label}</div><div className="sales-kpr-stage-date">{row ? formatKavioDate(row.tanggal_update) : 'BELUM UPDATE'}</div><div className="sales-kpr-stage-note">{row?.keterangan??'—'}</div></div>})}</div>
   </section>}
 </main>;
}
