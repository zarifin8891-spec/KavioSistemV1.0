'use client';

import { useState } from 'react';
import { saveBankGuaranteeItems, submitBankGuaranteeClaim } from './actions';
import KavioActionGate from '../components/KavioActionGate';

type Sale={id_sales:string;id_kavling:string;nama_konsumen:string;jenis_pembayaran:string;status_sales:string;status_aktif:boolean};
type Guarantee={id_jaminan:string;id_sales:string;jenis_item:string;nominal_tagihan:number|string;status:string};
const ITEM_LABELS:Record<string,string>={IMB:'IMB',SERTIFIKAT:'Sertifikat',AIR_LISTRIK:'Air & Listrik',BESTEK:'Bestek',GLOBAL:'Global'};

export default function BankGuaranteePanel({sales,items}:{sales:Sale[];items:Guarantee[]}) {
  const [mode,setMode]=useState<'RINCI'|'GLOBAL'>('RINCI');
  const eligible=sales.filter((sale)=>sale.status_aktif&&sale.jenis_pembayaran==='KPR'&&sale.status_sales==='AKAD');
  return <section className="kavio-panel collection-actions">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DANA JAMINAN BANK</h2><div className="kavio-panel-note">Catat tagihan dana jaminan setelah akad, rinci per item atau satu nilai global.</div></div><span className="kavio-badge">KPR</span></div>
    <KavioActionGate action="PAYMENT_RECEIPT_WRITE"><details className="collection-details"><summary>Input item dana jaminan</summary>
      <form action={saveBankGuaranteeItems} className="kavio-form collection-form">
        <label className="kavio-field"><span>SALES KPR SETELAH AKAD</span><select id="guarantee_sales" name="id_sales" required defaultValue=""><option value="" disabled>PILIH SALES</option>{eligible.map((sale)=><option key={sale.id_sales} value={sale.id_sales}>{sale.id_kavling} · {sale.nama_konsumen}</option>)}</select></label>
        <label className="kavio-field"><span>FORMAT DANA JAMINAN</span><select name="jenis_item" value={mode==='GLOBAL'?'GLOBAL':'RINCI'} onChange={(event)=>setMode(event.target.value==='GLOBAL'?'GLOBAL':'RINCI')}><option value="RINCI">RINCI PER ITEM</option><option value="GLOBAL">NILAI GLOBAL</option></select></label>
        {(mode==='GLOBAL'?['GLOBAL']:['IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK']).map((item)=><label className="kavio-field" key={item}><span>{ITEM_LABELS[item].toUpperCase()} · NILAI TAGIHAN</span><input name={`nominal_${item}`} type="number" min="0" step="1" defaultValue="0" /></label>)}
        <button className="kavio-button" type="submit" disabled={!eligible.length}>SIMPAN DANA JAMINAN</button>
      </form>
    </details></KavioActionGate>
    {items.length>0&&<div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KAVLING</th><th>ITEM</th><th>NILAI TAGIHAN</th><th>STATUS</th><th>PENGAJUAN KE BANK</th></tr></thead><tbody>{items.map((item)=>{const sale=sales.find((s)=>s.id_sales===item.id_sales);return <tr key={item.id_jaminan}><td>{sale?.id_kavling??'—'}</td><td>{ITEM_LABELS[item.jenis_item]??item.jenis_item}</td><td>Rp {Number(item.nominal_tagihan).toLocaleString('id-ID')}</td><td>{item.status.replaceAll('_',' ')}</td><td>{item.status==='BELUM_DIAJUKAN'?<form action={submitBankGuaranteeClaim} className="guarantee-claim-form"><input type="hidden" name="id_jaminan" value={item.id_jaminan}/><input name="tanggal_pengajuan" type="date" required aria-label="Tanggal pengajuan ke bank"/><button type="submit" className="kavio-button">CATAT PENGAJUAN</button></form>:'—'}</td></tr>})}</tbody></table></div>}
  </section>;
}
