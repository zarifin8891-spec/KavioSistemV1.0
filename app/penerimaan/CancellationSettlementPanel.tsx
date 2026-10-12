'use client';
import {useEffect,useState} from 'react';
import KavioFormActions from '../components/KavioFormActions';
import KavioTransactionModal from '../components/KavioTransactionModal';
import KavioTransactionHeader from '../components/KavioTransactionHeader';
import KavioActionGate from '../components/KavioActionGate';
import KavioMoneyField from '../components/KavioMoneyField';
import KavioFinancialApprovalHistory,{type FinancialProposal} from '../components/KavioFinancialApprovalHistory';
import KavioDataTable from '../components/KavioDataTable';
import KavioTableTotals from '../components/KavioTableTotals';
import KavioReportActions from '../components/KavioReportActions';
import {submitFinancialProposal,postRefundPayment} from '../lib/financial-approval-actions';
import {formatKavioMoney} from '../lib/number-format';
import {formatKavioDate} from '../lib/date-format';
type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;jenis_pembayaran:string;total_diterima:number|string};
type Settlement={id_sales:string;keputusan:string;nominal_dikembalikan:number|string;nominal_ditahan:number|string;alasan:string;status_pengembalian:string;tanggal_pengembalian:string|null};
export type RefundPosition={id_sales:string;id_pengajuan:string|null;nominal_dibayar:number;sisa_refund:number|null;histori_legacy:boolean};
export type RefundPayment={id_pembayaran:string;id_sales:string;id_pengajuan:string;tanggal:string;id_bank:string;nominal:number;no_referensi:string|null;keterangan:string|null};
type Account={id_bank:string;nama_bank:string};
const decisions={BOOKING_FEE_DIKEMBALIKAN:'Booking Fee dikembalikan',BOOKING_FEE_DIHANGUSKAN:'Booking Fee dihanguskan',DIKEMBALIKAN_SEBAGIAN:'Pengembalian sebagian',TANPA_PENGEMBALIAN:'Tanpa pengembalian'};
function RefundEntry({sale,position,accounts,today}:{sale:Sale;position:RefundPosition;accounts:Account[];today:string}){
 const [key,setKey]=useState('');useEffect(()=>setKey(crypto.randomUUID()),[position.id_pengajuan,position.sisa_refund]);
 return <KavioTransactionModal title="Catat Pengembalian" focusIds={['refund_payment:'+sale.id_sales]}><form action={postRefundPayment} className="kavio-form kavio-panel-body"><input type="hidden" name="id_sales" value={sale.id_sales}/><input type="hidden" name="id_pengajuan" value={position.id_pengajuan??''}/><input type="hidden" name="request_key" value={key} data-kavio-persist-hidden="true" onInput={e=>{if(/^[\da-f-]{36}$/i.test(e.currentTarget.value))setKey(e.currentTarget.value);}}/><input type="hidden" name="focus" value={'refund_payment:'+sale.id_sales}/>
 <KavioTransactionHeader today={today}><label className="kavio-field"><span>KAS/BANK SUMBER</span><select name="id_bank" required><option value="">PILIH KAS/BANK</option>{accounts.map(b=><option key={b.id_bank} value={b.id_bank}>{b.nama_bank}</option>)}</select></label><label className="kavio-field"><span>NO. REFERENSI</span><input name="no_referensi"/></label></KavioTransactionHeader>
 <KavioMoneyField name="nominal" label="NOMINAL DIKEMBALIKAN" initial={Number(position.sisa_refund??0)}/><label className="kavio-field"><span>KETERANGAN</span><input name="keterangan"/></label>
 <p className="kavio-field-wide">Sisa refund disetujui: <strong>{formatKavioMoney(position.sisa_refund)}</strong>. Pembayaran boleh bertahap.</p><KavioFormActions><button className="kavio-button" disabled={!key}>SIMPAN PENGEMBALIAN</button></KavioFormActions></form></KavioTransactionModal>;
}
export default function CancellationSettlementPanel({sales,settlements,requests,positions,payments,accounts,today}:{sales:Sale[];settlements:Settlement[];requests:FinancialProposal[];positions:RefundPosition[];payments:RefundPayment[];accounts:Account[];today:string}){
 return <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PEMBATALAN & PENGEMBALIAN PEMBAYARAN</h2><p className="kavio-panel-note">Ajukan → Setujui Direktur → Catat Pengembalian. Kuitansi dan keputusan sebelumnya tetap tersimpan.</p></div><span className="kavio-badge">{sales.length} SALES BATAL</span></div>
 {!sales.length?<p className="kavio-empty">BELUM ADA SALES BATAL.</p>:<div className="kavio-page-stack">{sales.map(s=>{
 const saved=settlements.find(r=>r.id_sales===s.id_sales),history=requests.filter(r=>r.id_sales===s.id_sales),position=positions.find(r=>r.id_sales===s.id_sales),paid=payments.filter(r=>r.id_sales===s.id_sales);
 const total=paid.reduce((n,r)=>n+Number(r.nominal),0),bankName=(id:string)=>accounts.find(a=>a.id_bank===id)?.nama_bank??'Kas/Bank tidak aktif';
 return <details className="collection-details" key={s.id_sales}><summary>{s.id_kavling} · {s.nama_konsumen} · Diterima {formatKavioMoney(s.total_diterima)}{position?.id_pengajuan?' · KEPUTUSAN DISETUJUI':''}</summary><div className="kavio-page-stack">
 <div className="kavio-read-grid kavio-panel-body"><div><span>REFUND DIPUTUSKAN</span><strong>{saved?formatKavioMoney(saved.nominal_dikembalikan):'MENUNGGU KEPUTUSAN'}</strong></div><div><span>DANA DITAHAN</span><strong>{saved?formatKavioMoney(saved.nominal_ditahan):'—'}</strong></div><div><span>SUDAH DIKEMBALIKAN</span><strong>{formatKavioMoney(position?.nominal_dibayar??0)}</strong></div><div><span>SISA REFUND DISETUJUI</span><strong>{position?.sisa_refund==null?'—':formatKavioMoney(position.sisa_refund)}</strong></div></div>
 {position?.histori_legacy&&<p className="kavio-panel-note">Pengembalian sebelum workflow persetujuan tetap menjadi saldo histori.</p>}
 <div className="kavio-actions"><KavioActionGate action="PAYMENT_RECEIPT_WRITE">{!history.some(r=>r.status==='DIAJUKAN')&&<KavioTransactionModal title="Ajukan Keputusan Pembatalan" focusIds={['settlement_reason:'+s.id_sales]}><form action={submitFinancialProposal} className="kavio-form kavio-panel-body"><input type="hidden" name="id_sales" value={s.id_sales}/><input type="hidden" name="jenis" value="PEMBATALAN"/><input type="hidden" name="focus" value={'settlement_reason:'+s.id_sales}/>
 <label className="kavio-field"><span>KEPUTUSAN KASUS</span><select name="keputusan" defaultValue={saved?.keputusan??'DIKEMBALIKAN_SEBAGIAN'}>{Object.entries(decisions).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><KavioMoneyField name="nominal_dikembalikan" label="TOTAL REFUND (KUMULATIF)" initial={Number(saved?.nominal_dikembalikan??0)}/><KavioMoneyField name="nominal_ditahan" label="NILAI DITAHAN" initial={Number(saved?.nominal_ditahan??0)}/>
 <label className="kavio-field kavio-field-wide"><span>ALASAN KASUS / REVISI</span><input id={'settlement_reason:'+s.id_sales} name="alasan" required maxLength={500}/></label><p className="kavio-field-wide kavio-panel-note">Total refund termasuk pengembalian sebelumnya. Pengajuan belum mencatat uang keluar.</p><KavioFormActions><button className="kavio-button">AJUKAN KE DIREKTUR</button></KavioFormActions></form></KavioTransactionModal>}
 {position?.id_pengajuan&&Number(position.sisa_refund)>0&&<RefundEntry key={String(position.id_pengajuan)+position.sisa_refund} sale={s} position={position} accounts={accounts} today={today}/>}</KavioActionGate></div>
 <KavioFinancialApprovalHistory requests={history}/>
 {paid.length>0&&<section className="kavio-panel"><div className="kavio-panel-head"><h3 className="kavio-panel-title">RIWAYAT PENGEMBALIAN</h3><KavioReportActions title="Riwayat Refund" meta={s.id_kavling+' · '+s.nama_konsumen} headers={['TANGGAL','KAS/BANK','REFERENSI','KETERANGAN','NOMINAL']} rows={paid.map(r=>[formatKavioDate(r.tanggal),bankName(r.id_bank),r.no_referensi,r.keterangan,Number(r.nominal)])} totals={[{label:'TOTAL REFUND',value:total}]} totalColumns={[4]}/></div><KavioDataTable label="Riwayat refund" fit footer={<KavioTableTotals columns={5} totals={[{label:'TOTAL REFUND',value:total,column:4}]}/>} columns={[{key:'date',label:'TANGGAL'},{key:'bank',label:'KAS/BANK'},{key:'ref',label:'REFERENSI'},{key:'note',label:'KETERANGAN'},{key:'amount',label:'NOMINAL',align:'right'}]}>{paid.map(r=><tr key={r.id_pembayaran}><td>{formatKavioDate(r.tanggal)}</td><td>{bankName(r.id_bank)}</td><td>{r.no_referensi??'—'}</td><td>{r.keterangan??'—'}</td><td className="kavio-number">{formatKavioMoney(r.nominal)}</td></tr>)}</KavioDataTable></section>}
 </div></details>;})}</div>}</section>;
}
