'use client';

import KavioFormActions from '../components/KavioFormActions';
import {useState} from 'react';
import {postSalesReceipt} from './actions';
import KavioActionGate from '../components/KavioActionGate';
import KavioTransactionModal from '../components/KavioTransactionModal';
import {formatKavioMoney} from '../lib/number-format';
export type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;jenis_pembayaran:string;status_sales:string;total_tagihan:number|string;total_diterima:number|string;saldo_piutang:number|string};
export type Account={id_bank:string;nama_bank:string;jenis_akun:string};
export type Receipt={id_penerimaan:string;id_sales:string;jenis_penerimaan:string;tanggal_penerimaan:string;nominal:number|string;metode_penerimaan:string;id_bank_penerimaan:string|null;id_jaminan:string|null;no_referensi:string|null;keterangan:string|null;jaminan_snapshot:{jenis_item:string;nominal_tagihan:number}[]};
const LABELS:Record<string,string>={BOOKING_FEE:'BOOKING FEE',UANG_MUKA:'UANG MUKA',CICILAN_CASH_BERTAHAP:'CICILAN CASH BERTAHAP',PELUNASAN_CASH:'PELUNASAN CASH',PENCAIRAN_KPR:'PENCAIRAN KPR BANK',PENCAIRAN_DANA_JAMINAN:'PENERIMAAN DANA JAMINAN',BIAYA_NOTARIS:'BIAYA NOTARIS',BIAYA_AKAD:'BIAYA AKAD'};
export default function ReceiptEntryPanel({sales,accounts}:{sales:Sale[];accounts:Account[]}){
 return <section className="kavio-panel collection-actions"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PENERIMAAN</h2><div className="kavio-panel-note">Pilih penerimaan Sales KPR atau selain KPR. Rekening tujuan wajib diisi.</div></div><KavioActionGate action="PAYMENT_RECEIPT_WRITE"><div className="kavio-master-row-actions">{[false,true].map(kpr=><KavioTransactionModal key={String(kpr)} title={kpr?'PENERIMAAN SALES KPR':'PENERIMAAN SELAIN KPR'} focusIds={[kpr?'receipt_kpr':'receipt_cash']}><ReceiptForm sales={sales.filter(s=>(s.jenis_pembayaran==='KPR')===kpr&&s.status_sales!=='BATAL')} accounts={accounts} focus={kpr?'receipt_kpr':'receipt_cash'}/></KavioTransactionModal>)}</div></KavioActionGate></div></section>;
}
export function ReceiptForm({sales,accounts,initial,guarantee,focus='receipt_edit'}:{sales:Sale[];accounts:Account[];initial?:Receipt;guarantee?:{id_jaminan:string;id_sales:string;saldo:number};focus?:string}){
 const [saleId,setSaleId]=useState(initial?.id_sales??guarantee?.id_sales??'');
 const [type,setType]=useState(initial?.jenis_penerimaan??(guarantee?'PENCAIRAN_DANA_JAMINAN':'BOOKING_FEE'));
 const [retention,setRetention]=useState(initial?.jaminan_snapshot.some(i=>i.jenis_item==='GLOBAL')?'GLOBAL':initial?.jaminan_snapshot.length?'RINCI':'TANPA');
 const sale=sales.find(s=>s.id_sales===saleId);
 const types=guarantee||initial?.jenis_penerimaan==='PENCAIRAN_DANA_JAMINAN'?['PENCAIRAN_DANA_JAMINAN']:['BOOKING_FEE','UANG_MUKA',...(sale?.jenis_pembayaran==='KPR'?['PENCAIRAN_KPR']:sale?.jenis_pembayaran==='CASH_BERTAHAP'?['CICILAN_CASH_BERTAHAP','PELUNASAN_CASH']:['PELUNASAN_CASH']),'BIAYA_NOTARIS','BIAYA_AKAD'];
 return <form action={postSalesReceipt} className="kavio-form collection-form">
 {initial&&<input name="id_penerimaan" type="hidden" value={initial.id_penerimaan}/>}
 <input type="hidden" name="focus" value={focus}/>
 {(initial||guarantee)&&<input type="hidden" name="id_sales" value={saleId}/>}
 <label className="kavio-field"><span>SALES / KAVLING</span><select id={focus} name={initial||guarantee?undefined:'id_sales'} disabled={!!initial||!!guarantee} required value={saleId} onChange={e=>{setSaleId(e.target.value);setType('BOOKING_FEE');}}><option value="" disabled>PILIH SALES</option>{sales.filter(s=>initial||guarantee||Number(s.saldo_piutang)>0).map(s=><option key={s.id_sales} value={s.id_sales}>{s.id_kavling} · {s.nama_konsumen}</option>)}</select></label>
 <label className="kavio-field"><span>JENIS PENERIMAAN</span><select name="jenis_penerimaan" value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{LABELS[t]}</option>)}</select></label>
 {sale&&<p className="collection-wide">Saldo piutang: <strong>{formatKavioMoney(sale.saldo_piutang)}</strong>{guarantee&&<> · Sisa jaminan: <strong>{formatKavioMoney(guarantee.saldo)}</strong></>}</p>}
 <label className="kavio-field"><span>TANGGAL DITERIMA</span><input name="tanggal_penerimaan" type="date" defaultValue={initial?.tanggal_penerimaan} required/></label>
 <label className="kavio-field"><span>NOMINAL UANG MASUK</span><input name="nominal" type="number" min="1" step="1" defaultValue={initial?.nominal??guarantee?.saldo} max={guarantee?.saldo} required/></label>
 <label className="kavio-field"><span>KAS / BANK TUJUAN</span><select name="id_bank_penerimaan" required defaultValue={initial?.id_bank_penerimaan??''}><option value="" disabled>PILIH KAS / BANK</option>{accounts.map(a=><option key={a.id_bank} value={a.id_bank}>{a.jenis_akun} · {a.nama_bank}</option>)}</select></label>
 <label className="kavio-field"><span>METODE</span><select name="metode_penerimaan" defaultValue={initial?.metode_penerimaan??'TRANSFER'}>{['TUNAI','TRANSFER','GIRO','LAINNYA'].map(t=><option key={t}>{t}</option>)}</select></label>
 {(guarantee||initial?.id_jaminan)&&<input name="id_jaminan" type="hidden" value={guarantee?.id_jaminan??initial?.id_jaminan??''}/>}
 {type==='PENCAIRAN_KPR'&&<><label className="kavio-field collection-wide"><span>DANA JAMINAN DITAHAN BANK</span><select name="jaminan_mode" value={retention} onChange={e=>setRetention(e.target.value)}><option value="TANPA">TANPA DANA JAMINAN</option><option value="RINCI">RINCI PER ITEM</option><option value="GLOBAL">GLOBAL</option></select></label>{(retention==='GLOBAL'?['GLOBAL']:retention==='RINCI'?['IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK']:[]).map(item=><label className="kavio-field" key={item}><span>{item.replaceAll('_',' & ')} · NILAI DITAHAN</span><input name={`nominal_${item}`} type="number" min="0" step="1" defaultValue={initial?.jaminan_snapshot.find(i=>i.jenis_item===item)?.nominal_tagihan??0}/></label>)}<p className="collection-wide collection-note">Isi nominal uang yang benar-benar masuk. Dana jaminan yang ditahan menjadi tagihan ke bank dan belum dihitung sebagai penerimaan.</p></>}
 <label className="kavio-field"><span>NO. REFERENSI</span><input name="no_referensi" defaultValue={initial?.no_referensi??''}/></label>
 <label className="kavio-field collection-wide"><span>KETERANGAN</span><input name="keterangan" defaultValue={initial?.keterangan??''}/></label>
 {initial&&<label className="kavio-field collection-wide"><span>ALASAN KOREKSI</span><input name="alasan" required/><small>Kuitansi sebelumnya ditandai batal dan diganti kuitansi baru.</small></label>}
 <KavioFormActions><button type="submit" className="kavio-button" disabled={!sale||!accounts.length}>SIMPAN & TERBITKAN KUITANSI</button></KavioFormActions>
 </form>;
}
