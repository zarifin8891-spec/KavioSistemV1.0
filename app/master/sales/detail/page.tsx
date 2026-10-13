import SalesAkadPanel from '../SalesAkadPanel';
import KavioDetailGrid,{type KavioDetailItem} from '../../../components/KavioDetailGrid';
import KavioPaymentHistory from '../../../components/KavioPaymentHistory';
import KavioFormActions from '../../../components/KavioFormActions';
import Link from 'next/link';
import SalesPaymentFields from '../SalesPaymentFields';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { updateSalesInfo } from '../actions';
import { upsertKprProgress } from '../kpr-actions';
import { formatKavioDate } from '../../../lib/date-format';
import SalesCostPanel from '../SalesCostPanel';
import SalesContractPanel from '../SalesContractPanel';
import {readAllReportRows} from '../../../lib/report-data';
import type {FinancialProposal} from '../../../components/KavioFinancialApprovalHistory';
import { formatKavioMoney } from '../../../lib/number-format';
import KavioActionGate from '../../../components/KavioActionGate';
import KavioModalAction from '../../../components/KavioModalAction';

type SearchParams = Promise<{id?:string;error?:string;success?:string}>;
type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;alamat_konsumen:string|null;hp_konsumen:string|null;status_sales:string;jenis_pembayaran:string;id_bank:string|null;id_notaris:string|null;harga_jual:number|string|null;tgl_booking:string|null;target_akad:string|null;tgl_akad:string|null;status_aktif:boolean};
type Bank={id_bank:string;nama_bank:string}; type Notaris={id_notaris:string;nama_notaris:string;status_aktif:boolean}; type Kpr={id_progress:string;tahap:string;tanggal_update:string;keterangan:string|null}; type SalesCost={jenis_biaya:string;nominal:number|string};
const STAGES=[['KELENGKAPAN_DATA','KELENGKAPAN DATA'],['SURVEY_BANK','SURVEY BANK'],['INTERVIEW','INTERVIEW'],['SP3K','SP3K']] as const;

export default async function SalesDetailPage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams; const id=p.id; if(!id) redirect('/master/sales');
 const supabase=await createClient();
