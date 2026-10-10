'use client';
import {useState} from 'react';
export default function SalesPaymentFields({payment,bank,banks,tenor,pattern}:{payment:string;bank:string|null;banks:{id_bank:string;nama_bank:string}[];tenor:number;pattern:string}){
 const [kind,setKind]=useState(payment);
 return <><label className="kavio-field"><span>JENIS PEMBAYARAN</span><select name="jenis_pembayaran" value={kind} onChange={e=>setKind(e.target.value)}><option>KPR</option><option>CASH</option><option>CASH_BERTAHAP</option></select></label>
 <label className="kavio-field"><span>BANK KPR</span><select name="id_bank" defaultValue={bank??''} required={kind==='KPR'} disabled={kind!=='KPR'}><option value="">PILIH BANK</option>{banks.map(x=><option key={x.id_bank} value={x.id_bank}>{x.nama_bank}</option>)}</select></label>
 {kind==='CASH_BERTAHAP'&&<><label className="kavio-field"><span>TENOR CASH BERTAHAP</span><select name="tenor_bulan" defaultValue={tenor}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} BULAN</option>)}</select></label>
<label className="kavio-field"><span>POLA PEMBAYARAN</span><select name="pola_pelunasan" defaultValue={pattern}><option value="CICILAN_FLEKSIBEL">CICILAN FLEKSIBEL</option><option value="LUNAS_DI_AKHIR">LUNAS DI AKHIR</option></select></label></>}</>;
}
