'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {createClient} from '../../lib/supabase/client';
import KavioFormModal from '../components/KavioFormModal';
import KavioFormActions from '../components/KavioFormActions';
import KavioDetailGrid from '../components/KavioDetailGrid';
import {PaymentHistory} from '../components/KavioPaymentHistory';
import KavioSCurve,{buildCurvePoints,type CurveHistory} from '../components/KavioSCurve';
import {readAllReportRows} from '../lib/report-data';
import {formatKavioDate} from '../lib/date-format';
import {formatKavioMoney} from '../lib/number-format';

type Lot={id_kavling:string;blok?:string|null;no_kavling?:string|null;nama_tipe?:string|null;id_tipe?:string|null;status_kavling?:string|null;status_aktif?:boolean|null;luas_tanah_standar?:number|string|null;luas_tanah_real?:number|string|null;kelebihan_tanah?:number|string|null;harga_standar?:number|string|null;harga_tanah_meter?:number|string|null;harga_jual?:number|string|null};
const pct=(n:number|string|null)=>`${(Number(n??0)*100).toFixed(2)}%`;
const area=(n:number|string|null|undefined)=>n==null?'—':`${Number(n).toFixed(2)} m²`;
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">{title}</h2></div><div className="kavio-panel-body">{children}</div></section>;}
async function loadLot(id:string){
 const db=createClient();
 // Prefer the current contract, otherwise show the latest historical contract explicitly.
 const [salesResult,spkResult]=await Promise.all([
  db.from('sales').select('id_sales,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,harga_jual,tgl_booking,tgl_akad,id_bank,id_notaris,status_aktif').eq('id_kavling',id).order('status_aktif',{ascending:false}).order('created_at',{ascending:false}).order('id_sales').limit(1).maybeSingle(),
  db.from('spk').select('id_spk,tgl_spk,tgl_target_selesai,status_spk,id_kantor,id_mandor,mode_progress,total_upah_borongan,configured_at').eq('id_kavling',id).order('created_at',{ascending:false}).order('id_spk').limit(1).maybeSingle(),
 ]);
 if(salesResult.error||spkResult.error)throw new Error(salesResult.error?.message??spkResult.error?.message);
 const sale=salesResult.data,spk=spkResult.data;
 const lookup=async(table:string,key:string,id:string|null|undefined,name:string)=>{
  if(!id)return '—';const r=await db.from(table).select(name).eq(key,id).maybeSingle();if(r.error)throw new Error(r.error.message);return String((r.data as unknown as Record<string,unknown>|null)?.[name]??id);
 };
 const [bank,notary,office,mandor,termsResult,costs,stages,current,curveResult]=await Promise.all([
  lookup('master_bank','id_bank',sale?.id_bank,'nama_bank'),lookup('master_notaris','id_notaris',sale?.id_notaris,'nama_notaris'),
  lookup('master_kantor_pelaksana','id_kantor',spk?.id_kantor,'nama_kantor_pelaksana'),lookup('master_mandor','id_mandor',spk?.id_mandor,'nama_mandor'),
  sale?db.from('sales_cash_installment_terms').select('tenor_bulan,pola_pelunasan').eq('id_sales',sale.id_sales).maybeSingle():Promise.resolve({data:null,error:null}),
  sale?readAllReportRows(db.from('sales_biaya_tambahan').select('jenis_biaya,nominal').eq('id_sales',sale.id_sales).eq('status_aktif',true).order('jenis_biaya')):Promise.resolve([]),
  sale?.jenis_pembayaran==='KPR'?readAllReportRows(db.from('sales_kpr_progress').select('id_progress,tahap,tanggal_update,keterangan').eq('id_sales',sale.id_sales).order('tanggal_update').order('id_progress')):Promise.resolve([]),
  spk?readAllReportRows(db.from('v_spk_work_item_progress_current').select('id_item,nama_pekerjaan,bobot_final,progress_akumulasi,progress_berbobot,tanggal_update_terakhir').eq('id_spk',spk.id_spk).order('urutan').order('id_item')):Promise.resolve([]),
  spk?db.rpc('kavio_spk_curve_history',{p_id_spk:spk.id_spk}):Promise.resolve({data:[],error:null}),
 ]);
 if(termsResult.error||curveResult.error)throw new Error(termsResult.error?.message??curveResult.error?.message);
 return {sale,spk,bank,notary,office,mandor,terms:termsResult.data,costs,stages,current,curve:curveResult.data as CurveHistory[]};
}
type Data=Awaited<ReturnType<typeof loadLot>>;
export default function SiteplanLotModal({kavling,open,onClose}:{kavling:Lot|null;open:boolean;onClose:()=>void}){
 return <KavioFormModal open={open&&!!kavling} onClose={onClose} size="wide" ariaLabel={`Detail kavling ${kavling?.id_kavling??''}`}>{open&&kavling&&<LotDetail key={kavling.id_kavling} lot={kavling}/>}</KavioFormModal>;
}
function LotDetail({lot}:{lot:Lot}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;setData(null);setError('');loadLot(lot.id_kavling).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Data kavling gagal dibaca.');});return ()=>{live=false;};},[lot.id_kavling,revision]);
 const sale=data?.sale,spk=data?.spk;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <div className="kavio-detail-stack">
 <Panel title={`KAVLING ${lot.id_kavling} · ${(lot.status_kavling??'AVAILABLE').replaceAll('_',' ')}`}><KavioDetailGrid items={[
  {label:'BLOK / NOMOR',value:`${lot.blok??'—'} / ${lot.no_kavling??'—'}`},{label:'TIPE RUMAH',value:lot.nama_tipe??lot.id_tipe??'—'},
  {label:'LUAS TANAH STANDAR',value:area(lot.luas_tanah_standar)},{label:'LUAS TANAH AKTUAL',value:area(lot.luas_tanah_real)},{label:'KELEBIHAN TANAH',value:area(lot.kelebihan_tanah)},{label:'STATUS DATA',value:lot.status_aktif===false?'NONAKTIF':'AKTIF'},
  ...(!sale&&data?[{label:'HARGA STANDAR',value:formatKavioMoney(lot.harga_standar),money:true},{label:'HARGA TANAH / m²',value:formatKavioMoney(lot.harga_tanah_meter),money:true},{label:'HARGA JUAL',value:formatKavioMoney(lot.harga_jual),money:true}]:[]),
 ]}/></Panel>
 {error?<div className="kavio-alert error" role="alert">{error}</div>:!data?<p role="status">MEMUAT SALES, SPK & PROGRESS…</p>:<>
 {sale?<><Panel title={`SALES · ${sale.status_sales}${sale.status_aktif?'':' · HISTORIS'}`}><KavioDetailGrid items={[
  {label:'KONSUMEN',value:sale.nama_konsumen},{label:'HP',value:sale.hp_konsumen??'—'},{label:'PEMBAYARAN',value:sale.jenis_pembayaran.replaceAll('_',' ')},{label:'BANK KPR',value:data.bank},{label:'BOOKING',value:formatKavioDate(sale.tgl_booking)},{label:'HARGA JUAL DASAR',value:formatKavioMoney(sale.harga_jual),money:true},
  {label:'TANGGAL AKAD',value:formatKavioDate(sale.tgl_akad)},{label:'NOTARIS',value:data.notary},{label:'ALAMAT',value:sale.alamat_konsumen??'—',span:2},
  ...(sale.jenis_pembayaran==='CASH_BERTAHAP'?[{label:'TENOR / POLA PELUNASAN',value:`${data.terms?.tenor_bulan??'—'} BULAN · ${data.terms?.pola_pelunasan?.replaceAll('_',' ')??'—'}`,span:2}]:[]),
  ...data.costs.map(c=>({label:c.jenis_biaya,value:formatKavioMoney(c.nominal),money:true})),
 ]}/></Panel><PaymentHistory key={sale.id_sales} idSales={sale.id_sales} embedded/>
 {data.stages.length>0&&<Panel title="HISTORI PROSES KPR"><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>TANGGAL</th><th>TAHAP</th><th>KETERANGAN</th></tr></thead><tbody>{data.stages.map(s=><tr key={s.id_progress}><td>{formatKavioDate(s.tanggal_update)}</td><td>{s.tahap.replaceAll('_',' ')}</td><td>{s.keterangan??'—'}</td></tr>)}</tbody></table></div></Panel>}</>:<Panel title="SALES"><p className="kavio-panel-note">Belum ada Sales untuk kavling ini.</p></Panel>}
 {spk?<><Panel title="SPK & PROGRESS"><KavioDetailGrid items={[
  {label:'NO. SPK',value:spk.id_spk},{label:'STATUS SPK',value:spk.status_spk},{label:'TANGGAL SPK',value:formatKavioDate(spk.tgl_spk)},{label:'TARGET SELESAI',value:formatKavioDate(spk.tgl_target_selesai)},{label:'KANTOR PELAKSANA',value:data.office},{label:'MANDOR',value:data.mandor},
  {label:'INPUT PROGRESS',value:spk.mode_progress?.replaceAll('_',' ')??'—'},{label:'KONFIGURASI',value:spk.configured_at?'SUDAH DIKONFIGURASI':'BELUM DIKONFIGURASI'},{label:'TOTAL UPAH BORONGAN',value:formatKavioMoney(spk.total_upah_borongan),money:true},{label:'PROGRESS TOTAL',value:pct(data.current.reduce((n,r)=>n+Number(r.progress_berbobot??0),0))},
 ]}/><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>PEKERJAAN</th><th className="kavio-number">BOBOT</th><th className="kavio-number">PROGRESS</th><th className="kavio-number">KONTRIBUSI</th><th>UPDATE TERAKHIR</th></tr></thead><tbody>{data.current.map(r=><tr key={r.id_item}><td>{r.nama_pekerjaan}</td><td className="kavio-number">{pct(r.bobot_final)}</td><td className="kavio-number">{pct(r.progress_akumulasi)}</td><td className="kavio-number">{pct(r.progress_berbobot)}</td><td>{formatKavioDate(r.tanggal_update_terakhir)}</td></tr>)}{!data.current.length&&<tr><td colSpan={5} className="kavio-empty">Konfigurasi pekerjaan belum tersedia.</td></tr>}</tbody></table></div></Panel>
 <Panel title="S-CURVE PEMBANGUNAN">{spk.tgl_spk&&spk.tgl_target_selesai?<><KavioSCurve points={buildCurvePoints(spk.tgl_spk,spk.tgl_target_selesai,data.curve,today)} today={today}/><p className="kavio-panel-note">Rencana: garis emas · Aktual berbobot: garis hijau · Garis vertikal: hari ini. Rencana mengikuti rentang tanggal SPK dan target selesai.</p></>:<p className="kavio-panel-note">Tanggal SPK dan target selesai diperlukan untuk menampilkan S-Curve.</p>}</Panel></>:<Panel title="SPK & PROGRESS"><p className="kavio-panel-note">Belum ada SPK untuk kavling ini.</p></Panel>}
 </>}
 <KavioFormActions>{error&&<button type="button" className="kavio-button secondary" onClick={()=>setRevision(n=>n+1)}>MUAT ULANG</button>}</KavioFormActions>
 </div>;
}