const [{data:sale,error:saleError},{data:banks},{data:notaries},{data:kpr},{data:costs,error:costError},{data:terms,error:termsError},{data:financial,error:financialError}] = await Promise.all([
   supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif').eq('id_sales',id).maybeSingle(),
   supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).eq('is_kpr',true).order('nama_bank'),
   supabase.from('master_notaris').select('id_notaris,nama_notaris,status_aktif').order('nama_notaris'),
   supabase.from('sales_kpr_progress').select('id_progress,tahap,tanggal_update,keterangan').eq('id_sales',id).order('tanggal_update'),
   supabase.from('sales_biaya_tambahan').select('jenis_biaya,nominal').eq('id_sales',id).eq('status_aktif',true).order('jenis_biaya'),
   supabase.from('sales_cash_installment_terms').select('tenor_bulan,pola_pelunasan').eq('id_sales',id).maybeSingle(),
   supabase.from('v_sales_financial_position').select('total_harga_jual,total_pembayaran_harga_jual').eq('id_sales',id).maybeSingle(),
 ]);
 if(!sale) return <main className="master-simple-page"><div className="kavio-alert error">{p.error??saleError?.message??'DATA SALES TIDAK DITEMUKAN'}</div><Link className="kavio-button secondary" href="/master/sales">KEMBALI KE SALES</Link></main>;
 if(costError||termsError)return <main className="master-simple-page"><div className="kavio-alert error">{costError?.message??termsError?.message}</div><Link href="/master/sales" className="kavio-button secondary">KEMBALI KE SALES</Link></main>;
 const s=sale as Sale; const br=(banks??[]) as Bank[]; const nr=(notaries??[]) as Notaris[]; const kr=(kpr??[]) as Kpr[]; const cr=(costs??[]) as SalesCost[]; const kprMap=new Map(kr.map(x=>[x.tahap,x]));
 const cashPaid=financial&&!financialError&&Number.isFinite(Number(financial.total_harga_jual))&&Number.isFinite(Number(financial.total_pembayaran_harga_jual))&&Number(financial.total_pembayaran_harga_jual)+0.000001>=Number(financial.total_harga_jual);
 const canRecordAkad=s.status_aktif&&s.status_sales!=='BATAL'&&s.status_sales!=='AKAD'&&(s.jenis_pembayaran==='KPR'||(['CASH','CASH_BERTAHAP'].includes(s.jenis_pembayaran)&&cashPaid));
 const proposals=await readAllReportRows(supabase.from('sales_financial_approval').select('*').eq('id_sales',id).eq('jenis','PERJANJIAN').order('urutan',{ascending:false}));
 const costValue=(kind:string)=>Number(cr.find(c=>c.jenis_biaya===kind)?.nominal??0);
 const contract={harga_jual:Number(s.harga_jual??0),jenis_pembayaran:s.jenis_pembayaran,id_bank:s.id_bank,tenor_bulan:terms?.tenor_bulan??null,pola_pelunasan:terms?.pola_pelunasan??null,biaya_penambahan_bangunan:costValue('PENAMBAHAN BANGUNAN'),biaya_kelebihan_tanah:costValue('KELEBIHAN TANAH'),biaya_hook:costValue('PEMILIHAN LOKASI HOOK'),biaya_notaris:costValue('NOTARIS'),biaya_akad:costValue('BIAYA AKAD'),biaya_lainnya:costValue('BIAYA LAINNYA')};
 return <main className="master-simple-page sales-detail-page kavio-detail-stack">
   {p.error&&<div className="kavio-alert error">{p.error}</div>}{p.success&&<div className="kavio-alert success">{p.success}</div>}
   {financialError&&s.jenis_pembayaran!=='KPR'&&<div className="kavio-alert error">Status pelunasan belum dapat dibaca: {financialError.message}</div>}
   <section className="kavio-panel">
     <div className="kavio-panel-head">
       <div><h2 className="kavio-panel-title">DATA SALES — {s.id_kavling}</h2><div className="kavio-panel-note">Informasi konsumen, status penjualan, pembayaran, dan data akad.</div></div>
       <div className="kavio-actions">{canRecordAkad&&<SalesAkadPanel id={s.id_sales} payment={s.jenis_pembayaran} notaries={nr.filter(n=>n.status_aktif)}/>}<KavioPaymentHistory idSales={s.id_sales}/><KavioActionGate action="SALES_WRITE">
         <KavioModalAction formKey="sales-edit" buttonLabel="EDIT DATA SALES" title={`EDIT DATA SALES — ${s.id_kavling}`} note="Perbarui data transaksi dan lifecycle Sales lalu simpan." size="wide">
           <form id="sales-info-form" action={updateSalesInfo} className="kavio-form kavio-panel-body">
             <input type="hidden" name="id_sales" value={s.id_sales}/>
             <label className="kavio-field"><span>NAMA KONSUMEN</span><input name="nama_konsumen" defaultValue={s.nama_konsumen}/></label>
             <label className="kavio-field"><span>HP KONSUMEN</span><input name="hp_konsumen" type="tel" inputMode="tel" defaultValue={s.hp_konsumen??''}/></label>
             <label className="kavio-field sales-span-2"><span>ALAMAT KONSUMEN</span><input name="alamat_konsumen" defaultValue={s.alamat_konsumen??''}/></label>
             <label className="kavio-field"><span>STATUS SALES</span><select name="status_sales" defaultValue={s.status_sales}><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option>{s.status_sales==='AKAD'&&<option value="AKAD">AKAD</option>}<option value="BATAL">BATAL</option></select></label>
             <SalesPaymentFields key={[s.jenis_pembayaran,s.id_bank,terms?.tenor_bulan,terms?.pola_pelunasan].join(':')} locked payment={s.jenis_pembayaran} bank={s.id_bank} banks={br} tenor={terms?.tenor_bulan??6} pattern={terms?.pola_pelunasan??'CICILAN_FLEKSIBEL'} />
             <label className="kavio-field"><span>HARGA JUAL</span><input className="kavio-money" value={formatKavioMoney(s.harga_jual)} readOnly /></label>
             <label className="kavio-field"><span>TANGGAL BOOKING</span><input value={s.tgl_booking ? formatKavioDate(s.tgl_booking) : ''} readOnly /></label>
             <label className="kavio-field"><span>TARGET AKAD</span><input type="date" name="target_akad" defaultValue={s.target_akad??''}/></label>
             <KavioFormActions><button type="submit" className="kavio-button">SIMPAN PERUBAHAN</button></KavioFormActions>
           </form>
         </KavioModalAction>
       </KavioActionGate></div>
     </div>
     <div className="kavio-panel-body"><KavioDetailGrid items={[
       {label:'KONSUMEN',value:s.nama_konsumen},{label:'HP',value:s.hp_konsumen||'—'},
       {label:'STATUS',value:s.status_sales},{label:'PEMBAYARAN',value:s.jenis_pembayaran.replaceAll('_',' ')},
       {label:'BANK KPR',value:br.find(x=>x.id_bank===s.id_bank)?.nama_bank??'—'},
       {label:'HARGA JUAL DASAR',value:formatKavioMoney(s.harga_jual),money:true},
       {label:'BOOKING',value:s.tgl_booking?formatKavioDate(s.tgl_booking):'—'},
       {label:'TANGGAL AKAD',value:s.tgl_akad?formatKavioDate(s.tgl_akad):'—'},
       {label:'NOTARIS',value:nr.find(x=>x.id_notaris===s.id_notaris)?.nama_notaris??'—'},
       ...(s.jenis_pembayaran==='CASH_BERTAHAP'?[{label:'TENOR',value:`${terms?.tenor_bulan??'—'} BULAN · ${terms?.pola_pelunasan?.replaceAll('_',' ')??'—'}`}]:[]),
       {label:'ALAMAT',value:s.alamat_konsumen||'—',span:2},
     ] as KavioDetailItem[]}/></div>
   </section>

   <KavioActionGate action="SALES_WRITE">
       <SalesCostPanel key={JSON.stringify(cr)+s.harga_jual} readOnly idSales={s.id_sales} hargaDasar={s.harga_jual} costs={cr} />
   </KavioActionGate>
   <SalesContractPanel key={JSON.stringify(contract)+proposals.length} id={s.id_sales} initial={contract} banks={br} requests={proposals as FinancialProposal[]} active={s.status_aktif&&s.status_sales!=='BATAL'}/>

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
     <div className="kavio-panel-body"><KavioDetailGrid columns={4} items={STAGES.map(([key,label])=>{const row=kprMap.get(key);return {label,value:<>{row?formatKavioDate(row.tanggal_update):'BELUM UPDATE'}<small>{row?.keterangan||'—'}</small></>};})}/></div>
   </section>}
 </main>;
}
