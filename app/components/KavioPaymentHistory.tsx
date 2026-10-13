'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '../../lib/supabase/client';
import KavioFormModal from './KavioFormModal';
import KavioFormActions from './KavioFormActions';
import KavioDataTable from './KavioDataTable';
import KavioTableTotals from './KavioTableTotals';
import KavioReportActions from './KavioReportActions';
import {readAllReportRows} from '../lib/report-data';
import {consumerPaymentHistoryRows,type PaymentHistoryReceipt} from '../lib/payment-history';
import {formatKavioMoney} from '../lib/number-format';
import {formatKavioDate} from '../lib/date-format';
type Position={nama_konsumen:string;id_kavling:string;jenis_pembayaran:string;status_sales:string;total_tagihan:number|string;total_pelunasan_konsumen:number|string;saldo_piutang:number|string};
type History={position:Position;receipts:ReturnType<typeof consumerPaymentHistoryRows>;banks:Record<string,string>};
/** Load only the selected Sales on opening; every caller uses the same receipt engine. */
export default function KavioPaymentHistory({idSales,label='HISTORI PEMBAYARAN'}:{idSales:string;label?:string}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="kavio-button secondary" onClick={()=>setOpen(true)}>{label}</button><KavioFormModal open={open} onClose={()=>setOpen(false)} size="wide" ariaLabel="Histori pembayaran">{open&&<PaymentHistory idSales={idSales}/>}</KavioFormModal></>;
}
export function PaymentHistory({idSales,embedded=false}:{idSales:string;embedded?:boolean}){
 const [history,setHistory]=useState<History|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let live=true;setHistory(null);setError('');
  const load=async()=>{
   const supabase=createClient();
   const [receipts,{data:position,error:positionError},banks]=await Promise.all([
    readAllReportRows(supabase.from('v_sales_receipt_financial').select('id_penerimaan,no_kuitansi,tanggal_penerimaan,dibuat_pada,jenis_penerimaan,status,nominal,pelunasan_konsumen,id_bank_penerimaan,no_referensi,keterangan,alasan_pembatalan').eq('id_sales',idSales).neq('jenis_penerimaan','PENCAIRAN_DANA_JAMINAN').order('tanggal_penerimaan').order('dibuat_pada').order('id_penerimaan')),
    supabase.from('v_sales_financial_position').select('nama_konsumen,id_kavling,jenis_pembayaran,status_sales,total_tagihan,total_pelunasan_konsumen,saldo_piutang').eq('id_sales',idSales).maybeSingle(),
    readAllReportRows(supabase.from('master_bank').select('id_bank,nama_bank').order('id_bank')),
   ]);
   if(positionError)throw new Error(positionError.message);if(!position)throw new Error('Data Sales tidak ditemukan atau akses tidak tersedia.');
   const data=consumerPaymentHistoryRows(receipts as PaymentHistoryReceipt[],Number(position.total_tagihan),position.status_sales);
   if(Math.abs(data.totalPelunasan-Number(position.total_pelunasan_konsumen))>0.01||Math.abs(data.saldo-Number(position.saldo_piutang))>0.01)throw new Error('Data pembayaran berubah saat dibaca. Muat ulang histori untuk memperoleh saldo yang sesuai.');
   if(live)setHistory({position,receipts:data,banks:Object.fromEntries(banks.map(b=>[b.id_bank,b.nama_bank]))});
  };
  load().catch(e=>{if(live)setError(e instanceof Error?e.message:'Histori pembayaran gagal dibaca.');});
  return ()=>{live=false;};
 },[idSales,revision]);
 const p=history?.position,data=history?.receipts;
 const bank=(id:string|null)=>id?history?.banks[id]??id:'BELUM DITETAPKAN';
 const meta=p?`${p.id_kavling} · ${p.nama_konsumen} · ${p.jenis_pembayaran.replaceAll('_',' ')} · Total tagihan saat ini ${formatKavioMoney(p.total_tagihan)} · Saldo piutang ${formatKavioMoney(p.saldo_piutang)}. Saldo baris berdasarkan tagihan saat ini dan kuitansi aktif; bukan snapshot saldo historis. Kuitansi batal tidak dihitung.`:'';
 return <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">HISTORI PEMBAYARAN{p&&!embedded?' — '+p.id_kavling:''}</h2>{p&&<p className="kavio-panel-note">{!embedded&&<>{p.nama_konsumen} · {p.jenis_pembayaran.replaceAll('_',' ')} · </>}{data?.rows.length} KUITANSI</p>}</div>{history&&<KavioReportActions title={`Histori Pembayaran ${p?.id_kavling}`} meta={meta} headers={['TANGGAL','KUITANSI','JENIS','NOMINAL KAS/BANK','PELUNASAN KONSUMEN AKTIF','KAS/BANK','SALDO BERDASARKAN TAGIHAN SAAT INI','STATUS','REFERENSI / KETERANGAN']} rows={history.receipts.rows.map(r=>[formatKavioDate(r.tanggal_penerimaan),r.no_kuitansi,r.jenis_penerimaan.replaceAll('_',' '),Number(r.nominal),r.credit,bank(r.id_bank_penerimaan),r.saldo,r.status,[r.no_referensi,r.keterangan,r.alasan_pembatalan].filter(Boolean).join(' · ')])} totals={[{label:'TOTAL MASUK KAS/BANK AKTIF',value:history.receipts.totalKasBank},{label:'TOTAL PELUNASAN KONSUMEN AKTIF',value:history.receipts.totalPelunasan}]} totalColumns={[3,4]}/>}</div>
 <div className="kavio-page-stack kavio-panel-body">{error?<div className="kavio-alert error" role="alert">{error}</div>:!history?<p role="status">MEMUAT HISTORI PEMBAYARAN…</p>:<>
 {!embedded&&<div className="kavio-read-grid"><div><span>TOTAL TAGIHAN</span><strong>{formatKavioMoney(p?.total_tagihan)}</strong></div><div><span>PELUNASAN KONSUMEN AKTIF</span><strong>{formatKavioMoney(data?.totalPelunasan)}</strong></div><div><span>SALDO PIUTANG</span><strong>{formatKavioMoney(p?.saldo_piutang)}</strong></div></div>}
 {!embedded&&<p className="kavio-panel-note">Saldo per baris dihitung menggunakan total tagihan saat ini dan kuitansi aktif, bukan saldo historis saat kuitansi diterbitkan. Kuitansi batal tetap tampil tanpa mengurangi saldo.{p?.status_sales==='BATAL'?' Sales dibatalkan; penyelesaian refund tersedia di tab Pembatalan.':''}{p?.jenis_pembayaran==='KPR'?' Pencairan KPR melunasi konsumen sebesar bruto.':''}</p>}
 <KavioDataTable label="Histori pembayaran Sales" fit footer={<KavioTableTotals columns={8} label="TOTAL MASUK KAS/BANK AKTIF" totals={[{label:'TOTAL MASUK KAS/BANK AKTIF',column:3,value:history.receipts.totalKasBank}]}/>} columns={[{key:'date',label:'TANGGAL',width:'10%'},{key:'no',label:'KUITANSI',width:'17%'},{key:'type',label:'JENIS',width:'16%'},{key:'amount',label:'NOMINAL KAS/BANK',align:'right',width:'13%'},{key:'bank',label:'KAS/BANK',width:'13%'},{key:'balance',label:'SALDO PIUTANG',align:'right',width:'14%'},{key:'status',label:'STATUS',width:'7%'},{key:'note',label:'KETERANGAN',width:'10%'}]}>{history.receipts.rows.map(r=><tr key={r.id_penerimaan}><td>{formatKavioDate(r.tanggal_penerimaan)}</td><td><Link target="_blank" rel="noopener noreferrer" href={`/penerimaan/kuitansi?id=${encodeURIComponent(r.id_penerimaan)}`}>{r.no_kuitansi}</Link></td><td>{r.jenis_penerimaan.replaceAll('_',' ')}</td><td className="kavio-number">{formatKavioMoney(r.nominal)}{r.status==='AKTIF'&&Number(r.nominal)!==r.credit&&<small className="kavio-cell-subtext">Pelunasan konsumen: {formatKavioMoney(r.credit)}</small>}</td><td>{bank(r.id_bank_penerimaan)}</td><td className="kavio-number">{r.saldo==null?'—':formatKavioMoney(r.saldo)}</td><td>{r.status}</td><td>{[r.no_referensi,r.keterangan,r.alasan_pembatalan].filter(Boolean).join(' · ')||'—'}</td></tr>)}{!history.receipts.rows.length&&<tr><td colSpan={8} className="kavio-empty">BELUM ADA PEMBAYARAN UNTUK SALES INI.</td></tr>}</KavioDataTable>
 </>}{embedded?(error&&<button type="button" className="kavio-button secondary" onClick={()=>setRevision(n=>n+1)}>MUAT ULANG</button>):<KavioFormActions>{error&&<button type="button" className="kavio-button secondary" onClick={()=>setRevision(n=>n+1)}>MUAT ULANG</button>}</KavioFormActions>}</div></section>;
}
